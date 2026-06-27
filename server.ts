import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
// Cloud Run / AI Studio injects PORT at runtime; fall back to 3000 for local dev.
const PORT = Number(process.env.PORT) || 3000;

// Cloud Run is stateless, so uploaded photos are sent as compressed base64 JSON
// and are never written to the local filesystem.
app.use(express.json({ limit: "25mb" }));

// Initialize GoogleGenAI client lazily if API key is provided
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY is not defined in environment. Using fallback mock styling engine.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Full schema type definitions for the API response
interface StyleOption {
  id: string;
  name: string;
  description: string;
  tags: string[];
  color: string; // Hex color recommended by AI
  visualHint: string; // Detail description for SVG styling
  type: string; // e.g. "short_crop", "wavy_bob", "sweater", "blazer", "jeans", "canvas"
}

interface AnalyzeResponse {
  faceFeatures: {
    shape: string;
    skinTone: string;
    toneDesc: string;
    description: string;
  };
  bodyProportions: {
    shape: string;
    shoulderToWaist: string;
    legToBody: string;
    description: string;
  };
  options: {
    hairstyle: StyleOption[];
    top: StyleOption[];
    bottom: StyleOption[];
    shoes: StyleOption[];
  };
  advice: {
    keyFocus: string;
    accessoryTips: string;
    colorPalette: string[];
  };
}

