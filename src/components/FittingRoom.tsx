import React, { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AnalyzeResponse, StyleOption, StylePreference } from "../types";
import { Sparkles, Check, Wand2, RotateCcw, Send, Loader2 } from "lucide-react";

export type ZoneKey = "hair" | "top" | "bottom" | "shoes";

export interface SpriteSheet {
  sheetUrl: string;
  cols: number;
  rows: number;
}

interface ZoneDef {
  key: ZoneKey;
  row: number;
  label: string;
  labelEn: string;
  optionsKey: keyof AnalyzeResponse["options"];
  topPct: number;
  heightPct: number;
}

// Vertical body partitions mapped to sprite-sheet rows.
const ZONES: ZoneDef[] = [
  { key: "hair", row: 0, label: "ヘアスタイル", labelEn: "HEAD", optionsKey: "hairstyle", topPct: 0, heightPct: 25 },
  { key: "top", row: 1, label: "上半身", labelEn: "UPPER", optionsKey: "top", topPct: 25, heightPct: 30 },
  { key: "bottom", row: 2, label: "下半身", labelEn: "LOWER", optionsKey: "bottom", topPct: 55, heightPct: 30 },
  { key: "shoes", row: 3, label: "足元", labelEn: "FEET", optionsKey: "shoes", topPct: 85, heightPct: 15 },
];

// Extra guidance tags per zone (in addition to the 3 generated options) for quick steering.
const ZONE_TAGS: Record<ZoneKey, string[]> = {
  hair: ["ショート", "ロングヘア", "パーマ", "ストレート", "前髪あり", "センターパート", "ウルフカット", "ナチュラル", "明るい髪色", "モード系"],
  top: ["シャツ", "ニット", "ジャケット", "パーカー", "Tシャツ", "きれいめ", "カジュアル", "オーバーサイズ", "モノトーン", "明るい色"],
  bottom: ["スラックス", "デニム", "ワイドパンツ", "スカート", "テーパード", "ショート丈", "きれいめ", "カジュアル", "ダークトーン", "明るい色"],
  shoes: ["スニーカー", "レザーシューズ", "ローファー", "ブーツ", "サンダル", "厚底", "きれいめ", "カジュアル", "ホワイト系", "ブラック系"],
};

// Placeholder hints for the free-text description input per zone.
const ZONE_INPUT_HINTS: Record<ZoneKey, string> = {
  hair: "例: 韓国風のレイヤードに、毛先を軽く",
  top: "例: 襟付きのリネンシャツ、オフホワイト",
  bottom: "例: とろみ素材のワイドスラックス、黒",
  shoes: "例: 厚底の白スニーカー、上品に",
};

interface FittingRoomProps {
  userPhoto: string | null;
  baseLoading?: boolean;
  spriteSheet: SpriteSheet | null;
  spriteLoading: boolean;
  options: AnalyzeResponse["options"];
  selections: Record<ZoneKey, number>;
  selectedTextByZone: Record<ZoneKey, string[]>;
  activeZone: ZoneKey;
  onActivateZone: (zone: ZoneKey) => void;
  onSelect: (zone: ZoneKey, index: number) => void;
  preferences: StylePreference;
  renderZoneSVG: (zone: ZoneKey, option: StyleOption) => React.ReactNode;
  onApply: () => void;
  onResetComposite: () => void;
  isApplying: boolean;
  compositeUrl: string | null;
  onToggleZoneTag: (zone: ZoneKey, tag: string) => void;
  onZoneTextSubmit: (zone: ZoneKey, instruction: string) => void;
  zoneModifying: ZoneKey | null;
}

