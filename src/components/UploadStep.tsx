import React, { useState, useRef } from "react";
import { Upload, Camera, User, ArrowLeft, Loader2, Sparkles, Flower2 } from "lucide-react";
import { SampleModel, StylePreference } from "../types";

interface UploadStepProps {
  preferences: StylePreference;
  onBack: () => void;
  onAnalyze: (image: string | null) => void;
  isAnalyzing: boolean;
}

// Highly realistic and visually fitting profile presets
const SAMPLE_MODELS: SampleModel[] = [
  {
    id: "sample-1",
    name: "表参道のクリエイター (ミオ)",
    gender: "female",
    age: "27",
    style: "淡色フェミニン (Soft Feminine)",
    occupation: "デザイナー / アート / クリエイティブ職",
    hobbies: ["写真 / カフェ巡り", "アート展示 / 雑貨 / インテリア"],
    imageUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=500&h=500",
    description: "柔らかな顔立ちと透明感のある肌。淡い色、軽い素材、抜け感のあるレイヤードが似合うタイプ。"
  },
  {
    id: "sample-2",
    name: "丸の内のオフィスワーカー (リナ)",
    gender: "female",
    age: "29",
    style: "きれいめ通勤 (Kireime Office)",
    occupation: "金融 / コンサル / ビジネス管理",
    hobbies: ["ピラティス / ヨガ / ウォーキング", "スペシャルティコーヒー / 和菓子 / グルメ"],
    imageUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=500&h=500",
    description: "卵型の顔、明るい肌、すっきりした骨格。細身ジャケットや落ち感のあるパンツが映える。"
  },
  {
    id: "sample-3",
    name: "京都の編集者 (ナオ)",
    gender: "female",
    age: "34",
    style: "和モダンレトロ (Wa Modern Retro)",
    occupation: "フリーランス / クリエイター",
    hobbies: ["読書 / 執筆 / 映画", "温泉 / 小旅行 / 神社散歩"],
    imageUrl: "https://images.unsplash.com/photo-1512316609839-ce289d3eba0a?auto=format&fit=crop&q=80&w=500&h=500",
    description: "落ち着いた雰囲気と知的な表情。深い色、控えめな柄、質感のある小物で品よくまとまる。"
  },
  {
    id: "sample-4",
    name: "代官山のカフェオーナー (サキ)",
    gender: "female",
    age: "26",
    style: "ナチュラルシック (Natural Chic)",
    occupation: "フリーランス / クリエイター",
    hobbies: ["写真 / カフェ巡り", "アート展示 / 雑貨 / インテリア"],
    imageUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=500&h=500",
    description: "やわらかなロングヘアと自然体の表情。リネン、ニット、レザー小物の穏やかな組み合わせが似合う。"
  }
];