// Fallback style generator for when API key is missing or fails
function getMockStyling(preferences: any): AnalyzeResponse {
  const gender = preferences.gender === "auto" ? "neutral" : preferences.gender || "neutral";
  const style = preferences.style || "カジュアル";
  const occupation = preferences.occupation || "プロフェッショナル";

  const isMale = gender === "male";
  const isFemale = gender === "female";

  // Build appropriate color schemes based on preference
  let palette = ["#1E293B", "#475569", "#94A3B8", "#F1F5F9"];
  if (style.includes("レトロ")) {
    palette = ["#78350F", "#B45309", "#D97706", "#FEF3C7"];
  } else if (style.includes("ストリート")) {
    palette = ["#000000", "#10B981", "#3B82F6", "#F3F4F6"];
  } else if (style.includes("ビジネス")) {
    palette = ["#0F172A", "#1E3A8A", "#64748B", "#F8FAFC"];
  }

  return {
    faceFeatures: {
      shape: isMale ? "彫りの深い四角顔" : isFemale ? "丸みのある卵型" : "シャープなVライン顔",
      skinTone: "イエベ春",
      toneDesc: `肌色を引き立てる、低彩度で温かみのあるアースカラーやオフホワイトが似合います。写真から推定される人物印象とスタイルの好みに合わせて、柔らかく落ち着いた色の組み合わせをおすすめします。`,
      description: `整った顔立ちで、顔の輪郭のバランスが良いです。顔の線を柔らかくし、${occupation} のスマートな印象を高めるため、軽やかで透け感のあるヘアスタイルが似合います。`
    },
    bodyProportions: {
      shape: "バランスの良いモデル体型",
      shoulderToWaist: "クラシックプロポーション (やや肩幅広め)",
      legToBody: "黄金比 (ハイウエストな視覚効果)",
      description: `体のバランスが取れています。ハイウエストのパンツやスリムフィットのボトムスで脚のラインを長く見せ、上下のバランスを保つのが似合います。${style} のレイヤードスタイルに適しています。`
    },
    options: {
      hairstyle: [
        {
          id: "hair-1",
          name: isMale ? "クラシックレトロオールバック" : isFemale ? "フレンチエアリーミディアムウェーブ" : "爽やかでスマートなショートウェーブ",
          description: isMale ? "クラシックでスマート、落ち着いた雰囲気を引き立て、職場やフォーマルな場面に適しています。" : "軽やかでロマンチック、顔の形を美しく見せ、穏やかで上品な印象を与えます。",
          tags: ["すっきり", "小顔効果", "着回し抜群"],
          color: "#27272A",
          visualHint: "short_crop",
          type: "short_crop"
        },
        {
          id: "hair-2",
          name: isMale ? "爽やかなサイドパートショート" : isFemale ? "すっきりとしたハイポニーテール" : "無造作な鎖骨ヘア",
          description: "毎日の手入れが簡単で、若々しい活力を示し、日常のカジュアルやスポーツシーンに適しています。",
          tags: ["元気", "ナチュラル", "手入れ簡単"],
          color: "#3F3F46",
          visualHint: "long_undercut",
          type: "long_undercut"
        },
        {
          id: "hair-3",
          name: isMale ? "バズカットミニマルスタイル" : isFemale ? "レトロな肩丈ボブ" : "ライトビジネスレイヤーカット",
          description: "個性的でモダン、顔の輪郭を際立たせ、独自のトレンド感を示します。",
          tags: ["個性的", "ミニマル", "シャープ"],
          color: "#18181B",
          visualHint: "wavy_bob",
          type: "wavy_bob"
        }
      ],
      top: [
        {
          id: "top-1",
          name: style.includes("ビジネス") ? "定番のシワ防止ノーアイロン白シャツ" : "レトロワークマルチポケットジャケット",
          description: "上質で快適な素材、きちんとした仕立て。どんな服にも合わせやすく、仕事やカジュアルな集まりのほとんどに適しています。",
          tags: ["快適", "通気性", "ミニマル"],
          color: style.includes("ビジネス") ? "#F8FAFC" : "#78350F",
          visualHint: "shirt",
          type: "shirt"
        },
        {
          id: "top-2",
          name: "ヘビーウェイトコットンワッフルスウェット",
          description: "ドロップショルダーで、リラックスしつつもきちんとした印象。上半身に豊かな着心地を提供します。",
          tags: ["ヘビーウェイト", "ドロップショルダー", "カジュアル"],
          color: "#475569",
          visualHint: "sweater",
          type: "sweater"
        },
        {
          id: "top-3",
          name: "英国風ダブルブレストウールテーラードジャケット",
          description: "肩のラインを美しく見せる優れたシルエットで、スマートでエレガント。大人のコーディネートの主役になります。",
          tags: ["英国風", "ハリ感", "ライトラグジュアリー"],
          color: "#1E293B",
          visualHint: "blazer",
          type: "blazer"
        }
      ],
      bottom: [
        {
          id: "bottom-1",
          name: "スリムストレート生デニム",
          description: "定番のヘビーウェイトセルビッジデニム。着込むほどに独特のレトロな色合いになり、脚長効果があります。",
          tags: ["耐久性", "生デニム", "定番"],
          color: "#1D4ED8",
          visualHint: "jeans",
          type: "jeans"
        },
        {
          id: "bottom-2",
          name: "ドレープハイウエストワイドスラックス",
          description: "シワになりにくいドレープ素材。ハイウエストで脚を長く見せ、腰回りには繊細なプリーツが施されています。",
          tags: ["ドレープ", "脚長効果", "高級感"],
          color: "#334155",
          visualHint: "trousers",
          type: "trousers"
        },
        {
          id: "bottom-3",
          name: "軽量ジョガーギャバジンパンツ",
          description: "わずかにストレッチ性があり窮屈ではなく、足首はすっきり。コーディネート全体に自由でアクティブな活力を与えます。",
          tags: ["機能的", "微ストレッチ", "すっきり"],
          color: "#1E293B",
          visualHint: "shorts",
          type: "shorts"
        }
      ],
      shoes: [
        {
          id: "shoes-1",
          name: "ミニマルレトロ白スニーカー",
          description: "厳選されたトップグレインレザーを使用し、快適で通気性があり、控えめでエレガント。あらゆるコーディネートの「万能キー」です。",
          tags: ["万能", "白スニーカー", "通気性"],
          color: "#FFFFFF",
          visualHint: "sneakers",
          type: "sneakers"
        },
        {
          id: "shoes-2",
          name: "本革レトロマーチンブーツ",
          description: "英国のクラシックなシルエット。滑り止めの厚底で、身長を高く細く見せ、力強いオーラとクールさを醸し出します。",
          tags: ["身長アップ", "英国風", "クール"],
          color: "#18181B",
          visualHint: "boots",
          type: "boots"
        },
        {
          id: "shoes-3",
          name: "スエード軽量ローファー",
          description: "エレガントでリラックス感があり、着脱が簡単で、通気性が良く柔らかい。夏から秋にかけての季節の変わり目や、街歩き向けのハイエンドなコーディネートに適しています。",
          tags: ["スエード", "スリッポン", "紳士的"],
          color: "#78350F",
          visualHint: "loafers",
          type: "loafers"
        }
      ]
    },
    advice: {
      keyFocus: `${style} のスタイルと ${occupation} のアイデンティティを完璧に融合。上半身はややゆったり、下半身はストレートのハイウエストを合わせることで、完璧な視覚的プロポーションを作り出します。`,
      accessoryTips: "スチールベルトの腕時計、ミニマルな無地のトートバッグ、またはシルバーの細いブレスレットを合わせることで、細部を彩りつつも複雑すぎない印象になります。",
      colorPalette: palette
    }
  };
}

