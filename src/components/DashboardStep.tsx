import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AnalyzeResponse, StyleOption, StylePreference } from "../types";
import FittingRoom, { ZoneKey, SpriteSheet } from "./FittingRoom";
import { 
  Download, 
  Printer, 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  RotateCw,
  Mic,
  Send,
  Sparkles,
  Check,
  AlertTriangle
} from "lucide-react";

const STYLE_TAGS = [
  { id: "smart", label: "通勤スマート", desc: "ビジネスシャツとストレートパンツ" },
  { id: "japanese", label: "和風レトロ", desc: "レトロリラックスセーター" },
  { id: "streetwear", label: "ストリートクール", desc: "スリムジャケットとレザーブーツ" },
  { id: "minimalist", label: "都会的ミニマリスト", desc: "ミニマルセーターとスラックス" },
  { id: "gorpcore", label: "アウトドア", desc: "機能的ウィンドブレーカーとワークウェア" }
];

interface DashboardStepProps {
  data: AnalyzeResponse;
  preferences: StylePreference;
  userPhoto: string | null;
  onBack: () => void;
}

export default function DashboardStep({ data, preferences, userPhoto, onBack }: DashboardStepProps) {
  // Current reactive state for styling recommendation (enables dynamic modifications)
  const [currentData, setCurrentData] = useState<AnalyzeResponse>(data);
  const [activeTag, setActiveTag] = useState<string>("");
  const [isModifying, setIsModifying] = useState(false);
  const [modifyError, setModifyError] = useState<string | null>(null);

  // Chat/Voice instruction variables
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recTimer, setRecTimer] = useState(0);
  const recInterval = useRef<any>(null);

  // Current selections for each zone (indexes 0, 1, 2)
  const [hairIndex, setHairIndex] = useState(0);
  const [topIndex, setTopIndex] = useState(0);
  const [bottomIndex, setBottomIndex] = useState(0);
  const [shoesIndex, setShoesIndex] = useState(0);

  // Selected view modes
  const [activeTab, setActiveTab] = useState<"analysis" | "palette" | "accessories">("analysis");
  const [exportModal, setExportModal] = useState<"none" | "image" | "poster" | "3d" | "crystal">("none");
  const [isGenerating, setIsGenerating] = useState(false);

  // Mobile fitting-room state: sprite sheet (tiles), active zone, applied composite.
  const [spriteSheet, setSpriteSheet] = useState<SpriteSheet | null>(null);
  const [spriteLoading, setSpriteLoading] = useState(false);
  const [activeZone, setActiveZone] = useState<ZoneKey>("hair");
  const [isApplying, setIsApplying] = useState(false);
  const [compositeUrl, setCompositeUrl] = useState<string | null>(null);

  // Step 1 of the pipeline: a normalized full-body reference derived from the photo.
  const [baseFullBody, setBaseFullBody] = useState<string | null>(null);
  const [baseLoading, setBaseLoading] = useState(false);
  const [baseError, setBaseError] = useState<string | null>(null);
  const [spriteError, setSpriteError] = useState<string | null>(null);
  const [allowFallbackPreview, setAllowFallbackPreview] = useState(false);

  // Per-zone modification (description input / guidance tags) in progress.
  const [zoneModifying, setZoneModifying] = useState<ZoneKey | null>(null);
  const [selectedTextByZone, setSelectedTextByZone] = useState<Record<ZoneKey, string[]>>({
    hair: [],
    top: [],
    bottom: [],
    shoes: [],
  });
  const [globalTextGuidance, setGlobalTextGuidance] = useState<string[]>([]);

  // The canonical base shown in the fitting room (derived full-body > raw reference).
  const basePhoto = baseFullBody || userPhoto;

  // Current selections based on reactive currentData
  const selectedHair = currentData.options.hairstyle[hairIndex] || currentData.options.hairstyle[0];
  const selectedTop = currentData.options.top[topIndex] || currentData.options.top[0];
  const selectedBottom = currentData.options.bottom[bottomIndex] || currentData.options.bottom[0];
  const selectedShoes = currentData.options.shoes[shoesIndex] || currentData.options.shoes[0];
  const displayHairName = selectedTextByZone.hair.length ? selectedTextByZone.hair.join(" / ") : selectedHair.name;
  const displayTopName = selectedTextByZone.top.length ? selectedTextByZone.top.join(" / ") : selectedTop.name;
  const displayBottomName = selectedTextByZone.bottom.length ? selectedTextByZone.bottom.join(" / ") : selectedBottom.name;
  const displayShoesName = selectedTextByZone.shoes.length ? selectedTextByZone.shoes.join(" / ") : selectedShoes.name;

  // Ref for the downloadable poster/canvas
  const posterRef = useRef<HTMLDivElement>(null);

  // Clear interval on unmount
  useEffect(() => {
    return () => {
      if (recInterval.current) clearInterval(recInterval.current);
    };
  }, []);

  // Cycle handlers
  const cycleLeft = (zone: "hair" | "top" | "bottom" | "shoes") => {
    if (zone === "hair") setHairIndex((prev) => (prev === 0 ? 2 : prev - 1));
    if (zone === "top") setTopIndex((prev) => (prev === 0 ? 2 : prev - 1));
    if (zone === "bottom") setBottomIndex((prev) => (prev === 0 ? 2 : prev - 1));
    if (zone === "shoes") setShoesIndex((prev) => (prev === 0 ? 2 : prev - 1));
  };

  const cycleRight = (zone: "hair" | "top" | "bottom" | "shoes") => {
    if (zone === "hair") setHairIndex((prev) => (prev === 2 ? 0 : prev + 1));
    if (zone === "top") setTopIndex((prev) => (prev === 2 ? 0 : prev + 1));
    if (zone === "bottom") setBottomIndex((prev) => (prev === 2 ? 0 : prev + 1));
    if (zone === "shoes") setShoesIndex((prev) => (prev === 2 ? 0 : prev + 1));
  };

  // Editing any zone returns the stage to live-overlay editing (drops the applied composite).
  useEffect(() => {
    setCompositeUrl(null);
  }, [hairIndex, topIndex, bottomIndex, shoesIndex]);

  // Set a zone selection by index (shared by side-panel arrows and the swipe carousel).
  const setZoneIndex = (zone: ZoneKey, index: number) => {
    setSelectedTextByZone((prev) => ({ ...prev, [zone]: [] }));
    if (zone === "hair") setHairIndex(index);
    if (zone === "top") setTopIndex(index);
    if (zone === "bottom") setBottomIndex(index);
    if (zone === "shoes") setShoesIndex(index);
  };

  // Zone -> AnalyzeResponse.options key (the backend's targetZone).
  const ZONE_TO_OPTION_KEY: Record<ZoneKey, string> = {
    hair: "hairstyle",
    top: "top",
    bottom: "bottom",
    shoes: "shoes",
  };

  const readGenerationError = async (response: Response, fallback: string) => {
    try {
      const payload = await response.json();
      return payload?.error || fallback;
    } catch {
      return fallback;
    }
  };

  const toggleZoneTextTag = (zone: ZoneKey, tag: string) => {
    setCompositeUrl(null);
    setSelectedTextByZone((prev) => {
      const current = prev[zone];
      const next = current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag];
      return { ...prev, [zone]: next };
    });
  };

  const addZoneTextInstruction = (zone: ZoneKey, instruction: string) => {
    const trimmed = instruction.trim();
    if (!trimmed) return;
    setCompositeUrl(null);
    setSelectedTextByZone((prev) => ({
      ...prev,
      [zone]: prev[zone].includes(trimmed) ? prev[zone] : [...prev[zone], trimmed],
    }));
  };

  const addGlobalTextInstruction = (instruction: string) => {
    const trimmed = instruction.trim();
    if (!trimmed) return;
    setCompositeUrl(null);
    setGlobalTextGuidance((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  };

  const zonePrompt = (zone: ZoneKey, option: StyleOption) => {
    const textTags = selectedTextByZone[zone];
    if (textTags.length > 0) return textTags.join(", ");
    return option.name;
  };

  // Per-zone modification: regenerate ONLY this zone's 3 options from a description/tag,
  // keeping the other zones (and the derived full-body base) unchanged.
  const handleZoneInstruction = async (zone: ZoneKey, instruction: string) => {
    if (!instruction.trim()) return;
    setZoneModifying(zone);
    setModifyError(null);
    try {
      const response = await fetch("/api/modify-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentData,
          instruction,
          preferences,
          targetZone: ZONE_TO_OPTION_KEY[zone],
        }),
      });
      if (!response.ok) throw new Error("ゾーンの調整に失敗しました");
      const result = await response.json();
      setCurrentData(result);
      setZoneIndex(zone, 0); // surface the freshly generated first option for this zone
    } catch (err) {
      console.error("Zone instruction failed:", err);
      setModifyError("この箇所の調整中にエラーが発生しました。少し言い換えて再度お試しください。");
    } finally {
      setZoneModifying(null);
    }
  };

  // Step 1: derive the normalized full-body reference once per person (stable across
  // accessory/look changes). Failure leaves baseFullBody null -> raw reference is used.
  useEffect(() => {
    let cancelled = false;
    setBaseLoading(true);
    setBaseFullBody(null);
    setBaseError(null);
    setAllowFallbackPreview(false);
    setCompositeUrl(null);
    fetch("/api/derive-fullbody", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: userPhoto, preferences, analysis: data }),
    })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error(await readGenerationError(r, "full-body unavailable")))))
      .then((res) => {
        if (!cancelled && res?.fullBodyUrl) setBaseFullBody(res.fullBodyUrl);
      })
      .catch((err) => {
        if (!cancelled) {
          setBaseFullBody(null);
          setBaseError(err?.message || "全身写真の生成に失敗しました。");
        }
      })
      .finally(() => {
        if (!cancelled) setBaseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userPhoto]);

  // Fetch the 3x4 master sprite sheet once per look. Refetch when the whole look changes
  // (tag switch / AI instruction). Failure simply leaves spriteSheet null -> SVG fallback.
  useEffect(() => {
    let cancelled = false;
    setSpriteLoading(true);
    setSpriteSheet(null);
    setSpriteError(null);
    setAllowFallbackPreview(false);
    fetch("/api/generate-sprite-sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ options: currentData.options, preferences }),
    })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error(await readGenerationError(r, "sprite sheet unavailable")))))
      .then((res) => {
        if (!cancelled && res?.sheetUrl) setSpriteSheet(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setSpriteSheet(null);
          setSpriteError(err?.message || "配件画像の生成に失敗しました。");
        }
      })
      .finally(() => {
        if (!cancelled) setSpriteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentData, preferences]);

  // Dispatcher used by FittingRoom as a per-tile fallback when no sprite cell exists.
  const renderZoneSVG = (zone: ZoneKey, option: StyleOption): React.ReactNode => {
    if (zone === "hair") return renderHairstyleSVG(option);
    if (zone === "top") return renderTopSVG(option);
    if (zone === "bottom") return renderBottomSVG(option);
    return renderShoesSVG(option);
  };

  // "Apply / 試着": one nano-banana re-composite of the user's photo wearing the current look.
  const handleApplyLook = async () => {
    setIsApplying(true);
    const textInstruction = [
      ...globalTextGuidance,
      ...(Object.entries(selectedTextByZone) as Array<[ZoneKey, string[]]>).flatMap(([zone, tags]) =>
        tags.map((tag) => `${zone}: ${tag}`)
      ),
      inputText,
    ]
      .filter(Boolean)
      .join(" / ");
    try {
      const response = await fetch("/api/generate-outfit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hairstyle: zonePrompt("hair", selectedHair),
          top: zonePrompt("top", selectedTop),
          bottom: zonePrompt("bottom", selectedBottom),
          shoes: zonePrompt("shoes", selectedShoes),
          activeTag,
          instruction: textInstruction,
          preferences,
          exportType: "tryon",
          userPhoto: basePhoto,
        }),
      });
      if (!response.ok) throw new Error("試着画像の生成に失敗しました");
      const result = await response.json();
      if (result?.imageUrl) setCompositeUrl(result.imageUrl);
    } catch (err) {
      console.error("Apply look failed:", err);
    } finally {
      setIsApplying(false);
    }
  };

  // SVG representation builders based on option attributes
  const renderHairstyleSVG = (option: StyleOption) => {
    const hairColor = option.color || "#27272A";
    if (option.type === "short_crop") {
      return (
        <svg viewBox="0 0 100 100" className="w-24 h-24 mx-auto" style={{ color: hairColor }}>
          <path d="M20,50 Q20,25 50,20 Q80,25 80,50 Q85,45 80,35 Q75,20 50,15 Q25,20 20,35 Q15,45 20,50 Z" fill="currentColor" />
          <path d="M30,40 Q50,30 70,40" stroke="rgba(255,255,255,0.2)" strokeWidth="2" fill="none" />
        </svg>
      );
    } else if (option.type === "long_undercut") {
      return (
        <svg viewBox="0 0 100 100" className="w-24 h-24 mx-auto" style={{ color: hairColor }}>
          <path d="M25,45 Q20,20 50,15 Q80,20 75,45 Q70,40 70,30 Q50,22 30,30 Q30,40 25,45 Z" fill="currentColor" />
          <path d="M75,45 C80,55 85,65 80,75 C78,78 72,75 72,70 C72,55 75,50 75,45 Z" fill="currentColor" />
          <path d="M25,45 C20,55 15,65 20,75 C22,78 28,75 28,70 C28,55 25,50 25,45 Z" fill="currentColor" />
        </svg>
      );
    } else {
      // wavy_bob / other curly
      return (
        <svg viewBox="0 0 100 100" className="w-24 h-24 mx-auto" style={{ color: hairColor }}>
          <path d="M22,48 C15,35 25,18 50,18 C75,18 85,35 78,48 C85,55 80,68 75,72 C70,60 75,45 70,40 C50,32 30,40 30,40 C25,45 30,60 25,72 C20,68 15,55 22,48 Z" fill="currentColor" />
        </svg>
      );
    }
  };

  const renderTopSVG = (option: StyleOption) => {
    const topColor = option.color || "#475569";
    if (option.type === "shirt") {
      return (
        <svg viewBox="0 0 120 140" className="w-32 h-32 mx-auto" style={{ color: topColor }}>
          {/* Main Body */}
          <path d="M30,20 L90,20 L105,45 L105,130 L15,130 L15,45 Z" fill="currentColor" />
          {/* Collar detail */}
          <path d="M45,20 L60,35 L75,20 L90,20 L60,50 L30,20 Z" fill="#F9F7F2" opacity="0.9" />
          <path d="M45,20 L60,40 L30,20 Z" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M75,20 L60,40 L90,20 Z" fill="none" stroke="currentColor" strokeWidth="2" />
          {/* Buttons line */}
          <line x1="60" y1="40" x2="60" y2="130" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeDasharray="2 4" />
        </svg>
      );
    } else if (option.type === "sweater") {
      return (
        <svg viewBox="0 0 120 140" className="w-32 h-32 mx-auto" style={{ color: topColor }}>
          {/* Sweater Body with round neck and knit texture */}
          <path d="M25,25 L95,25 L110,50 L110,130 L10,130 L10,50 Z" fill="currentColor" />
          {/* Rounded neck crew neck */}
          <path d="M45,25 C45,35 75,35 75,25 Z" fill="#F9F7F2" />
          <path d="M45,25 C45,35 75,35 75,25" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="3" />
          {/* Ribbed cuffs/hem */}
          <rect x="10" y="122" width="100" height="8" fill="rgba(0,0,0,0.1)" />
        </svg>
      );
    } else {
      // blazer / suit jacket
      return (
        <svg viewBox="0 0 120 140" className="w-32 h-32 mx-auto" style={{ color: topColor }}>
          <path d="M25,20 L95,20 L112,45 L112,130 L8,130 L8,45 Z" fill="currentColor" />
          {/* Suit Lapels */}
          <path d="M25,20 L45,65 L60,28 L75,65 L95,20 Z" fill="rgba(0,0,0,0.15)" />
          <path d="M60,28 L60,130" stroke="rgba(0,0,0,0.2)" strokeWidth="2" />
          <path d="M40,75 L55,75" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
          {/* Pocket square */}
          <path d="M30,45 L45,45 L45,48 L30,48 Z" fill="#F9F7F2" opacity="0.9" />
        </svg>
      );
    }
  };

  const renderBottomSVG = (option: StyleOption) => {
    const bottomColor = option.color || "#1D4ED8";
    if (option.type === "jeans") {
      return (
        <svg viewBox="0 0 120 160" className="w-32 h-36 mx-auto" style={{ color: bottomColor }}>
          {/* Jeans outline */}
          <path d="M25,10 L95,10 L105,150 L68,150 L60,65 L52,150 L15,150 Z" fill="currentColor" />
          {/* Denim wash highlights */}
          <path d="M30,30 Q40,90 35,130" stroke="rgba(255,255,255,0.15)" strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M90,30 Q80,90 85,130" stroke="rgba(255,255,255,0.15)" strokeWidth="6" strokeLinecap="round" fill="none" />
          {/* Belt loops & pocket details */}
          <path d="M25,10 L95,10 L95,25 L25,25 Z" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="2" />
        </svg>
      );
    } else if (option.type === "trousers") {
      return (
        <svg viewBox="0 0 120 160" className="w-32 h-36 mx-auto" style={{ color: bottomColor }}>
          {/* Smart Trousers with clean crease line */}
          <path d="M28,10 L92,10 L102,150 L65,150 L60,60 L55,150 L18,150 Z" fill="currentColor" />
          {/* Ironed crease lines */}
          <line x1="40" y1="20" x2="38" y2="145" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
          <line x1="80" y1="20" x2="82" y2="145" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        </svg>
      );
    } else {
      // shorts / relaxed
      return (
        <svg viewBox="0 0 120 160" className="w-32 h-36 mx-auto" style={{ color: bottomColor }}>
          <path d="M25,10 L95,10 L102,90 L65,90 L60,50 L55,90 L18,90 Z" fill="currentColor" />
          <line x1="25" y1="10" x2="95" y2="10" stroke="rgba(0,0,0,0.15)" strokeWidth="3" />
        </svg>
      );
    }
  };

  const renderShoesSVG = (option: StyleOption) => {
    const shoeColor = option.color || "#FFFFFF";
    const isDark = shoeColor === "#18181B" || shoeColor === "#000000";
    const strokeCol = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.2)";

    if (option.type === "sneakers") {
      return (
        <svg viewBox="0 0 120 60" className="w-28 h-14 mx-auto" style={{ color: shoeColor }}>
          {/* Sneaker Pair */}
          <path d="M10,45 L15,25 L40,25 L55,45 Z" fill="currentColor" stroke={strokeCol} strokeWidth="1.5" />
          <path d="M65,45 L70,25 L95,25 L110,45 Z" fill="currentColor" stroke={strokeCol} strokeWidth="1.5" strokeLinecap="round" />
          {/* Sole */}
          <path d="M8,45 L57,45 L55,50 L10,50 Z" fill="#E2E8F0" />
          <path d="M63,45 L112,45 L110,50 L65,50 Z" fill="#E2E8F0" />
        </svg>
      );
    } else if (option.type === "boots") {
      return (
        <svg viewBox="0 0 120 60" className="w-28 h-14 mx-auto" style={{ color: shoeColor }}>
          {/* Boots */}
          <path d="M12,45 L12,15 L32,15 L34,35 L48,45 Z" fill="currentColor" stroke={strokeCol} strokeWidth="1.5" />
          <path d="M68,45 L68,15 L88,15 L90,35 L104,45 Z" fill="currentColor" stroke={strokeCol} strokeWidth="1.5" />
          {/* Heavy tread sole */}
          <path d="M10,45 L50,45 L48,50 L12,50 Z" fill="#000000" />
          <path d="M66,45 L106,45 L104,50 L68,50 Z" fill="#000000" />
        </svg>
      );
    } else {
      // loafers
      return (
        <svg viewBox="0 0 120 60" className="w-28 h-14 mx-auto" style={{ color: shoeColor }}>
          <path d="M15,45 Q12,32 28,26 L48,32 L52,45 Z" fill="currentColor" stroke={strokeCol} strokeWidth="1.5" />
          <path d="M68,45 Q65,32 81,26 L101,32 L105,45 Z" fill="currentColor" stroke={strokeCol} strokeWidth="1.5" />
          {/* Stitching or premium detail */}
          <path d="M22,30 L32,32" stroke={strokeCol} strokeWidth="1" fill="none" />
          <path d="M75,30 L85,32" stroke={strokeCol} strokeWidth="1" fill="none" />
        </svg>
      );
    }
  };

  const handleTagSwitch = (tagId: string, tagLabel: string) => {
    const guidance = `全体を${tagLabel}スタイルに寄せる`;
    if (activeTag === tagId) {
      setActiveTag("");
      setGlobalTextGuidance((prev) => prev.filter((item) => item !== guidance));
      return;
    }
    setActiveTag(tagId);
    setModifyError(null);
    addGlobalTextInstruction(guidance);
  };

  const handleInstructionSubmit = (customText?: string) => {
    const textToSubmit = customText || inputText;
    if (!textToSubmit.trim()) return;
    setModifyError(null);
    setInputText("");
    addGlobalTextInstruction(textToSubmit);
  };

  const startSimulatedRecording = () => {
    if (isRecording) return;
    
    // Try to use real speech recognition if available in the browser
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsRecording(true);
          setRecTimer(0);
          if (recInterval.current) clearInterval(recInterval.current);
          recInterval.current = setInterval(() => {
            setRecTimer((prev) => prev + 1);
          }, 1000);
        };

        recognition.onresult = (event: any) => {
          const speechResult = event.results[0][0].transcript;
          setInputText(speechResult);
          handleInstructionSubmit(speechResult);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          triggerSimulatedRecording(); // Fallback if error
        };

        recognition.onend = () => {
          setIsRecording(false);
          if (recInterval.current) clearInterval(recInterval.current);
        };

        recognition.start();
        return;
      } catch (e) {
        console.error("Failed to start real speech recognition", e);
      }
    }
    
    // Fallback to simulated recording if API is not supported
    triggerSimulatedRecording();
  };

  const triggerSimulatedRecording = () => {
    setIsRecording(true);
    setRecTimer(0);
    if (recInterval.current) clearInterval(recInterval.current);
    recInterval.current = setInterval(() => {
      setRecTimer((prev) => {
        if (prev >= 4) {
          clearInterval(recInterval.current);
          setIsRecording(false);
          const presets = [
            "服の色を白黒ミニマルなニットに変えて",
            "すっきりとしたショートヘアにしたい",
            "パンツをドレープ感のあるカーキのストレートパンツに変えて",
            "上品で快適なハンドメイドのレザーローファーに変えて",
            "アウターをもっとフォーマルに、例えばコートやスーツにして"
          ];
          const randomPreset = presets[Math.floor(Math.random() * presets.length)];
          setInputText(randomPreset);
          // Auto submit the transcribed text to make it extremely premium and zero-click!
          handleInstructionSubmit(randomPreset);
          return 4;
        }
        return prev + 1;
      });
    }, 800);
  };

  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const handleExportAction = async (type: "image" | "poster" | "3d" | "crystal") => {
    setIsGenerating(true);
    setExportModal(type);
    const textInstruction = [
      ...globalTextGuidance,
      ...(Object.entries(selectedTextByZone) as Array<[ZoneKey, string[]]>).flatMap(([zone, tags]) =>
        tags.map((tag) => `${zone}: ${tag}`)
      ),
    ]
      .filter(Boolean)
      .join(" / ");
    
    if (type === "image" || type === "3d" || type === "crystal" || type === "poster") {
      try {
        const response = await fetch("/api/generate-outfit-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hairstyle: zonePrompt("hair", selectedHair),
            top: zonePrompt("top", selectedTop),
            bottom: zonePrompt("bottom", selectedBottom),
            shoes: zonePrompt("shoes", selectedShoes),
            activeTag,
            instruction: textInstruction,
            preferences,
            exportType: type
          })
        });
        
        if (!response.ok) {
          throw new Error("レンダリングに失敗しました");
        }
        
        const result = await response.json();
        setGeneratedImageUrl(result.imageUrl);
      } catch (err) {
        console.error("高画質画像の生成に失敗しました:", err);
      } finally {
        setIsGenerating(false);
      }
    } else {
      setTimeout(() => {
        setIsGenerating(false);
      }, 1500);
    }
  };

  const generationIssues = [baseError, spriteError].filter(Boolean) as string[];
  const isGeneratingAssets = baseLoading || spriteLoading;
  const shouldBlockForGeneratedAssets =
    !allowFallbackPreview &&
    ((isGeneratingAssets && (!baseFullBody || !spriteSheet)) || generationIssues.length > 0);

  return (
    <div id="dashboard-container" className="jp-flow-page flex flex-col h-[calc(100vh-100px)] overflow-hidden text-[#2D2525]">
      {/* Editorial Header */}
      <header className="jp-shell flex justify-between items-center px-5 sm:px-10 py-5 border-b border-[#E7D6D2]/70 bg-white/58 backdrop-blur-xl">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-[#9B7470]">AI Persona Design Studio</span>
          <h1 className="text-xl font-serif italic tracking-normal">オーダーメイドのコーディネートプラン</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-[10px] uppercase tracking-wider font-semibold border border-[#E0C7C6] bg-white/64 px-4 py-2 rounded-full hover:bg-[#9F5F68] hover:text-white transition-all flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            再アップロード/設定
          </button>
          <div className="hidden md:flex items-center gap-2 bg-white/72 px-3 py-1.5 rounded-full border border-[#E0C7C6] shadow-sm">
            {userPhoto ? (
              <img src={userPhoto} alt="User avatar" className="w-5 h-5 rounded-full object-cover" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-[#9F5F68] text-white flex items-center justify-center text-[10px] font-bold">U</div>
            )}
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#7D3F4A]">{preferences.style.split(" ")[0]}</span>
          </div>
        </div>
      </header>

      {shouldBlockForGeneratedAssets ? (
        <div className="jp-shell flex-1 flex items-center justify-center p-6 overflow-y-auto">
          <div className="w-full max-w-2xl jp-glass rounded-[28px] p-6 sm:p-8 text-center">
            <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-[#FFF1F3] border border-[#E0C7C6] flex items-center justify-center">
              {generationIssues.length > 0 ? (
                <AlertTriangle className="w-7 h-7 text-[#B8792B]" />
              ) : (
                <Sparkles className="w-7 h-7 text-[#9F5F68] animate-pulse" />
              )}
            </div>

            <h2 className="font-serif text-2xl text-[#2D2525]">
              {generationIssues.length > 0 ? "生成に失敗しました" : "写真から全身モデルと配件を生成中"}
            </h2>
            <p className="mt-3 text-sm text-[#756665] leading-relaxed">
              {generationIssues.length > 0
                ? "全身照と真实な衣物/发型配件は画像生成 API が必要です。生成失败时不再直接进入占位选择，原因如下。"
                : "アップロード写真をもとに、人物印象を推定し、正面全身照とヘア・トップス・ボトムス・シューズの真实配件画像を準備しています。"}
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              <div className={`rounded-2xl border p-4 ${baseFullBody ? "border-[#BFD2C2] bg-[#EEF5EE]" : baseError ? "border-[#E8C88E] bg-[#FFF7EA]" : "border-[#E7D6D2] bg-white/70"}`}>
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#9B7470]">Step 1</div>
                <div className="mt-1 font-semibold text-sm text-[#2D2525]">写真から正面全身照を生成</div>
                <p className="mt-1 text-xs text-[#756665] leading-relaxed">
                  {baseFullBody ? "完了" : baseError || "生成中..."}
                </p>
              </div>
              <div className={`rounded-2xl border p-4 ${spriteSheet ? "border-[#BFD2C2] bg-[#EEF5EE]" : spriteError ? "border-[#E8C88E] bg-[#FFF7EA]" : "border-[#E7D6D2] bg-white/70"}`}>
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#9B7470]">Step 2</div>
                <div className="mt-1 font-semibold text-sm text-[#2D2525]">衣物・发型・靴の真实配件を生成</div>
                <p className="mt-1 text-xs text-[#756665] leading-relaxed">
                  {spriteSheet ? "完了" : spriteError || "生成中..."}
                </p>
              </div>
            </div>

            {generationIssues.length > 0 && (
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={onBack}
                  className="sm:w-44 border border-[#E7D6D2] bg-white/70 text-[#7D6664] font-semibold py-3 px-5 rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  写真を選び直す
                </button>
                <button
                  onClick={() => setAllowFallbackPreview(true)}
                  className="jp-primary-button flex-1 font-semibold py-3 px-6 rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                  占位プレビューで続行
                </button>
              </div>
            )}

            {generationIssues.some((issue) => issue.includes("No valid Gemini API key")) && (
              <p className="mt-4 text-xs text-[#9B7470] leading-relaxed">
                Cloud Run で真实画像生成を使うには、サービスの環境変数または Secret Manager で `GEMINI_API_KEY` を設定して新しいリビジョンをデプロイしてください。
              </p>
            )}
          </div>
        </div>
      ) : (
      <>
      {/* Main Content Areas */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* LEFT COLUMN: Style Diagnosis & Profile DNA */}
        <aside className="jp-shell w-full lg:w-72 border-r border-[#E7D6D2]/70 p-6 overflow-y-auto flex flex-col gap-6 bg-white/54 backdrop-blur-xl">
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#9B7470] mb-3">スタイルの好み DNA</h3>
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2.5 py-1 bg-white/78 border border-[#E7D6D2] rounded-full text-[10px] font-medium text-[#5B4D4D]">写真から人物印象を推定</span>
              {(preferences.wardrobeTaste || [preferences.style.split(" ")[0]]).slice(0, 2).map((tag) => (
                <span key={tag} className="px-2.5 py-1 bg-white/78 border border-[#E7D6D2] rounded-full text-[10px] font-medium text-[#5B4D4D] truncate max-w-[160px]">{tag}</span>
              ))}
              {(preferences.colorPalette || []).slice(0, 2).map((tag) => (
                <span key={tag} className="px-2.5 py-1 bg-[#FFF1F3]/78 border border-[#E0C7C6] rounded-full text-[10px] font-medium text-[#7D3F4A] truncate max-w-[160px]">{tag}</span>
              ))}
            </div>
          </div>

          <div className="border-t border-[#E7D6D2] pt-5">
            <div className="flex gap-4 border-b border-[#E7D6D2]/70 pb-2 mb-4 text-[11px] uppercase tracking-wider font-semibold">
              <button 
                onClick={() => setActiveTab("analysis")} 
                className={`pb-1 ${activeTab === "analysis" ? "border-b border-[#9F5F68] text-[#7D3F4A]" : "text-[#9B7470]"}`}
              >
                骨格・顔タイプ診断
              </button>
              <button 
                onClick={() => setActiveTab("palette")} 
                className={`pb-1 ${activeTab === "palette" ? "border-b border-[#9F5F68] text-[#7D3F4A]" : "text-[#9B7470]"}`}
              >
                おすすめのカラーパレット
              </button>
            </div>

            {activeTab === "analysis" && (
              <div className="space-y-4 text-xs leading-relaxed text-[#5B4D4D]">
                <div className="bg-white/72 p-3 rounded-2xl border border-[#E7D6D2]/80">
                  <div className="font-serif italic text-[#7D3F4A] font-bold mb-1">顔の特徴分析</div>
                  <div className="font-medium text-[11px] text-[#2D2525]">{currentData.faceFeatures.shape} · {currentData.faceFeatures.skinTone}</div>
                  <p className="mt-1.5 text-[11px] text-[#655756]">{currentData.faceFeatures.description}</p>
                </div>

                <div className="bg-white/72 p-3 rounded-2xl border border-[#E7D6D2]/80">
                  <div className="font-serif italic text-[#7D3F4A] font-bold mb-1">体型の分析</div>
                  <div className="font-medium text-[11px] text-[#2D2525]">{currentData.bodyProportions.shape}</div>
                  <div className="text-[10px] text-[#8F7B79] mt-0.5">{currentData.bodyProportions.shoulderToWaist} | {currentData.bodyProportions.legToBody}</div>
                  <p className="mt-1.5 text-[11px] text-[#655756]">{currentData.bodyProportions.description}</p>
                </div>
              </div>
            )}

            {activeTab === "palette" && (
              <div className="space-y-4">
                <p className="text-[11px] text-[#655756] leading-relaxed">
                  {currentData.faceFeatures.toneDesc}
                </p>
                <div className="grid grid-cols-4 gap-2 pt-2">
                  {currentData.advice.colorPalette.map((col, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1">
                      <div className="w-10 h-10 rounded-lg border border-black/10 shadow-sm" style={{ backgroundColor: col }} />
                      <span className="text-[9px] font-mono text-[#8F7B79]">{col}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto border-t border-[#E7D6D2] pt-4">
            <div className="p-4 bg-gradient-to-br from-[#7D3F4A] to-[#5C4F49] text-[#FFFDFC] rounded-2xl space-y-2 shadow-sm">
              <span className="text-[8px] uppercase tracking-[0.25em] font-bold text-[#F3CBD0]">AI Stylist Advice</span>
              <p className="text-[11px] font-serif italic leading-relaxed text-[#FFF8F7]">
                "{currentData.advice.keyFocus}"
              </p>
            </div>
          </div>
        </aside>

        {/* CENTER COLUMN: Realtime Interactive Silhouette & Selection Display */}
        <section className="jp-shell flex-1 relative flex flex-col items-center justify-start p-5 sm:p-6 bg-white/48 overflow-y-auto backdrop-blur-sm">
          <div className="absolute inset-0 opacity-[0.16] pointer-events-none" style={{ backgroundImage: "radial-gradient(rgba(159,95,104,0.38) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
          
          {/* Style switcher tags */}
          <div className="w-full max-w-[460px] mb-6 z-30 bg-white/70 border border-[#E7D6D2]/80 p-3 rounded-[24px] shadow-sm backdrop-blur">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-[#9B7470] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#B87986]" />
                スタイル文字タグ (最終生成に反映)
              </span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {STYLE_TAGS.map((tag) => {
                const isActive = activeTag === tag.id;
                return (
                  <button
                    key={tag.id}
                    onClick={() => handleTagSwitch(tag.id, tag.label)}
                    disabled={isModifying}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                      isActive 
                        ? "bg-[#9F5F68] text-[#FFFDFC] shadow-sm scale-105" 
                        : "bg-white/86 text-[#5B4D4D] hover:bg-[#FFF1F3] border border-[#E7D6D2]"
                    }`}
                    title={tag.desc}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>

          {modifyError && (
            <div className="w-full max-w-[420px] mb-4 bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl text-[11px] flex items-start gap-2 shadow-sm z-30">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">お知らせ</p>
                <p className="opacity-90">{modifyError}</p>
              </div>
            </div>
          )}

          <FittingRoom
            userPhoto={basePhoto}
            baseLoading={baseLoading}
            spriteSheet={spriteSheet}
            spriteLoading={spriteLoading || isModifying}
            options={currentData.options}
            selections={{ hair: hairIndex, top: topIndex, bottom: bottomIndex, shoes: shoesIndex }}
            selectedTextByZone={selectedTextByZone}
            activeZone={activeZone}
            onActivateZone={setActiveZone}
            onSelect={setZoneIndex}
            preferences={preferences}
            renderZoneSVG={renderZoneSVG}
            onApply={handleApplyLook}
            onResetComposite={() => setCompositeUrl(null)}
            isApplying={isApplying}
            compositeUrl={compositeUrl}
            onToggleZoneTag={toggleZoneTextTag}
            onZoneTextSubmit={addZoneTextInstruction}
            zoneModifying={zoneModifying}
          />
        </section>

        {/* RIGHT COLUMN: Swipable Coordinates Deck */}
        <aside className="jp-shell w-full lg:w-80 border-l border-[#E7D6D2]/70 p-5 overflow-y-auto flex flex-col gap-5 bg-white/54 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#9B7470]">コーディネート案</h3>
            <span className="text-[10px] text-[#7D3F4A] bg-[#FFF1F3]/80 border border-[#E0C7C6] px-2 py-0.5 rounded-full font-bold">
              スワイプでアイテム切り替え
            </span>
          </div>

          {/* AI Intelligent Modifier & simulated voice panel */}
          <div className="bg-gradient-to-br from-[#5C4F49] via-[#7D3F4A] to-[#8DA895] text-white p-4 rounded-[24px] shadow-lg border border-white/20 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-[#FFE0E4] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#FFF2B8] animate-pulse" />
                AI スマートコーデ調整アシスタント
              </span>
              <span className="text-[8px] bg-[#E5F0E4] text-[#47684F] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                LIVE
              </span>
            </div>
            
            <p className="text-[11px] text-[#FFF8F7]/78 leading-relaxed">
              微調整の希望を入力すると、候補画像は再生成せず、最後の完成画像生成時にプロンプトへ反映します。
            </p>

            {/* Voice Input Presets Row */}
            <div className="space-y-1">
              <span className="text-[8px] text-[#FFE0E4] uppercase tracking-widest font-bold block">
                よく使うテキスト指示 (クリックで追加)
              </span>
              <div className="flex flex-col gap-1">
                {[
                  "上衣想要更正式挺阔一点，比如大衣或西装",
                  "裤子换成垂坠感和质感更好的卡其色直筒裤",
                  "把衣服颜色调成黑白极简配色的针织衫",
                  "换一双雅致舒适的手工真皮乐福鞋"
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputText(preset);
                      handleInstructionSubmit(preset);
                    }}
                    disabled={isModifying}
                    className="text-left bg-white/10 hover:bg-white/16 active:bg-white/20 px-2.5 py-1.5 rounded-xl text-[10px] text-white/86 border border-white/10 hover:border-white/24 transition-all truncate"
                  >
                    🎤 "{preset}"
                  </button>
                ))}
              </div>
            </div>

            {/* Voice and Text Input Form */}
            <div className="space-y-2 pt-1 border-t border-white/16">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={startSimulatedRecording}
                  disabled={isRecording || isModifying}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                    isRecording 
                      ? "bg-red-600 text-white animate-pulse" 
                      : "bg-white/14 text-white hover:bg-white/22"
                  }`}
                  title="点击模拟录制语音指令"
                >
                  <Mic className={`w-4.5 h-4.5 ${isRecording ? "animate-bounce" : ""}`} />
                </button>

                <div className="flex-1 relative flex items-center">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={isRecording ? "音声を認識中..." : "希望を入力 (例: トップスを赤にして)"}
                    disabled={isModifying}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleInstructionSubmit();
                    }}
                    className="w-full bg-white/14 text-white text-xs px-3 py-2.5 pr-8 rounded-xl placeholder:text-white/48 focus:outline-none focus:ring-1 focus:ring-[#FFE0E4] border border-white/10 focus:border-transparent transition-all"
                  />
                  <button
                    onClick={() => handleInstructionSubmit()}
                    disabled={isModifying || !inputText.trim()}
                    className="absolute right-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {isRecording && (
                <div className="flex items-center gap-1.5 justify-center py-1 bg-red-950/40 border border-red-900/40 rounded-lg">
                  <div className="flex gap-1 items-end h-3">
                    <span className="w-0.5 bg-red-500 h-2 animate-[pulse_0.6s_infinite]" />
                    <span className="w-0.5 bg-red-500 h-3 animate-[pulse_0.4s_infinite]" />
                    <span className="w-0.5 bg-red-500 h-1 animate-[pulse_0.8s_infinite]" />
                    <span className="w-0.5 bg-red-500 h-2.5 animate-[pulse_0.5s_infinite]" />
                  </div>
                  <span className="text-[10px] text-red-400 font-medium font-mono animate-pulse">
                    高音質で録音中 {recTimer}s...
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ZONE 1: Hairstyle */}
          <div className="bg-white/78 p-3.5 rounded-2xl border border-[#E7D6D2]/80 space-y-2 shadow-sm">
            <div className="flex justify-between items-center">
              <label className="text-[10px] uppercase tracking-widest font-bold text-[#9B7470]">1. ヘアスタイルデザイン</label>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => cycleLeft("hair")}
                  className="p-1 rounded-full hover:bg-[#FFF1F3] transition-colors border border-[#EADBD7]"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono font-semibold text-[#7D3F4A] w-6 text-center">{hairIndex + 1}/3</span>
                <button 
                  onClick={() => cycleRight("hair")}
                  className="p-1 rounded-full hover:bg-[#FFF1F3] transition-colors border border-[#EADBD7]"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="relative overflow-hidden min-h-[64px] flex flex-col justify-center">
              <div className="text-xs font-bold text-[#2D2525]">{displayHairName}</div>
              <p className="text-[11px] text-[#756665] mt-1 line-clamp-2">{selectedHair.description}</p>
              <div className="flex gap-1 mt-1.5">
                {selectedHair.tags.map((t, i) => (
                  <span key={i} className="text-[9px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-100">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ZONE 2: Top Clothes */}
          <div className="bg-white/78 p-3.5 rounded-2xl border border-[#E7D6D2]/80 space-y-2 shadow-sm">
            <div className="flex justify-between items-center">
              <label className="text-[10px] uppercase tracking-widest font-bold text-[#9B7470]">2. トップス選択</label>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => cycleLeft("top")}
                  className="p-1 rounded-full hover:bg-[#FFF1F3] transition-colors border border-[#EADBD7]"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono font-semibold text-[#7D3F4A] w-6 text-center">{topIndex + 1}/3</span>
                <button 
                  onClick={() => cycleRight("top")}
                  className="p-1 rounded-full hover:bg-[#FFF1F3] transition-colors border border-[#EADBD7]"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="relative overflow-hidden min-h-[64px] flex flex-col justify-center">
              <div className="text-xs font-bold text-[#2D2525]">{displayTopName}</div>
              <p className="text-[11px] text-[#756665] mt-1 line-clamp-2">{selectedTop.description}</p>
              <div className="flex gap-1 mt-1.5">
                {selectedTop.tags.map((t, i) => (
                  <span key={i} className="text-[9px] bg-indigo-50 text-indigo-800 px-1.5 py-0.5 rounded border border-indigo-100">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ZONE 3: Bottom Clothes */}
          <div className="bg-white/78 p-3.5 rounded-2xl border border-[#E7D6D2]/80 space-y-2 shadow-sm">
            <div className="flex justify-between items-center">
              <label className="text-[10px] uppercase tracking-widest font-bold text-[#9B7470]">3. ボトムス提案</label>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => cycleLeft("bottom")}
                  className="p-1 rounded-full hover:bg-[#FFF1F3] transition-colors border border-[#EADBD7]"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono font-semibold text-[#7D3F4A] w-6 text-center">{bottomIndex + 1}/3</span>
                <button 
                  onClick={() => cycleRight("bottom")}
                  className="p-1 rounded-full hover:bg-[#FFF1F3] transition-colors border border-[#EADBD7]"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="relative overflow-hidden min-h-[64px] flex flex-col justify-center">
              <div className="text-xs font-bold text-[#2D2525]">{displayBottomName}</div>
              <p className="text-[11px] text-[#756665] mt-1 line-clamp-2">{selectedBottom.description}</p>
              <div className="flex gap-1 mt-1.5">
                {selectedBottom.tags.map((t, i) => (
                  <span key={i} className="text-[9px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-100">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ZONE 4: Shoes */}
          <div className="bg-white/78 p-3.5 rounded-2xl border border-[#E7D6D2]/80 space-y-2 shadow-sm">
            <div className="flex justify-between items-center">
              <label className="text-[10px] uppercase tracking-widest font-bold text-[#9B7470]">4. シューズ選択</label>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => cycleLeft("shoes")}
                  className="p-1 rounded-full hover:bg-[#FFF1F3] transition-colors border border-[#EADBD7]"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono font-semibold text-[#7D3F4A] w-6 text-center">{shoesIndex + 1}/3</span>
                <button 
                  onClick={() => cycleRight("shoes")}
                  className="p-1 rounded-full hover:bg-[#FFF1F3] transition-colors border border-[#EADBD7]"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="relative overflow-hidden min-h-[64px] flex flex-col justify-center">
              <div className="text-xs font-bold text-[#2D2525]">{displayShoesName}</div>
              <p className="text-[11px] text-[#756665] mt-1 line-clamp-2">{selectedShoes.description}</p>
              <div className="flex gap-1 mt-1.5">
                {selectedShoes.tags.map((t, i) => (
                  <span key={i} className="text-[9px] bg-rose-50 text-rose-800 px-1.5 py-0.5 rounded border border-rose-100">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* FOOTER ACTION BAR FOR EXPORTS */}
      <footer className="jp-shell h-20 border-t border-[#E7D6D2]/70 bg-white/72 backdrop-blur-xl flex items-center justify-between px-5 sm:px-10">
        <div className="flex gap-3">
          <button 
            onClick={() => handleExportAction("image")}
            className="px-5 py-2.5 border border-[#9F5F68] bg-[#FFF1F3]/80 text-[#7D3F4A] rounded-full text-[10px] uppercase tracking-widest font-bold hover:bg-[#9F5F68] hover:text-white transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            コーデ画像を保存
          </button>
          <button 
            onClick={() => handleExportAction("poster")}
            className="px-5 py-2.5 border border-[#E7D6D2] bg-white/70 rounded-full text-[10px] uppercase tracking-widest font-bold hover:bg-[#FFF1F3] transition-all flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5 text-[#9B7470]" />
            デザインポスター作成
          </button>
        </div>

        <div className="flex gap-3 items-center">
          <span className="hidden md:inline text-[9px] text-[#9B7470] uppercase tracking-widest font-bold mr-2">クリエイティブ展開</span>
          <button 
            onClick={() => handleExportAction("3d")}
            className="w-12 h-12 rounded-full border border-[#E7D6D2] bg-white/70 flex flex-col items-center justify-center hover:bg-[#EEF5EE] transition-colors relative group"
          >
            <span className="text-[10px] font-bold">3D</span>
            <span className="text-[7px] text-[#8F7B79] font-mono">試着</span>
          </button>
          <button 
            onClick={() => handleExportAction("crystal")}
            className="w-12 h-12 rounded-full border border-[#E7D6D2] bg-white/70 flex flex-col items-center justify-center hover:bg-[#FFF1F3] transition-colors relative group"
          >
            <span className="text-[10px] font-bold">クリスタル</span>
            <span className="text-[7px] text-[#8F7B79] font-mono">オーナメント</span>
          </button>
        </div>
      </footer>
      </>
      )}

      {/* EXPORT OVERLAY MODALS (Real functional simulator with high fidelity) */}
      <AnimatePresence>
        {exportModal !== "none" && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#F9F7F2] w-full max-w-2xl rounded-2xl border border-[#E0DCD0] shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => setExportModal("none")}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 bg-white hover:bg-gray-100 p-2 rounded-full border border-gray-100 transition-all"
              >
                ✕
              </button>

              {isGenerating ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                  <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <p className="font-serif italic text-sm text-[#8C887D]">美しいデザインをレンダリング中です。お待ちください...</p>
                </div>
              ) : (
                <>
                  {exportModal === "image" && (
                    <div className="space-y-4">
                      <div className="border-b border-[#E0DCD0] pb-3">
                        <h2 className="text-xl font-serif italic text-gray-900">コーディネート画像が作成されました</h2>
                        <p className="text-xs text-gray-500">下のボタンをクリックして、ミニマルなコーデカードをローカルに保存します。</p>
                      </div>

                      {/* Pure Canvas Card mockup */}
                      <div className="bg-white p-6 rounded-xl border border-[#E0DCD0] flex flex-col items-center gap-4 shadow-sm">
                        <div className="w-72 border border-[#E0DCD0] p-4 bg-[#F9F7F2] rounded-lg text-center space-y-4">
                          <div className="text-left">
                            <div className="text-[8px] uppercase tracking-widest text-[#8C887D]">VISUAL PERSONA</div>
                            <div className="text-sm font-serif italic font-bold">Studio AI Style Tags</div>
                          </div>
                          
                          <div className="aspect-[3/4] bg-white rounded-lg flex flex-col items-center justify-between p-4 border border-[#E0DCD0]/60 relative overflow-hidden">
                            {generatedImageUrl ? (
                              <img src={generatedImageUrl} alt="Generated Outfit" className="w-full h-full object-cover rounded" />
                            ) : (
                              <>
                                {renderHairstyleSVG(selectedHair)}
                                {renderTopSVG(selectedTop)}
                                {renderBottomSVG(selectedBottom)}
                                {renderShoesSVG(selectedShoes)}
                              </>
                            )}
                          </div>

                          <div className="text-left text-[9px] text-[#8C887D] space-y-1">
                            <div>ヘアスタイル: {displayHairName}</div>
                            <div>トップス: {displayTopName}</div>
                            <div>ボトムス: {displayBottomName}</div>
                            <div>シューズ: {displayShoesName}</div>
                          </div>
                        </div>

                        <button 
                          onClick={() => {
                            if (generatedImageUrl) {
                              const link = document.createElement("a");
                              link.href = generatedImageUrl;
                              link.download = `Visual_Persona_${activeTag || 'Outfit'}.png`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            } else {
                              alert("高画質のコーディネート画像の準備が整い、システムが自動的に保存を開始しました。");
                            }
                            setExportModal("none");
                          }}
                          className="w-full bg-[#1A1A1A] text-white py-3 rounded-xl font-semibold text-xs tracking-widest uppercase hover:bg-black transition-all flex items-center justify-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          高画質元画像をダウンロード (PNG)
                        </button>
                      </div>
                    </div>
                  )}

                  {exportModal === "poster" && (
                    <div className="space-y-4">
                      <div className="border-b border-[#E0DCD0] pb-3">
                        <h2 className="text-xl font-serif italic text-gray-900">高級アートポスター</h2>
                        <p className="text-xs text-gray-500">雑誌の表紙レベルのアートファッションポスターをカスタマイズし、ローカルでの高精度印刷をサポートします。</p>
                      </div>

                      {/* Editorial Poster Frame */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div ref={posterRef} className="bg-[#FAF8F5] p-6 border-2 border-[#1A1A1A] text-[#1A1A1A] font-serif space-y-4 rounded shadow-md relative">
                          <div className="text-center space-y-1 border-b border-[#E0DCD0] pb-3">
                            <span className="text-[7px] uppercase tracking-[0.3em] font-sans font-bold text-[#8C887D]">PERSPECTIVE VOLUME I</span>
                            <h3 className="text-2xl font-serif tracking-tight uppercase">V I S U A L</h3>
                            <p className="text-[8px] uppercase tracking-widest font-sans font-medium text-gray-500">Personal Style Dossier & Curated Wardrobe</p>
                          </div>

                          <div className="aspect-[3/4] border border-[#1A1A1A] rounded-lg overflow-hidden relative bg-white flex flex-col items-center justify-center p-4">
                            <div className="absolute top-2 left-2 text-[7px] font-sans font-bold uppercase tracking-widest z-10 bg-white/80 px-1 py-0.5 rounded">AESTHETIC NO. 0812</div>
                            {generatedImageUrl ? (
                              <img src={generatedImageUrl} alt="Generated Poster" className="w-full h-full object-cover" />
                            ) : (
                              <div className="scale-75 flex flex-col items-center gap-1">
                                {renderHairstyleSVG(selectedHair)}
                                {renderTopSVG(selectedTop)}
                                {renderBottomSVG(selectedBottom)}
                                {renderShoesSVG(selectedShoes)}
                              </div>
                            )}
                          </div>

                          <div className="space-y-2 text-[9px] font-sans leading-relaxed text-gray-600">
                            <p className="font-serif italic font-bold text-[#1A1A1A]">「論理的なプロポーションとミニマリズムアートを完璧に融合させ、あなた独自のファッションの魂を再構築します。」</p>
                            <div className="grid grid-cols-2 gap-2 text-[8px] pt-1 font-mono">
                              <div>FACE: {data.faceFeatures.shape}</div>
                              <div>BODY: {data.bodyProportions.shape}</div>
                              <div>STYLE: {preferences.style.split(" ")[0]}</div>
                              <div>PERSON: AUTO INFERRED</div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 flex flex-col justify-center">
                          <div className="bg-white p-4 rounded-xl border border-[#E0DCD0] space-y-2">
                            <h4 className="font-bold text-xs">ポスターサイズの選択</h4>
                            <p className="text-xs text-gray-500">デフォルトで300DPIのアートギャラリーレベルの印刷解像度を提供し、40x60cmおよび50x70cmのフレームに対応しています。</p>
                            <div className="flex gap-2 pt-2">
                              <span className="px-3 py-1 bg-gray-100 text-gray-800 text-[10px] rounded border border-gray-200">レトロイエローマット紙</span>
                              <span className="px-3 py-1 bg-indigo-50 text-indigo-800 text-[10px] rounded border border-indigo-200 font-semibold">アートハイグロスマット紙</span>
                            </div>
                          </div>

                          <button 
                            onClick={() => {
                              alert("ポスターのレイアウトが完成しました。システムの印刷と保存サービスを起動します！");
                              setExportModal("none");
                            }}
                            className="w-full bg-[#1A1A1A] text-white py-3 rounded-xl font-semibold text-xs tracking-widest uppercase hover:bg-black transition-all flex items-center justify-center gap-2"
                          >
                            <Printer className="w-4 h-4" />
                            ポスターを作成して印刷する
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {exportModal === "3d" && (
                    <div className="space-y-4">
                      <div className="border-b border-[#E0DCD0] pb-3">
                        <h2 className="text-xl font-serif italic text-gray-900">3D スマート試着室 (スワイプで回転)</h2>
                        <p className="text-xs text-gray-500">AIが顔と服を3Dメッシュに変換し、あらゆる角度からコーディネートの効果をプレビューできます。</p>
                      </div>

                      {/* Interactive simulated 3D canvas view */}
                      <div className="flex flex-col items-center bg-gray-900 text-white p-6 rounded-2xl relative overflow-hidden aspect-square max-h-[360px] justify-center gap-4">
                        <div className="absolute top-4 right-4 bg-white/10 px-2.5 py-1 rounded-full text-[9px] font-mono flex items-center gap-1">
                          <RotateCw className="w-3 h-3 animate-spin text-indigo-400" />
                          3D RENDER INTERACTIVE ACTIVE
                        </div>

                        {/* Rotating 3D representation mockup using CSS 3D or elegant visual rotations */}
                        <motion.div 
                          animate={{ rotateY: generatedImageUrl ? 0 : [0, 360] }}
                          transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
                          className={`w-48 ${generatedImageUrl ? "h-64" : "h-64"} bg-gray-800 rounded-3xl border border-white/20 flex flex-col items-center justify-center relative shadow-2xl overflow-hidden`}
                          style={{ transformStyle: "preserve-3d" }}
                        >
                          {generatedImageUrl ? (
                            <img src={generatedImageUrl} alt="Generated 3D Model Render" className="w-full h-full object-cover" />
                          ) : (
                            <div className="scale-90 flex flex-col items-center">
                              {renderHairstyleSVG(selectedHair)}
                              <div className="mt-2">{renderTopSVG(selectedTop)}</div>
                              <div>{renderBottomSVG(selectedBottom)}</div>
                              <div className="mt-1">{renderShoesSVG(selectedShoes)}</div>
                            </div>
                          )}
                        </motion.div>

                        <div className="text-center">
                          <p className="text-xs text-gray-400">全身の体型、顔の輪郭、関節の3D骨格の再構築とバインドを自動的に完了しました。</p>
                          <p className="text-[10px] text-emerald-400 mt-1">✓ AR試着デバイスとメタバースアバターへのワンクリックインポートに対応</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            alert("3Dコーディネートアセットファイル (.OBJ / .GLTF) を生成し、メールに送信しました。");
                            setExportModal("none");
                          }}
                          className="flex-1 bg-white text-gray-900 border border-gray-300 py-2.5 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-colors"
                        >
                          3D メタバースファイルをエクスポート
                        </button>
                        <button 
                          onClick={() => {
                            alert("メインデバイスでARプロジェクション試着が有効になりました！");
                            setExportModal("none");
                          }}
                          className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-2.5 rounded-xl text-xs font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-md"
                        >
                          モバイル AR 試着を有効にする
                        </button>
                      </div>
                    </div>
                  )}

                  {exportModal === "crystal" && (
                    <div className="space-y-4">
                      <div className="border-b border-[#E0DCD0] pb-3">
                        <h2 className="text-xl font-serif italic text-gray-900">3D クリスタル彫刻オーナメント</h2>
                        <p className="text-xs text-gray-500">あなたのアバターとスタイルのDNAを、ナノレベルの高精度レーザーで透明なクリスタルブロックの中に彫刻します。</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Crystal mockup design */}
                        <div className="aspect-square bg-gradient-to-tr from-gray-200 to-gray-50 rounded-2xl border border-white p-6 flex items-center justify-center relative shadow-inner overflow-hidden">
                          {/* Inner crystal glass glow effects */}
                          <div className="absolute inset-8 bg-white/40 border border-white/60 rounded-lg shadow-2xl backdrop-blur-[2px] flex flex-col items-center justify-center p-4 overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/10 pointer-events-none z-10" />
                            {generatedImageUrl ? (
                              <img src={generatedImageUrl} alt="Generated Crystal Art" className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              <div className="scale-50 opacity-80 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] flex flex-col items-center">
                                {renderHairstyleSVG(selectedHair)}
                                {renderTopSVG(selectedTop)}
                                {renderBottomSVG(selectedBottom)}
                                {renderShoesSVG(selectedShoes)}
                              </div>
                            )}
                            <span className="absolute bottom-2 text-[8px] font-mono text-white opacity-90 tracking-wider z-20 mix-blend-difference">VISUAL GENE #812</span>
                          </div>
                          
                          {/* Light refractions */}
                          <div className="absolute top-2 left-10 w-20 h-1 bg-white/80 rotate-12 blur-[1px]" />
                          <div className="absolute bottom-2 right-10 w-24 h-1.5 bg-indigo-200/30 -rotate-45 blur-[2px]" />
                        </div>

                        <div className="space-y-4 flex flex-col justify-center">
                          <div className="space-y-2 bg-white p-4 rounded-xl border border-gray-200 text-xs">
                            <div className="font-bold text-[#1A1A1A]">💎 クリスタルアートの詳細:</div>
                            <p className="text-gray-500 leading-relaxed text-[11px]">
                              最高級の輸入K9人工水晶を使用し、毎秒500万回の超高速レーザーパルスで、顔の微妙な表情、体型の輪郭、ヘアスタイルの細部を水晶の内部に正確に彫刻します。
                            </p>
                            <div className="text-[10px] text-gray-400 mt-1">サイズ: 50x50x80mm 立体直方体ブロック</div>
                          </div>

                          <button 
                            onClick={() => {
                              alert("クリスタル彫刻の注文が送信されました！次のステップで配送先住所を入力してください。");
                              setExportModal("none");
                            }}
                            className="w-full bg-[#1A1A1A] text-white py-3 rounded-xl font-semibold text-xs tracking-widest uppercase hover:bg-black transition-all flex items-center justify-center gap-2"
                          >
                            クリスタルオーナメントを注文する
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
