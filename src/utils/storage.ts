import { AppSettings, HistoryRecord } from '../types/calculator';
import { ExplanationLanguage } from './mathEngine';

const HISTORY_KEY = 'kbr_calc_pro_history_v1';
const SETTINGS_KEY = 'kbr_calc_pro_settings_v1';
const MEMORY_KEY = 'kbr_calc_pro_memory_v1';
const CURRENCY_KEY = 'kbr_calc_pro_currency_rates_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  explanationLanguage: 'english',
  voiceLanguage: 'en-PK',
  voiceOutputEnabled: true,
  speechSpeed: 1.0,
  hapticEnabled: true,
  precision: 8,
  angleUnit: 'DEG',
  scientificNotation: false,
};

export const DEFAULT_CURRENCY_RATES: Record<string, number> = {
  USD: 1,
  PKR: 278.5,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.67,
  SAR: 3.75,
  INR: 84.4,
  CAD: 1.4,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore quota errors
  }
}

export function loadHistory(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistory(items: HistoryRecord[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 100)));
  } catch {
    // If thumbnail data caused quota overflow, strip thumbnails from older entries
    try {
      const trimmed = items.slice(0, 40).map((item, idx) =>
        idx > 10 ? { ...item, imageThumbnail: undefined } : item
      );
      localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    } catch {
      // Ignore
    }
  }
}

export function loadMemory(): number {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
  } catch {
    return 0;
  }
}

export function saveMemory(val: number): void {
  try {
    localStorage.setItem(MEMORY_KEY, String(val));
  } catch {
    // Ignore
  }
}

export function loadCurrencyRates(): Record<string, number> {
  try {
    const raw = localStorage.getItem(CURRENCY_KEY);
    if (!raw) return DEFAULT_CURRENCY_RATES;
    return { ...DEFAULT_CURRENCY_RATES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CURRENCY_RATES;
  }
}

export function saveCurrencyRates(rates: Record<string, number>): void {
  try {
    localStorage.setItem(CURRENCY_KEY, JSON.stringify(rates));
  } catch {
    // Ignore
  }
}

export function triggerHaptic(enabled: boolean, durationMs = 12): void {
  if (!enabled) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(durationMs);
    }
  } catch {
    // Ignore on desktop/iOS
  }
}

export function speakText(
  text: string,
  language: ExplanationLanguage | 'en-US' | 'ur-PK' | 'en-PK' = 'english',
  rate = 1.0
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (language === 'urdu' || language === 'ur-PK') {
      utterance.lang = 'ur-PK';
    } else if (language === 'roman_urdu' || language === 'en-PK') {
      utterance.lang = 'en-IN';
    } else {
      utterance.lang = 'en-US';
    }
    utterance.rate = Math.min(2, Math.max(0.5, rate));
    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore TTS failures gracefully
  }
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