// API endpoint for analyzing style and photos
app.post("/api/analyze-style", async (req, res) => {
  const { image, preferences } = req.body;

  try {
    const client = getGeminiClient();
    const apiKey = process.env.GEMINI_API_KEY;

    // If Gemini key is missing, return mock data instantly to guarantee standard offline-first experience
    if (!apiKey || apiKey === "MOCK_KEY" || apiKey.includes("MY_GEMINI_API_KEY")) {
      console.log("No valid API key. Serving detailed mock styling engine.");
      return res.json(getMockStyling(preferences));
    }

    const { age, style, occupation, hobbies, gender, wardrobeTaste, moodTags, colorPalette, textureTags } = preferences || {};
    const genderContext =
      gender === "auto" || !gender
        ? image
          ? "Infer gender presentation from the provided photo only; the user did not manually select it."
          : "Unspecified; do not assume a binary gender, keep the styling broadly wearable."
        : gender;
    const ageContext =
      age === "auto" || !age
        ? image
          ? "Infer apparent age range from the provided photo only; the user did not manually enter age."
          : "Unspecified; do not assume an exact age."
        : age;
    const prompt = `
      You are an elite, highly professional personal stylist, clothing designer, and image consultant.
      The user is setting up their styling profile with preference tags. Demographic attributes must come from image analysis, not manual selection:
      - Gender presentation: ${genderContext}
      - Apparent age range: ${ageContext}
      - Clothing Style Preference: ${style || "casual"}
      - Occupation: ${occupation || "professional"}
      - Hobbies: ${hobbies || "lifestyle"}
      - Wardrobe taste tags: ${wardrobeTaste || "not specified"}
      - Mood / scene tags: ${moodTags || "not specified"}
      - Preferred color families: ${colorPalette || "not specified"}
      - Texture / silhouette tags: ${textureTags || "not specified"}

      ${image ? "An actual photo of the user is provided. Analyze this photo to identify face shape, skin tone undertone, body outline/proportions, gender presentation, and apparent age range." : "No photo was uploaded. Do not invent gender or exact age. Analyze only the preference tags to create a neutral virtual look."}

      Task: Generate a customized image and styling recommendation.
      Produce a complete, valid JSON output strictly matching the schema.

      The JSON response MUST include:
      1. faceFeatures:
         - shape: Face shape name (e.g. "Oval鹅蛋脸", "Square国字脸", "Heart心形脸")
         - skinTone: Skin tone undertone classification (e.g. "暖黄调", "冷白调", "中性偏深")
         - toneDesc: Concise styling advice based on skin color and photo-inferred age impression when available.
         - description: General analysis of how facial features map to styling focus.
      2. bodyProportions:
         - shape: Body shape type (e.g. "Hourglass沙漏型", "Rectangle矩形", "Triangle梨形", "Inverted Triangle倒三角")
         - shoulderToWaist: Description of shoulder/waist relationship
         - legToBody: Legs vs Torso ratio visual description
         - description: Styling strategy to balance body shape (e.g. highlight waist, broaden shoulders).
      3. options (Exactly 3 tailored recommendations for each item, designed to fit into 4 slidable cards for Head, Top, Bottom, Shoes):
         - hairstyle (3 options): Each option must have id ("hair-1", "hair-2", "hair-3"), name, description, tags (2-3 items), color (Hex code), type (MUST be one of: "short_crop", "long_undercut", "wavy_bob"), and visualHint.
         - top (3 options): Each option must have id ("top-1", "top-2", "top-3"), name, description, tags, color (Hex code), type (MUST be one of: "shirt", "sweater", "blazer"), and visualHint.
         - bottom (3 options): Each option must have id ("bottom-1", "bottom-2", "bottom-3"), name, description, tags, color (Hex code), type (MUST be one of: "jeans", "trousers", "shorts"), and visualHint.
         - shoes (3 options): Each option must have id ("shoes-1", "shoes-2", "shoes-3"), name, description, tags, color (Hex code), type (MUST be one of: "sneakers", "boots", "loafers"), and visualHint.
      4. advice:
         - keyFocus: Core recommendation to achieve this style.
         - accessoryTips: Accessory suggestions (watch, bags, glasses, belts).
         - colorPalette: Array of 4 recommended hex colors that work perfectly together for this styling palette.

      Make sure the recommended colors represent a cohesive, aesthetically beautiful collection.
    `;

    const contents: any[] = [];
    if (image) {
      // Decode base64 image data
      const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        contents.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2],
          },
        });
      }
    }
    contents.push({ text: prompt });

    // Request JSON schema output for maximum type-safety
    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: contents },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["faceFeatures", "bodyProportions", "options", "advice"],
          properties: {
            faceFeatures: {
              type: Type.OBJECT,
              required: ["shape", "skinTone", "toneDesc", "description"],
              properties: {
                shape: { type: Type.STRING },
                skinTone: { type: Type.STRING },
                toneDesc: { type: Type.STRING },
                description: { type: Type.STRING },
              },
            },
            bodyProportions: {
              type: Type.OBJECT,
              required: ["shape", "shoulderToWaist", "legToBody", "description"],
              properties: {
                shape: { type: Type.STRING },
                shoulderToWaist: { type: Type.STRING },
                legToBody: { type: Type.STRING },
                description: { type: Type.STRING },
              },
            },
            options: {
              type: Type.OBJECT,
              required: ["hairstyle", "top", "bottom", "shoes"],
              properties: {
                hairstyle: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    required: ["id", "name", "description", "tags", "color", "type", "visualHint"],
                    properties: {
                      id: { type: Type.STRING },
                      name: { type: Type.STRING },
                      description: { type: Type.STRING },
                      tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                      color: { type: Type.STRING },
                      type: { type: Type.STRING },
                      visualHint: { type: Type.STRING },
                    },
                  },
                },
                top: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    required: ["id", "name", "description", "tags", "color", "type", "visualHint"],
                    properties: {
                      id: { type: Type.STRING },
                      name: { type: Type.STRING },
                      description: { type: Type.STRING },
                      tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                      color: { type: Type.STRING },
                      type: { type: Type.STRING },
                      visualHint: { type: Type.STRING },
                    },
                  },
                },
                bottom: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    required: ["id", "name", "description", "tags", "color", "type", "visualHint"],
                    properties: {
                      id: { type: Type.STRING },
                      name: { type: Type.STRING },
                      description: { type: Type.STRING },
                      tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                      color: { type: Type.STRING },
                      type: { type: Type.STRING },
                      visualHint: { type: Type.STRING },
                    },
                  },
                },
                shoes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    required: ["id", "name", "description", "tags", "color", "type", "visualHint"],
                    properties: {
                      id: { type: Type.STRING },
                      name: { type: Type.STRING },
                      description: { type: Type.STRING },
                      tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                      color: { type: Type.STRING },
                      type: { type: Type.STRING },
                      visualHint: { type: Type.STRING },
                    },
                  },
                },
              },
            },
            advice: {
              type: Type.OBJECT,
              required: ["keyFocus", "accessoryTips", "colorPalette"],
              properties: {
                keyFocus: { type: Type.STRING },
                accessoryTips: { type: Type.STRING },
                colorPalette: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
          },
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty text response received from Gemini");
    }

    const data = JSON.parse(text.trim());
    return res.json(data);
  } catch (error: any) {
    console.error("Gemini analysis error:", error);
    // Graceful fallback to guarantee uptime
    return res.json(getMockStyling(req.body.preferences));
  }
});

