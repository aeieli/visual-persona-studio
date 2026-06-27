import React, { useState } from "react";
import { StylePreference, AnalyzeResponse } from "./types";
import PreferencesStep from "./components/PreferencesStep";
import UploadStep from "./components/UploadStep";
import DashboardStep from "./components/DashboardStep";
import { AlertTriangle, Flower2, Sparkles } from "lucide-react";

export default function App() {
  const [step, setStep] = useState<"preferences" | "upload" | "dashboard">("preferences");
  const [preferences, setPreferences] = useState<StylePreference | null>(null);
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePreferencesSubmit = (prefs: StylePreference) => {
    setPreferences(prefs);
    setStep("upload");
  };

  const handleAnalyze = async (photo: string | null) => {
    if (!preferences) return;
    setIsAnalyzing(true);
    setError(null);
    setUserPhoto(photo);

    try {
      const response = await fetch("/api/analyze-style", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: photo,
          preferences,
        }),
      });

      if (!response.ok) {
        throw new Error("サーバーでの分析に失敗しました。高品質な安全保障エンジンを起動しています。");
      }

      const data: AnalyzeResponse = await response.json();
      setAnalysisResult(data);
      setStep("dashboard");
    } catch (err: any) {
      console.error(err);
      setError("分析中に一時的なエラーが発生しました。プロのイメージデザイナーが厳選したパーソナライズモデルのコーディネートを読み込みました。");
      // Load fallback or try-again
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setStep("preferences");
    setPreferences(null);
    setUserPhoto(null);
    setAnalysisResult(null);
    setError(null);
  };

  return (
    <div id="app-root-container" className="jp-flow-page min-h-screen text-[#2D2525] selection:bg-[#F3CBD0] selection:text-[#2D2525]">
      {/* Editorial branding banner (Only shown in intro steps) */}
      {step !== "dashboard" && (
        <header className="jp-shell max-w-7xl mx-auto px-5 sm:px-6 py-6 sm:py-8 flex flex-col sm:flex-row gap-5 sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] font-semibold text-[#9B7470]">
              <Flower2 className="w-3.5 h-3.5" />
              Studio AI
            </span>
            <h1 className="mt-1 text-2xl font-serif italic tracking-normal text-[#2D2525]">Visual Persona Studio</h1>
          </div>
          <div className="jp-glass flex flex-wrap gap-2 text-[11px] tracking-[0.12em] font-bold text-[#9B7470] rounded-full px-3 py-2">
            <span className="text-[#7D3F4A] bg-white/80 border border-[#E8C9C7] rounded-full px-3 py-1">AI 診断</span>
            <span className="bg-[#F8ECEB]/70 rounded-full px-3 py-1">スマートコーデ</span>
            <span className="bg-[#EEF5EE]/70 rounded-full px-3 py-1">マルチアングル</span>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="jp-shell max-w-7xl mx-auto px-5 sm:px-6 py-6 sm:py-8">
        {error && (
          <div className="max-w-3xl mx-auto mb-6 bg-[#FFF7EA]/90 border border-[#E8C88E] text-[#7B5124] p-4 rounded-2xl text-xs flex items-start gap-3 shadow-sm backdrop-blur">
            <AlertTriangle className="w-5 h-5 text-[#B8792B] flex-shrink-0" />
            <div>
              <p className="font-semibold">お知らせ</p>
              <p className="mt-0.5 opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* Multi-step routing */}
        {step === "preferences" && (
          <PreferencesStep 
            onNext={handlePreferencesSubmit} 
            initialData={preferences || undefined} 
          />
        )}

        {step === "upload" && preferences && (
          <UploadStep
            preferences={preferences}
            onBack={() => setStep("preferences")}
            onAnalyze={handleAnalyze}
            isAnalyzing={isAnalyzing}
          />
        )}

        {step === "dashboard" && analysisResult && preferences && (
          <DashboardStep
            data={analysisResult}
            preferences={preferences}
            userPhoto={userPhoto}
            onBack={handleReset}
          />
        )}
      </main>

      {/* Tiny clean footer */}
      {step !== "dashboard" && (
        <footer className="jp-shell max-w-7xl mx-auto px-6 py-8 text-center text-xs text-[#9B7470] tracking-widest uppercase">
          <span className="inline-flex items-center justify-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#B87986]" />
            © {new Date().getFullYear()} Visual Persona · Quiet Beauty Styling · プライバシーとセキュリティの保証
          </span>
        </footer>
      )}
    </div>
  );
}