export default function FittingRoom({
  userPhoto,
  baseLoading = false,
  spriteSheet,
  spriteLoading,
  options,
  selections,
  selectedTextByZone,
  activeZone,
  onActivateZone,
  onSelect,
  preferences,
  renderZoneSVG,
  onApply,
  onResetComposite,
  isApplying,
  compositeUrl,
  onToggleZoneTag,
  onZoneTextSubmit,
  zoneModifying,
}: FittingRoomProps) {
  // CSS sprite-cell style for a given (row, col) on the 3x4 master sheet.
  const tileStyle = useCallback(
    (row: number, col: number): React.CSSProperties | null => {
      if (!spriteSheet) return null;
      const { sheetUrl, cols, rows } = spriteSheet;
      return {
        backgroundImage: `url(${sheetUrl})`,
        backgroundSize: `${cols * 100}% ${rows * 100}%`,
        backgroundPosition: `${(col / Math.max(cols - 1, 1)) * 100}% ${(row / Math.max(rows - 1, 1)) * 100}%`,
        backgroundRepeat: "no-repeat",
      };
    },
    [spriteSheet]
  );

  const getOptions = (zone: ZoneDef): StyleOption[] => options[zone.optionsKey] || [];
  const activeZoneDef = ZONES.find((z) => z.key === activeZone)!;

  return (
    <div className="w-full flex flex-col gap-4">
      {/* ===== STAGE: full-body photo (LEFT) + accessories (RIGHT) ===== */}
      <div className="w-full flex flex-col sm:flex-row gap-3 items-stretch">
        {/* LEFT: full-body reference photo — shown whole (object-contain), never covered */}
        <div className="relative w-full sm:flex-1 sm:min-h-[440px] aspect-[3/4] sm:aspect-auto rounded-[28px] overflow-hidden shadow-xl border border-[#E7D6D2] bg-[#FFFDFC]">
          {compositeUrl ? (
            <img src={compositeUrl} alt="Applied try-on" className="absolute inset-0 w-full h-full object-contain" />
          ) : userPhoto ? (
            <img src={userPhoto} alt="Full-body reference" className="absolute inset-0 w-full h-full object-contain" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-[#FFF8F7] via-[#F8ECEB] to-[#EEF5EE]" />
          )}

          {/* Non-occluding body-zone ruler along the LEFT edge */}
          <div className="absolute left-0 top-0 bottom-0 w-[68px] flex flex-col pointer-events-none z-10">
            {ZONES.map((zone) => {
              const isActive = activeZone === zone.key;
              return (
                <div
                  key={zone.key}
                  className={`relative border-b border-dashed flex items-center transition-all ${
                    isActive ? "border-[#C9828C]/80 bg-[#FFF1F3]/36" : "border-white/36"
                  }`}
                  style={{ height: `${zone.heightPct}%` }}
                >
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 rounded text-[7px] uppercase tracking-widest font-bold ${
                      isActive ? "bg-[#9F5F68] text-white" : "bg-white/76 text-[#7D6664] backdrop-blur-sm"
                    }`}
                  >
                    {zone.labelEn}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Pipeline loading overlay */}
          <AnimatePresence>
            {(isApplying || baseLoading || spriteLoading) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[#FFF8F7]/82 backdrop-blur-[3px] z-30 flex flex-col items-center justify-center gap-3"
              >
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-4 border-[#F0DADC] border-t-[#9F5F68] animate-spin" />
                  <div className="absolute inset-2 bg-[#FFFDFC] rounded-full flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-[#9F5F68] animate-pulse" />
                  </div>
                </div>
                <p className="font-serif italic text-xs text-[#756665] animate-pulse text-center px-4">
                  {isApplying
                    ? "AIが最終試着画像を生成中..."
                    : baseLoading
                    ? "全身の参考写真を生成中..."
                    : "アイテム画像を準備中..."}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Composite reset chip */}
          {compositeUrl && !isApplying && (
            <button
              onClick={onResetComposite}
              className="absolute top-2 right-2 z-30 flex items-center gap-1 bg-white/85 hover:bg-white text-[#7D3F4A] text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-[#E0C7C6] shadow-sm"
            >
              <RotateCcw className="w-3 h-3" />
              編集に戻る
            </button>
          )}
        </div>

        {/* RIGHT: accessory zone tabs + swipe carousel */}
        <div className="w-full sm:w-[46%] sm:max-w-[280px] flex flex-col gap-2.5">
          {/* Zone tabs */}
          <div className="grid grid-cols-4 gap-1">
            {ZONES.map((zone) => {
              const isActive = activeZone === zone.key;
              const sel = selections[zone.key] ?? 0;
              const textTags = selectedTextByZone[zone.key] || [];
              const cell = tileStyle(zone.row, sel);
              const opt = getOptions(zone)[sel];
              return (
                <button
                  key={zone.key}
                  onClick={() => onActivateZone(zone.key)}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all ${
                    isActive ? "border-[#9F5F68] bg-[#FFF1F3] shadow-sm" : "border-[#E7D6D2] bg-white/72 opacity-86"
                  }`}
                >
                  <div className="w-full aspect-square rounded-xl bg-[#FFF8F7] overflow-hidden flex items-center justify-center">
                    {textTags.length > 0 ? (
                      <span className="px-1 text-center text-[8px] font-bold leading-tight text-[#7D3F4A]">
                        {textTags.slice(0, 2).join(" / ")}
                      </span>
                    ) : cell ? (
                      <div className="w-full h-full bg-center bg-contain" style={cell} />
                    ) : (
                      <div className="scale-[0.55]">{opt && renderZoneSVG(zone.key, opt)}</div>
                    )}
                  </div>
                  <span className="text-[7px] uppercase tracking-widest font-bold text-[#8F7B79]">{zone.labelEn}</span>
                </button>
              );
            })}
          </div>

          {/* Active-zone swipe carousel */}
          <ZoneCarousel
            zone={activeZoneDef}
            options={getOptions(activeZoneDef)}
            selected={selections[activeZone] ?? 0}
            textMode={(selectedTextByZone[activeZone] || []).length > 0}
            onSelect={(i) => onSelect(activeZone, i)}
            tileStyle={tileStyle}
            renderZoneSVG={renderZoneSVG}
          />

      {/* Per-zone text tags + free-text description */}
          <ZoneTuner
            zone={activeZoneDef}
            tags={ZONE_TAGS[activeZone]}
            selectedTags={selectedTextByZone[activeZone] || []}
            hint={ZONE_INPUT_HINTS[activeZone]}
            busy={zoneModifying === activeZone}
            disabled={zoneModifying !== null}
            onToggleTag={(tag) => onToggleZoneTag(activeZone, tag)}
            onSubmit={(instruction) => onZoneTextSubmit(activeZone, instruction)}
          />
        </div>
      </div>

      {/* ===== APPLY BUTTON ===== */}
      <button
        onClick={onApply}
        disabled={isApplying}
        className="w-full jp-primary-button py-3 rounded-2xl font-semibold text-[11px] tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-60"
      >
        <Wand2 className="w-4 h-4" />
        {isApplying ? "生成中..." : "この組み合わせで試着する"}
      </button>
    </div>
  );
}