// Mock modifier utility for high reliability offline/offline fallbacks
function applyMockModification(currentData: any, instruction: string): any {
  const data = JSON.parse(JSON.stringify(currentData)) as any;
  
  const colorMap: { [key: string]: string } = {
    "赤": "#DC2626",
    "青": "#2563EB",
    "黒": "#18181B",
    "白": "#FAFAFA",
    "黄": "#F59E0B",
    "緑": "#16A34A",
    "ピンク": "#EC4899",
    "グレー": "#6B7280",
    "カーキ": "#D97706",
    "ブラウン": "#78350F"
  };

  let matchedColor: string | null = null;
  for (const [key, val] of Object.entries(colorMap)) {
    if (instruction.includes(key)) {
      matchedColor = val;
      break;
    }
  }

  if (instruction.includes("髪") || instruction.includes("頭") || instruction.includes("ヘアスタイル")) {
    data.options.hairstyle = data.options.hairstyle.map((item: any) => {
      let newItem = { ...item };
      if (matchedColor) {
        newItem.color = matchedColor;
        newItem.tags = [...newItem.tags, "カスタムカラー"];
      }
      if (instruction.includes("短")) {
        newItem.name = "すっきりミニマルベリーショート";
        newItem.type = "short_crop";
      } else if (instruction.includes("巻き") || instruction.includes("ウェーブ")) {
        newItem.name = "フレンチリラックスウェーブ";
        newItem.type = "wavy_bob";
      } else if (instruction.includes("長") || instruction.includes("オールバック")) {
        newItem.name = "上品なミディアムロング";
        newItem.type = "long_undercut";
      }
      newItem.description = `ご希望に合わせて調整しました：[${instruction}]`;
      return newItem;
    });
    data.advice.keyFocus = `ヘアスタイルデザインを特別に調整しました： [${instruction}]`;
  }
  else if (instruction.includes("トップス") || instruction.includes("アウター") || instruction.includes("服") || instruction.includes("ジャケット") || instruction.includes("シャツ") || instruction.includes("スウェット") || instruction.includes("スーツ") || instruction.includes("セーター")) {
    data.options.top = data.options.top.map((item: any) => {
      let newItem = { ...item };
      if (matchedColor) {
        newItem.color = matchedColor;
      }
      if (instruction.includes("シャツ") || instruction.includes("フォーマル")) {
        newItem.name = "AI特製ビジネスノーアイロンシャツ";
        newItem.type = "shirt";
        newItem.tags = ["上品", "シワ防止"];
      } else if (instruction.includes("スーツ") || instruction.includes("アウター") || instruction.includes("ジャケット")) {
        newItem.name = "AI専用テーラードジャケット";
        newItem.type = "blazer";
        newItem.tags = ["スリム", "スマート"];
      } else if (instruction.includes("スウェット") || instruction.includes("セーター") || instruction.includes("カジュアル")) {
        newItem.name = "AI特製リラックススウェット";
        newItem.type = "sweater";
        newItem.tags = ["暖かい", "快適"];
      }
      newItem.description = `特別なコーディネートに対応するため、トップスを更新しました：[${instruction}]`;
      return newItem;
    });
    data.advice.keyFocus = `音声またはテキストの指示に基づいて、トップスの提案を再構築しました。`;
  }
  else if (instruction.includes("ボトムス") || instruction.includes("パンツ") || instruction.includes("ショートパンツ") || instruction.includes("ジーンズ") || instruction.includes("スラックス")) {
    data.options.bottom = data.options.bottom.map((item: any) => {
      let newItem = { ...item };
      if (matchedColor) {
        newItem.color = matchedColor;
      }
      if (instruction.includes("ジーンズ") || instruction.includes("カジュアル")) {
        newItem.name = "AI特製レトロストレートジーンズ";
        newItem.type = "jeans";
        newItem.tags = ["レトロ", "スリム"];
      } else if (instruction.includes("スラックス") || instruction.includes("パンツ") || instruction.includes("フォーマル")) {
        newItem.name = "AI特製高級ドレープスラックス";
        newItem.type = "trousers";
        newItem.tags = ["ドレープ", "脚長効果"];
      } else if (instruction.includes("ショートパンツ")) {
        newItem.name = "AI特製機能的通気性ショートパンツ";
        newItem.type = "shorts";
        newItem.tags = ["爽やか", "ワークテイスト"];
      }
      newItem.description = `より良く合わせるために、ボトムスを更新しました：[${instruction}]`;
      return newItem;
    });
    data.advice.keyFocus = `指示に基づいて、パンツのコーディネートを更新しました： [${instruction}]`;
  }
  else if (instruction.includes("靴") || instruction.includes("シューズ") || instruction.includes("ブーツ")) {
    data.options.shoes = data.options.shoes.map((item: any) => {
      let newItem = { ...item };
      if (matchedColor) {
        newItem.color = matchedColor;
      }
      if (instruction.includes("革靴") || instruction.includes("ローファー") || instruction.includes("フォーマル")) {
        newItem.name = "AIオーダーメイド高級ローファー";
        newItem.type = "loafers";
        newItem.tags = ["紳士的", "ソフトソール"];
      } else if (instruction.includes("ブーツ") || instruction.includes("マーチン")) {
        newItem.name = "AIタフガイマーチンブーツ";
        newItem.type = "boots";
        newItem.tags = ["ワークブーツ", "耐摩耗性"];
      } else {
        newItem.name = "AIミニマルホワイトレザースニーカー";
        newItem.type = "sneakers";
        newItem.tags = ["万能", "通気性"];
      }
      newItem.description = `シューズを以下に合わせて調整しました：[${instruction}]`;
      return newItem;
    });
    data.advice.keyFocus = `新しいシューズをマッチングしました： [${instruction}]`;
  }
  else {
    if (matchedColor) {
      data.options.top[0].color = matchedColor;
      data.options.top[0].name = `AIカスタムカラー · ${data.options.top[0].name}`;
    }
    data.advice.keyFocus = `全体的なカラーパレットとデザインコンセプトをカスタマイズ更新しました： [${instruction}]`;
  }

  return data;
}

