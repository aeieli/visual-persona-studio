import React, { useMemo, useState } from "react";
import { StylePreference } from "../types";
import { Check, ChevronLeft, ChevronRight, Flower2, Gem, Layers3, Palette, Sparkles, Wand2 } from "lucide-react";

interface PreferencesStepProps {
  onNext: (preferences: StylePreference) => void;
  initialData?: StylePreference;
}

const WARDROBE_TASTE_OPTIONS = [
  { name: "きれいめ上品", desc: "清潔感、細いライン、落ち着いた華やかさ" },
  { name: "淡色フェミニン", desc: "柔らかい色、軽い素材、自然な余白" },
  { name: "都会的ミニマル", desc: "低彩度、直線、洗練された抜け感" },
  { name: "ナチュラルシック", desc: "リネン感、肌なじみ、心地よい実用性" },
  { name: "和モダン", desc: "奥行きのある色、控えめな柄、凛とした品" },
  { name: "モードカジュアル", desc: "黒を効かせた曲線、余裕のあるシルエット" },
];

const MOOD_OPTIONS = [
  "通勤に使いやすい",
  "休日カフェ",
  "デート",
  "ギャラリー巡り",
  "小旅行",
  "大人っぽく見せたい",
  "やさしく見せたい",
  "写真映え",
];

const COLOR_OPTIONS = [
  { name: "白 / アイボリー", swatch: "#F8F3EC" },
  { name: "桜ピンク", swatch: "#F3CBD0" },
  { name: "モーヴ", swatch: "#B87986" },
  { name: "セージグリーン", swatch: "#AFC5B3" },
  { name: "グレージュ", swatch: "#C7BAB3" },
  { name: "ネイビー", swatch: "#26384E" },
  { name: "チャコール", swatch: "#3D3838" },
  { name: "差し色レッド", swatch: "#A94E5A" },
];

const TEXTURE_OPTIONS = [
  "落ち感",
  "軽い透け感",
  "ニット",
  "リネン",
  "ツヤ素材",
  "レザー小物",
  "体型カバー",
  "ウエスト強調",
];

const STEPS = [
  { title: "衣品", icon: Layers3 },
  { title: "雰囲気", icon: Flower2 },
  { title: "色系", icon: Palette },
];

const CLOUD_VARIANTS = [
  { size: "text-base", pad: "px-5 py-3.5", rotate: "-rotate-2", offset: "mt-3", width: "basis-[58%] sm:basis-[36%]" },
  { size: "text-sm", pad: "px-4 py-2.5", rotate: "rotate-1", offset: "mt-0", width: "basis-[40%] sm:basis-[24%]" },
  { size: "text-lg", pad: "px-6 py-4", rotate: "rotate-2", offset: "mt-5", width: "basis-[64%] sm:basis-[32%]" },
  { size: "text-xs", pad: "px-3.5 py-2.5", rotate: "-rotate-1", offset: "mt-1", width: "basis-[36%] sm:basis-[20%]" },
  { size: "text-sm", pad: "px-5 py-3", rotate: "rotate-[-3deg]", offset: "mt-6", width: "basis-[52%] sm:basis-[30%]" },
  { size: "text-base", pad: "px-4 py-3", rotate: "rotate-[2deg]", offset: "mt-2", width: "basis-[44%] sm:basis-[26%]" },
  { size: "text-xs", pad: "px-4 py-2", rotate: "rotate-[1deg]", offset: "mt-4", width: "basis-[48%] sm:basis-[22%]" },
  { size: "text-sm", pad: "px-5 py-3.5", rotate: "-rotate-2", offset: "mt-0", width: "basis-[54%] sm:basis-[28%]" },
];

function toggleLimited(value: string, values: string[], limit: number) {
  if (values.includes(value)) return values.filter((item) => item !== value);
  if (values.length >= limit) return values;
  return [...values, value];
}

function cloudVariant(index: number) {
  return CLOUD_VARIANTS[index % CLOUD_VARIANTS.length];
}

