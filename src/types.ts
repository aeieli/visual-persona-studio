export interface StylePreference {
  gender: "male" | "female" | "neutral" | "auto";
  age: string;
  style: string;
  occupation: string;
  hobbies: string[];
  wardrobeTaste?: string[];
  moodTags?: string[];
  colorPalette?: string[];
  textureTags?: string[];
}

export interface StyleOption {
  id: string;
  name: string;
  description: string;
  tags: string[];
  color: string;
  type: string; // e.g. "short_crop", "long_undercut", "wavy_bob", "shirt", "sweater", "blazer", "jeans", "trousers", "shorts", "sneakers", "boots", "loafers"
  visualHint: string;
}

export interface AnalyzeResponse {
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

export interface SampleModel {
  id: string;
  name: string;
  gender: "male" | "female" | "neutral";
  age: string;
  style: string;
  occupation: string;
  hobbies: string[];
  imageUrl: string;
  description: string;
}