// API endpoint to handle speech/text customization in real-time using Gemini or Fallback
app.post("/api/modify-style", async (req, res) => {
  const { currentData, instruction, preferences, targetZone } = req.body;

  if (!instruction || instruction.trim() === "") {
    return res.json(currentData);
  }

  try {
    const client = getGeminiClient();
    const apiKey = process.env.GEMINI_API_KEY;

    // Direct fallback to preserve seamless experience if no key is supplied
    if (!apiKey || apiKey === "MOCK_KEY" || apiKey.includes("MY_GEMINI_API_KEY")) {
      const modified = applyMockModification(currentData, instruction);
      return res.json(modified);
    }

    const prompt = `
      You are an elite, highly professional personal stylist and clothing designer.
      The user is working with their customized styling recommendation (JSON provided below).
      The user has issued a direct modification instruction: "${instruction}"
      
      User Profile Context:
      - Style Preference: ${preferences?.style || "casual"}
      - Person attributes: ${preferences?.gender === "auto" ? "Use photo-inferred person attributes; no manual gender/age preference was provided." : preferences?.gender || "neutral"}

      Your task is to update the current styling recommendation based on their instruction.
      For example:
      - If they ask to change colors, modify the Hex 'color' values in the respective category (hairstyle, top, bottom, or shoes). Ensure colors are elegant and cohesive.
      - If they ask to change style type (e.g. from Trousers to Jeans, or Sweater to Blazer), update the 'type', 'name', 'tags', and 'description' appropriately.
      - Make sure you maintain the exact same JSON format with fields: faceFeatures, bodyProportions, options, advice.
      - Keep the original items unless they are requested to be modified. Ensure each array still has exactly 3 elements.
      ${
        targetZone
          ? `IMPORTANT: This instruction targets ONLY the "${targetZone}" category. Regenerate the 3 "${targetZone}" options to reflect the instruction (give 3 distinct variations in that direction), and keep ALL other categories (the ones that are not "${targetZone}") EXACTLY unchanged.`
          : ""
      }

      Current Data JSON:
      ${JSON.stringify(currentData)}
    `;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["faceFeatures", "bodyProportions", "options", "advice"],
          properties: {
            faceFeatures: {
              type: Type.OBJECT,
              required: ["shape", "skinTone", "toneDesc", "description"],
              properties: {
                shape: { type: Type.STRING },
                skinTone: { type: Type.STRING },
                toneDesc: { type: Type.STRING },
                description: { type: Type.STRING },
              },
            },
            bodyProportions: {
              type: Type.OBJECT,
              required: ["shape", "shoulderToWaist", "legToBody", "description"],
              properties: {
                shape: { type: Type.STRING },
                shoulderToWaist: { type: Type.STRING },
                legToBody: { type: Type.STRING },
                description: { type: Type.STRING },
              },
            },
            options: {
              type: Type.OBJECT,
              required: ["hairstyle", "top", "bottom", "shoes"],
              properties: {
                hairstyle: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    required: ["id", "name", "description", "tags", "color", "type", "visualHint"],
                    properties: {
                      id: { type: Type.STRING },
                      name: { type: Type.STRING },
                      description: { type: Type.STRING },
                      tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                      color: { type: Type.STRING },
                      type: { type: Type.STRING },
                      visualHint: { type: Type.STRING },
                    },
                  },
                },
                top: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    required: ["id", "name", "description", "tags", "color", "type", "visualHint"],
                    properties: {
                      id: { type: Type.STRING },
                      name: { type: Type.STRING },
                      description: { type: Type.STRING },
                      tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                      color: { type: Type.STRING },
                      type: { type: Type.STRING },
                      visualHint: { type: Type.STRING },
                    },
                  },
                },
                bottom: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    required: ["id", "name", "description", "tags", "color", "type", "visualHint"],
                    properties: {
                      id: { type: Type.STRING },
                      name: { type: Type.STRING },
                      description: { type: Type.STRING },
                      tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                      color: { type: Type.STRING },
                      type: { type: Type.STRING },
                      visualHint: { type: Type.STRING },
                    },
                  },
                },
                shoes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    required: ["id", "name", "description", "tags", "color", "type", "visualHint"],
                    properties: {
                      id: { type: Type.STRING },
                      name: { type: Type.STRING },
                      description: { type: Type.STRING },
                      tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                      color: { type: Type.STRING },
                      type: { type: Type.STRING },
                      visualHint: { type: Type.STRING },
                    },
                  },
                },
              },
            },
            advice: {
              type: Type.OBJECT,
              required: ["keyFocus", "accessoryTips", "colorPalette"],
              properties: {
                keyFocus: { type: Type.STRING },
                accessoryTips: { type: Type.STRING },
                colorPalette: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
          },
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty text response received from Gemini modify");
    }

    const data = JSON.parse(text.trim());
    return res.json(data);
  } catch (err) {
    console.error("Modify API error, using mock modifier", err);
    const modified = applyMockModification(currentData, instruction);
    return res.json(modified);
  }
});