export default function PreferencesStep({ onNext, initialData }: PreferencesStepProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [wardrobeTaste, setWardrobeTaste] = useState<string[]>(
    initialData?.wardrobeTaste?.length ? initialData.wardrobeTaste : []
  );
  const [moodTags, setMoodTags] = useState<string[]>(
    initialData?.moodTags?.length ? initialData.moodTags : []
  );
  const [colorPalette, setColorPalette] = useState<string[]>(
    initialData?.colorPalette?.length ? initialData.colorPalette : []
  );
  const [textureTags, setTextureTags] = useState<string[]>(
    initialData?.textureTags?.length ? initialData.textureTags : []
  );

  const selectedSummary = useMemo(
    () => [...wardrobeTaste, ...moodTags, ...colorPalette, ...textureTags],
    [wardrobeTaste, moodTags, colorPalette, textureTags]
  );

  const canContinue =
    (stepIndex === 0 && wardrobeTaste.length > 0) ||
    (stepIndex === 1 && moodTags.length > 0) ||
    (stepIndex === 2 && colorPalette.length > 0);

  const buildPreferences = (): StylePreference => ({
    gender: "auto",
    age: "auto",
    style: `${wardrobeTaste.join(" / ")} · ${moodTags.join("、")} · 色系: ${colorPalette.join("、")}`,
    occupation: "画像から推定 / ライフスタイルタグ",
    hobbies: [...moodTags, ...colorPalette, ...textureTags],
    wardrobeTaste,
    moodTags,
    colorPalette,
    textureTags,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canContinue) return;
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((current) => current + 1);
      return;
    }
    onNext(buildPreferences());
  };

  const CurrentIcon = STEPS[stepIndex].icon;

  return (
    <div id="pref-step-container" className="max-w-5xl mx-auto py-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-white/72 text-[#9B5A66] px-3 py-1 rounded-full text-xs font-semibold mb-3 border border-[#E7C5C7] shadow-sm backdrop-blur">
          <Sparkles className="w-3.5 h-3.5" />
          好みだけを選ぶスタイル診断
        </div>
        <h2 className="text-3xl sm:text-4xl font-serif text-[#2D2525] tracking-normal">衣品・雰囲気・色で、なりたい印象を整える</h2>
        <p className="text-sm text-[#756665] mt-3 max-w-2xl mx-auto leading-relaxed">
          性別や年齢は写真から自動で読み取り、ここでは服の方向性・シーン・色系だけをタグで選びます。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="jp-glass p-5 sm:p-8 rounded-[28px]">
        <div className="mb-7">
          <div className="mb-3 flex items-center justify-between text-[11px] font-semibold tracking-[0.16em] text-[#9B7470]">
            <span>STEP {stepIndex + 1} / {STEPS.length}</span>
            <span>{STEPS[stepIndex].title}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === stepIndex;
            const isDone = index < stepIndex;
            return (
              <div
                key={step.title}
                className={`flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? "border-[#C9828C] bg-[#FFF1F3] text-[#7D3F4A] shadow-sm"
                    : isDone
                    ? "border-[#BFD2C2] bg-[#EEF5EE] text-[#47684F]"
                    : "border-[#E7D6D2] bg-white/62 text-[#8F7B79]"
                }`}
              >
                {isDone ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                {index + 1}. {step.title}
              </div>
            );
          })}
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white/70 border border-[#E7D6D2] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#9F5F68] via-[#C98891] to-[#8DA895] transition-all"
              style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="min-h-[360px]">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-10 h-10 rounded-full bg-[#FFF1F3] text-[#9F5F68] border border-[#EBCDD0] flex items-center justify-center">
              <CurrentIcon className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-serif text-xl text-[#2D2525]">{STEPS[stepIndex].title}を選択</h3>
              <p className="text-xs text-[#756665] mt-0.5">
                {stepIndex === 0 && "最大3つ。服選びの軸になる好みを選んでください。"}
                {stepIndex === 1 && "最大4つ。普段のシーンや見せたい印象を選びます。"}
                {stepIndex === 2 && "色は最大4つ、素材/シルエットは最大4つまで選べます。"}
              </p>
            </div>
          </div>

          {stepIndex === 0 && (
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-[28px] bg-white/34 p-4 sm:p-5">
              {WARDROBE_TASTE_OPTIONS.map((option, index) => {
                const isSelected = wardrobeTaste.includes(option.name);
                const variant = cloudVariant(index);
                return (
                  <button
                    key={option.name}
                    type="button"
                    onClick={() => setWardrobeTaste(toggleLimited(option.name, wardrobeTaste, 3))}
                    className={`${variant.width} min-w-[138px] ${variant.offset} ${variant.rotate} ${variant.pad} rounded-full border text-left transition-all relative overflow-hidden hover:rotate-0 hover:-translate-y-0.5 ${
                      isSelected
                        ? "border-[#C9828C] bg-gradient-to-br from-[#FFF1F3] to-[#F5FAF3] ring-2 ring-[#DFAAB0]/24 shadow-sm"
                        : "border-[#E7D6D2] hover:border-[#D9A7AC] bg-white/78"
                    }`}
                  >
                    <div className={`font-semibold ${variant.size} text-[#2D2525]`}>{option.name}</div>
                    <div className="text-xs text-[#756665] mt-1 leading-relaxed">{option.desc}</div>
                    {isSelected && (
                      <span className="absolute right-3 top-3 bg-[#9F5F68] text-white p-0.5 rounded-full">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {stepIndex === 1 && (
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-[28px] bg-white/34 p-4 sm:p-6 min-h-[240px]">
              {MOOD_OPTIONS.map((tag, index) => {
                const isSelected = moodTags.includes(tag);
                const variant = cloudVariant(index + 2);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setMoodTags(toggleLimited(tag, moodTags, 4))}
                    className={`${variant.width} min-w-[128px] ${variant.offset} ${variant.rotate} ${variant.pad} ${variant.size} rounded-full transition-all border text-center hover:rotate-0 hover:-translate-y-0.5 ${
                      isSelected
                        ? "border-[#C9828C] bg-[#FFF1F3] text-[#7D3F4A] font-semibold shadow-sm"
                        : "border-[#E7D6D2] hover:border-[#D9A7AC] bg-white/72 text-[#655756]"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}

          {stepIndex === 2 && (
            <div className="space-y-7">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-[#3A3030]">好きな色系</h4>
                  <span className="text-xs text-[#9B7470]">選択済み {colorPalette.length}/4</span>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-[28px] bg-white/34 p-4 sm:p-5">
                  {COLOR_OPTIONS.map((color, index) => {
                    const isSelected = colorPalette.includes(color.name);
                    const variant = cloudVariant(index + 4);
                    return (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() => setColorPalette(toggleLimited(color.name, colorPalette, 4))}
                        className={`${variant.width} min-w-[140px] ${variant.offset} ${variant.rotate} ${variant.pad} flex items-center justify-center gap-2 rounded-full border text-center ${variant.size} transition-all hover:rotate-0 hover:-translate-y-0.5 ${
                          isSelected
                            ? "border-[#C9828C] bg-[#FFF1F3] text-[#7D3F4A] font-semibold"
                            : "border-[#E7D6D2] bg-white/72 text-[#655756] hover:border-[#D9A7AC]"
                        }`}
                      >
                        <span className="w-6 h-6 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: color.swatch }} />
                        {color.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-[#3A3030]">素材・シルエット</h4>
                  <span className="text-xs text-[#9B7470]">選択済み {textureTags.length}/4</span>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-[28px] bg-white/34 p-4 sm:p-5">
                  {TEXTURE_OPTIONS.map((tag, index) => {
                    const isSelected = textureTags.includes(tag);
                    const variant = cloudVariant(index + 1);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setTextureTags(toggleLimited(tag, textureTags, 4))}
                        className={`${variant.width} min-w-[118px] ${variant.offset} ${variant.rotate} ${variant.pad} ${variant.size} rounded-full transition-all border text-center hover:rotate-0 hover:-translate-y-0.5 ${
                          isSelected
                            ? "border-[#8DA895] bg-[#EEF5EE] text-[#47684F] font-semibold"
                            : "border-[#E7D6D2] hover:border-[#BFD2C2] bg-white/72 text-[#655756]"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-7 border-t border-[#E7D6D2] pt-5">
          <div className="mb-4 flex flex-wrap gap-2">
            {selectedSummary.slice(0, 10).map((item) => (
              <span key={item} className="text-[11px] bg-white/72 text-[#7D6664] border border-[#E7D6D2] rounded-full px-2.5 py-1">
                {item}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
              disabled={stepIndex === 0}
              className="sm:w-40 border border-[#E7D6D2] bg-white/70 text-[#7D6664] font-semibold py-3 px-5 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              戻る
            </button>
            <button
              type="submit"
              disabled={!canContinue}
              className="jp-primary-button flex-1 font-semibold py-3 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {stepIndex < STEPS.length - 1 ? (
                <>
                  次へ
                  <ChevronRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <Gem className="w-4.5 h-4.5" />
                  保存して写真アップロードへ
                </>
              )}
            </button>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-[#9B7470]">
            <Wand2 className="w-3.5 h-3.5 text-[#7FA48A]" />
            性別・年齢印象は次の写真分析で自動推定します
          </div>
        </div>
      </form>
    </div>
  );
}