// ---- Horizontal scroll-snap carousel; selection follows the snapped tile ----
interface ZoneCarouselProps {
  zone: ZoneDef;
  options: StyleOption[];
  selected: number;
  textMode: boolean;
  onSelect: (index: number) => void;
  tileStyle: (row: number, col: number) => React.CSSProperties | null;
  renderZoneSVG: (zone: ZoneKey, option: StyleOption) => React.ReactNode;
}

function ZoneCarousel({ zone, options, selected, textMode, onSelect, tileStyle, renderZoneSVG }: ZoneCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollTimer = useRef<any>(null);

  // Keep the carousel scrolled to the externally-selected tile (e.g. side-panel arrows).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const child = track.children[selected] as HTMLElement | undefined;
    if (child && Math.abs(track.scrollLeft - child.offsetLeft) > 4) {
      track.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
    }
  }, [selected, options.length]);

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const children = Array.from(track.children) as HTMLElement[];
      let nearest = 0;
      let best = Infinity;
      children.forEach((c, i) => {
        const dist = Math.abs(c.offsetLeft - track.scrollLeft);
        if (dist < best) {
          best = dist;
          nearest = i;
        }
      });
      if (!textMode && nearest !== selected) onSelect(nearest);
    }, 90);
  };

  return (
    <div className="w-full bg-white/72 border border-[#E7D6D2]/80 rounded-2xl p-2.5 shadow-sm">
      <div className="flex items-center justify-between px-1 mb-1.5">
        <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-[#9B7470] flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#B87986]" />
          {zone.labelEn} · スワイプ
        </span>
        <span className="text-[10px] font-mono font-semibold text-[#7D3F4A]">
          {textMode ? "TEXT" : `${selected + 1}/${options.length}`}
        </span>
      </div>

      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {options.map((opt, i) => {
          const cell = tileStyle(zone.row, i);
          const isSel = !textMode && i === selected;
          return (
            <button
              key={opt.id}
              onClick={() => onSelect(i)}
              className={`snap-center shrink-0 w-[130px] rounded-2xl border p-2 text-left transition-all ${
                isSel ? "border-[#9F5F68] bg-white shadow-md" : "border-[#E7D6D2] bg-white/62 opacity-84"
              }`}
            >
              <div className="w-full aspect-square rounded-xl bg-[#FFF8F7] border border-[#E7D6D2]/70 overflow-hidden flex items-center justify-center mb-1.5 relative">
                {cell ? (
                  <div className="w-full h-full bg-center bg-contain" style={cell} />
                ) : (
                  <div className="scale-90">{renderZoneSVG(zone.key, opt)}</div>
                )}
                {isSel && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#9F5F68] text-white flex items-center justify-center">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
              <div className="text-[11px] font-bold text-[#2D2525] truncate">{opt.name}</div>
              <div className="flex gap-1 mt-1 flex-wrap">
                {opt.tags?.slice(0, 2).map((t, ti) => (
                  <span key={ti} className="text-[8px] bg-amber-50 text-amber-800 px-1 py-0.5 rounded border border-amber-100">
                    {t}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Per-zone guidance: quick tags + free-text description that re-tune this zone ----
interface ZoneTunerProps {
  zone: ZoneDef;
  tags: string[];
  selectedTags: string[];
  hint: string;
  busy: boolean;
  disabled: boolean;
  onToggleTag: (tag: string) => void;
  onSubmit: (instruction: string) => void;
}

function ZoneTuner({ zone, tags, selectedTags, hint, busy, disabled, onToggleTag, onSubmit }: ZoneTunerProps) {
  const [text, setText] = useState("");

  // Clear the description when switching to another zone.
  useEffect(() => {
    setText("");
  }, [zone.key]);

  const submitText = () => {
    const v = text.trim();
    if (!v || disabled) return;
    onSubmit(v);
    setText("");
  };

  return (
    <div className="w-full bg-[#FFF8F7] border border-[#E7D6D2]/70 rounded-2xl p-2.5 space-y-2">
      <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-[#8F7B79] flex items-center gap-1">
        <Wand2 className="w-3 h-3 text-[#9F5F68]" />
        {zone.label}の文字タグを選択
      </span>

      {/* Quick guidance tags */}
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => {
          const isSelected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => !disabled && onToggleTag(tag)}
              disabled={disabled}
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isSelected
                  ? "border-[#9F5F68] bg-[#FFF1F3] text-[#7D3F4A] shadow-sm"
                  : "border-[#E7D6D2] bg-white text-[#7D5A5E] hover:bg-[#FFF1F3] hover:border-[#9F5F68]"
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {/* Free-text description input */}
      <div className="flex items-center gap-1.5 pt-0.5">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitText();
          }}
          placeholder={hint}
          disabled={disabled}
          className="flex-1 min-w-0 bg-white text-[11px] text-[#2D2525] px-2.5 py-2 rounded-xl placeholder:text-[#B7A6A4] border border-[#E7D6D2] focus:outline-none focus:border-[#9F5F68] transition-all disabled:opacity-60"
        />
        <button
          onClick={submitText}
          disabled={disabled || !text.trim()}
          className="w-9 h-9 shrink-0 rounded-xl bg-[#9F5F68] text-white flex items-center justify-center hover:bg-[#8a4f57] transition-all disabled:opacity-40"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </div>

      {selectedTags.length > 0 && (
        <p className="text-[10px] text-[#9F5F68] font-medium">
          文字タグ選択中: {selectedTags.join(" / ")}。最終生成時にプロンプトへ反映します。
        </p>
      )}

      {busy && (
        <p className="text-[10px] text-[#9F5F68] font-medium animate-pulse">処理中...</p>
      )}
    </div>
  );
}