// Endpoint to generate a highly customized and responsive fashion lookbook image using gemini-3.1-flash-image (nano banana 2)
app.post("/api/generate-outfit-image", async (req, res) => {
  const { hairstyle, top, bottom, shoes, activeTag, instruction, preferences, exportType, userPhoto } = req.body;

  try {
    const client = getGeminiClient();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === "MOCK_KEY" || apiKey.includes("MY_GEMINI_API_KEY")) {
      throw new Error("No valid Gemini API key configured for image generation.");
    }

    let promptText = "";
    const modelSubject =
      preferences?.gender && preferences.gender !== "auto"
        ? `a ${preferences.gender} model`
        : userPhoto
        ? "the same person from the provided photo"
        : "a style model with unspecified gender and age";

    if (exportType === "3d") {
      promptText = `
        A trendy 3D vinyl art toy blind box figure character of ${modelSubject}. 
        Wearing:
        - Hairstyle: ${hairstyle}
        - Top wear: ${top}
        - Bottom wear: ${bottom}
        - Shoes: ${shoes}
        Style: ${activeTag || preferences?.style || 'elegant casual'}
        Rendered in Unreal Engine 5, octane render, soft clay materials, cute designer toy aesthetic, studio lighting, clean background.
      `;
    } else if (exportType === "crystal") {
      promptText = `
        A luxurious, glowing Swarovski crystal figurine of ${modelSubject}.
        Wearing:
        - Hairstyle: ${hairstyle}
        - Top wear: ${top}
        - Bottom wear: ${bottom}
        - Shoes: ${shoes}
        Style: ${activeTag || preferences?.style || 'elegant casual'}
        Made entirely of translucent refractive glass and crystal, glowing from within, macro photography, dark background, premium luxury display piece.
      `;
    } else if (userPhoto) {
      // "Apply / 試着" re-composite: keep the real person's face & identity, restyle the outfit.
      promptText = `
        Using the provided photo of the real person, KEEP their face, identity, skin tone and body
        proportions unchanged. Restyle this same person into a full-body fashion editorial portrait
        wearing:
        - Hairstyle: ${hairstyle}
        - Top wear: ${top}
        - Bottom wear: ${bottom}
        - Shoes: ${shoes}

        Aesthetic specifications:
        - Look & Vibe: ${activeTag || preferences?.style || 'elegant casual'}
        - Target Style Accent: ${instruction ? `Custom adjustment: "${instruction}"` : 'Cohesive matching'}

        Photorealistic, the same recognizable person, studio ambient warm-toned side lighting,
        solid clean beige backdrop, 8k resolution, crisp garment texture, full body visible head to shoes.
      `;
    } else {
      promptText = `
        A professional fashion editorial lookbook portrait of ${modelSubject} showing full body outfit:
        - Hairstyle: ${hairstyle}
        - Top wear: ${top}
        - Bottom wear: ${bottom}
        - Shoes: ${shoes}

        Aesthetic specifications:
        - Look & Vibe: ${activeTag || preferences?.style || 'elegant casual'}
        - Target Style Accent: ${instruction ? `Custom adjustment: "${instruction}"` : 'Cohesive matching'}

        Photorealistic, studio ambient warm-toned side lighting, solid clean beige backdrop, 8k resolution, crisp detail on garment texture and fabrics, modern minimalist catalog composition.
      `;
    }

    console.log(`Generating outfit image (${exportType}) via gemini-3.1-flash-image (banana 2) with prompt:`, promptText);

    // Build content parts; prepend the user photo when provided so the model keeps their identity.
    const outfitParts: any[] = [];
    if (userPhoto) {
      const matches = String(userPhoto).match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        outfitParts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
      }
    }
    outfitParts.push({ text: promptText });

    const response = await client.models.generateContent({
      model: 'gemini-3.1-flash-image', // Nano Banana 2
      contents: {
        parts: outfitParts,
      },
      config: {
        imageConfig: {
          aspectRatio: "3:4",
          imageSize: "1K"
        },
      },
    });

    let imageUrl = "";
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!imageUrl) {
      throw new Error("No image data returned from gemini-3.1-flash-image");
    }

    return res.json({ imageUrl });

  } catch (err: any) {
    console.error("Error generating outfit image:", err);
    return res.status(500).json({ error: err.message || "Failed to generate outfit image." });
  }
});