export default function UploadStep({ preferences, onBack, onAnalyze, isAnalyzing }: UploadStepProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result && typeof e.target.result === "string") {
          resolve(e.target.result);
        } else {
          reject(new Error("画像の読み込みに失敗しました。"));
        }
      };
      reader.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
      reader.readAsDataURL(file);
    });

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("画像をプレビューできません。JPG / PNG / WebP を使用してください。"));
      img.src = src;
    });

  const compressImageForCloudRun = async (file: File) => {
    const originalDataUrl = await readFileAsDataUrl(file);
    const image = await loadImage(originalDataUrl);
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("画像処理を開始できませんでした。");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", 0.84);
  };

  const processFile = async (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith("image/")) {
      setUploadError("画像ファイルをアップロードしてください。");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Cloud Run で安定して処理するため、10MB以内の画像を選択してください。");
      return;
    }

    setIsProcessingImage(true);
    try {
      const compressedDataUrl = await compressImageForCloudRun(file);
      setImagePreview(compressedDataUrl);
    } catch (err: any) {
      console.error("Image compression failed:", err);
      setUploadError(err?.message || "画像の最適化に失敗しました。別の写真をお試しください。");
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleSelectSample = (sample: SampleModel) => {
    // We fetch and convert sample image to base64 or just pass the image preview.
    // For local samples, we can convert to base64 if needed, or simply let the backend use sample details to generate!
    // Since unsplash might block server fetch sometimes, we can also pass a base64 from a canvas or just send null but with preferences override.
    // Let's draw the sample model onto a canvas to convert it into a base64 data url easily! This makes the Gemini call super robust since we are passing a real base64.
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        try {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setImagePreview(dataUrl);
        } catch (e) {
          console.error("Canvas export failed:", e);
          // Fallback to model image directly
          setImagePreview(sample.imageUrl);
        }
      }
    };
    img.src = sample.imageUrl;
  };

  const handleClear = () => {
    setImagePreview(null);
  };

  const handleAnalyzeClick = () => {
    onAnalyze(imagePreview);
  };

  return (
    <div id="upload-step-container" className="max-w-5xl mx-auto py-4">
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[#7D6664] hover:text-[#2D2525] transition-colors bg-white/78 px-3 py-1.5 rounded-full border border-[#E7D6D2] shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          設定に戻る
        </button>
        <span className="text-xs text-[#9B7470] bg-white/64 border border-[#E7D6D2] px-3 py-1 rounded-full">
          写真から性別・年齢印象を自動推定 · {preferences.wardrobeTaste?.join(" / ") || preferences.style}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left column: Upload & Preview */}
        <div className="lg:col-span-7 space-y-6">
          <div className="jp-glass p-5 sm:p-6 rounded-[28px] space-y-4">
            <h3 className="font-serif text-[#2D2525] text-xl flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#B87986]" />
              顔の正面写真をアップロード
            </h3>
            <p className="text-xs text-[#756665] leading-relaxed">
              明るい自然光に近い写真を使うと、肌色・輪郭・ヘアライン・体型バランスをより繊細に読み取れます。
            </p>
            {uploadError && (
              <div className="rounded-2xl border border-[#E8C88E] bg-[#FFF7EA] px-4 py-3 text-xs text-[#7B5124]">
                {uploadError}
              </div>
            )}

            {imagePreview ? (
              <div className="relative aspect-square max-h-[380px] w-full rounded-[24px] overflow-hidden border border-[#E3C8C9] bg-[#FFFDFC] shadow-inner">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <button
                  onClick={handleClear}
                  className="absolute top-3 right-3 bg-[#2D2525]/78 hover:bg-[#2D2525] text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow transition-all backdrop-blur"
                >
                  再アップロード
                </button>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isProcessingImage && fileInputRef.current?.click()}
                className={`aspect-square max-h-[340px] w-full rounded-[24px] border-2 border-dashed flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-[#C9828C] bg-[#FFF1F3]/70 scale-[0.99]"
                    : "border-[#E1C8C5] hover:border-[#C9828C] hover:bg-[#FFF8F7]/70 bg-white/72"
                }`}
              >
                <div className="w-14 h-14 rounded-full bg-[#FFF1F3] text-[#9F5F68] flex items-center justify-center mb-4 shadow-sm border border-[#EBCDD0]">
                  {isProcessingImage ? <Loader2 className="w-7 h-7 animate-spin" /> : <Upload className="w-7 h-7" />}
                </div>
                <div className="font-semibold text-sm text-[#3A3030]">
                  {isProcessingImage ? "Cloud Run 用に画像を最適化中..." : "クリックしてアップロードするか、写真をここにドラッグ＆ドロップしてください"}
                </div>
                <div className="text-xs text-[#8F7B79] mt-2 max-w-[320px] leading-relaxed">
                  JPG、PNG、WebP形式に対応、元画像は10MB以内。送信前にブラウザで圧縮し、サーバーには保存しません。
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />
              </div>
            )}

            <div className="pt-2">
              {isAnalyzing ? (
                <button
                  disabled
                  className="w-full jp-primary-button font-semibold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-3 cursor-not-allowed opacity-80"
                >
                  <Loader2 className="w-5 h-5 animate-spin" />
                  AIがパーソナルイメージをモデリング・分析中... お待ちください
                </button>
              ) : (
                <button
                  onClick={handleAnalyzeClick}
                  disabled={isProcessingImage}
                  className="w-full jp-primary-button font-semibold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Sparkles className="w-5 h-5 text-[#FFF2B8] animate-pulse" />
                  {imagePreview ? "この写真を使って顔と体型を分析" : "好みに基づいてAIが直接コーディネートをデザイン"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Preset Models */}
        <div className="lg:col-span-5 space-y-6">
          <div className="jp-soft-card p-5 sm:p-6 rounded-[28px] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-[#2D2525] text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-[#7FA48A]" />
                写真がない場合、モデルを試す
              </h3>
              <span className="text-[10px] text-[#7D3F4A] bg-[#FFF1F3] font-bold px-2 py-0.5 rounded-full border border-[#EBCDD0]">
                おすすめ
              </span>
            </div>
            <p className="text-xs text-[#756665] leading-relaxed">
              雰囲気に近いモデルで、きれいめ・淡色・和モダン・ナチュラルの仕上がりをすぐに確認できます。
            </p>

            <div className="jp-scrollbar space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
              {SAMPLE_MODELS.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => handleSelectSample(sample)}
                  className="w-full text-left p-3 rounded-2xl border border-[#EADBD7] hover:border-[#D9A7AC] hover:bg-[#FFF6F5]/80 transition-all flex items-start gap-3 bg-white/78"
                >
                  <img
                    src={sample.imageUrl}
                    alt={sample.name}
                    className="w-16 h-16 rounded-2xl object-cover flex-shrink-0 border border-[#EADBD7] shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-[#2D2525]">{sample.name}</span>
                      <span className="text-[9px] text-[#9B7470] bg-[#F8ECEB] px-1.5 py-0.5 rounded-full">
                        {sample.age}歳
                      </span>
                    </div>
                    <div className="text-[10px] text-[#9F5F68] font-semibold truncate">
                      スタイル: {sample.style}
                    </div>
                    <p className="text-[10px] text-[#8F7B79] line-clamp-2 leading-relaxed">
                      {sample.description}
                    </p>
                  </div>
                  <Flower2 className="w-4 h-4 text-[#D2A2A8] ml-auto mt-1 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
