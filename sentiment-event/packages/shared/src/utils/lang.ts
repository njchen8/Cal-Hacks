import { franc } from "franc";

const LANG_THRESHOLD = 0.2;

export interface LanguageDetectionResult {
  lang: string;
  reliable: boolean;
}

export const detectLanguage = (text: string): LanguageDetectionResult => {
  if (!text || text.trim().length === 0) {
    return { lang: "und", reliable: false };
  }
  const result = franc(text, { minLength: 10 });
  if (result === "und") {
    return { lang: "und", reliable: false };
  }
  // franc returns ISO 639-3; convert simple mapping for English.
  if (result === "eng") {
    return { lang: "en", reliable: true };
  }
  return { lang: result, reliable: true };
};

export const isEnglish = (langResult: LanguageDetectionResult) => langResult.lang === "en";