// Step 1 of the try-on pipeline: derive a NORMALIZED full-body reference photo from the
// reference image, at a fixed aspect ratio (3:4) and a neutral front-facing standing pose,
// while preserving the person's identity. This becomes the canonical base for the fitting room.
app.post("/api/derive-fullbody", async (req, res) => {
  const { image, preferences, analysis } = req.body || {};

  try {
    const client = getGeminiClient();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === "MOCK_KEY" || apiKey.includes("MY_GEMINI_API_KEY")) {
      throw new Error("No valid Gemini API key configured for full-body derivation.");
    }

    const bodyHint = analysis?.bodyProportions?.shape
      ? `Body type reference: ${analysis.bodyProportions.shape}, ${analysis.bodyProportions.shoulderToWaist}, ${analysis.bodyProportions.legToBody}.`
      : "";

    const promptText = image
      ? `
        From the provided reference photo of a real person, generate a single FULL-BODY photo of
        the SAME person, head to toe, nothing cropped. KEEP their face, hairstyle, skin tone and
        identity clearly recognizable. ${bodyHint}
        Pose: standing straight, front-facing, relaxed arms at the sides, neutral expression,
        feet fully visible. Wearing simple neutral fitted base clothing (plain top, plain trousers,
        plain shoes) so accessories can be layered later.
        Plain seamless light-grey studio background, soft even lighting, photorealistic, sharp focus,
        centered full-body composition with small margins at head and feet.
      `
      : `
        Generate a photorealistic FULL-BODY photo of a neutral style model with unspecified gender
        and no exact age assumption, head to toe, nothing cropped. ${bodyHint}
        Style vibe: ${preferences?.style || "elegant casual"}.
        Pose: standing straight, front-facing, relaxed arms at the sides, neutral expression,
        feet fully visible. Wearing simple neutral fitted base clothing.
        Plain seamless light-grey studio background, soft even lighting, photorealistic, sharp focus,
        centered full-body composition with small margins at head and feet.
      `;

    const parts: any[] = [];
    if (image) {
      const matches = String(image).match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        parts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
      }
    }
    parts.push({ text: promptText });

    console.log("Deriving full-body reference via gemini-3.1-flash-image (banana 2)");

    const response = await client.models.generateContent({
      model: "gemini-3.1-flash-image", // Nano Banana 2
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "3:4", // fixed full-body ratio
          imageSize: "1K",
        },
      },
    });

    let fullBodyUrl = "";
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          fullBodyUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!fullBodyUrl) {
      throw new Error("No image data returned for full-body derivation.");
    }

    return res.json({ fullBodyUrl });
  } catch (err: any) {
    console.error("Error deriving full-body reference:", err);
    return res.status(500).json({ error: err.message || "Failed to derive full-body reference." });
  }
});

// Endpoint to generate ONE master sprite sheet (3 columns x 4 rows = 12 item tiles)
// Row order: hairstyle, top, bottom, shoes. Column = option index 0,1,2.
// The frontend slices each cell via CSS background-position; falls back to SVG when this fails.
app.post("/api/generate-sprite-sheet", async (req, res) => {
  const { options, preferences } = req.body || {};

  try {
    const client = getGeminiClient();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === "MOCK_KEY" || apiKey.includes("MY_GEMINI_API_KEY")) {
      throw new Error("No valid Gemini API key configured for sprite sheet generation.");
    }

    if (!options?.hairstyle || !options?.top || !options?.bottom || !options?.shoes) {
      throw new Error("Missing styling options for sprite sheet generation.");
    }

    const cell = (o: any) => `${o?.name || o?.type || "item"} (${o?.color || "neutral"})`;
    const rowList = (arr: any[]) => arr.slice(0, 3).map(cell).join(" | ");

    const promptText = `
      Create ONE clean product contact sheet image arranged as a STRICT uniform grid of
      3 columns and 4 rows (12 equal cells, no gaps, no labels, no text).
      Each cell contains a single fashion item cut-out, centered, isolated on a clean
      seamless pure-white background, studio product photography, soft even lighting,
      consistent scale and framing across all cells.

      Fill the cells row by row, left to right, in EXACTLY this order:
      - Row 1 (hairstyles): ${rowList(options.hairstyle)}
      - Row 2 (tops): ${rowList(options.top)}
      - Row 3 (bottoms): ${rowList(options.bottom)}
      - Row 4 (shoes): ${rowList(options.shoes)}

      Overall vibe: ${preferences?.style || "elegant casual"}. Do not draw any people, faces,
      grid lines, borders, numbers or captions — only the 12 isolated items on white.
    `;

    console.log("Generating sprite sheet via gemini-3.1-flash-image (banana 2)");

    const response = await client.models.generateContent({
      model: "gemini-3.1-flash-image", // Nano Banana 2
      contents: { parts: [{ text: promptText }] },
      config: {
        imageConfig: {
          aspectRatio: "3:4", // 3 columns wide, 4 rows tall
          imageSize: "1K",
        },
      },
    });

    let sheetUrl = "";
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          sheetUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!sheetUrl) {
      throw new Error("No image data returned for sprite sheet.");
    }

    return res.json({ sheetUrl, cols: 3, rows: 4 });
  } catch (err: any) {
    console.error("Error generating sprite sheet:", err);
    return res.status(500).json({ error: err.message || "Failed to generate sprite sheet." });
  }
});

// Configure development and production static file serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
