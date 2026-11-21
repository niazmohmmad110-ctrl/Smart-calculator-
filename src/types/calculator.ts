import { AngleUnit, ExplanationLanguage } from '../utils/mathEngine';

export type ActiveScreen =
  | 'home'
  | 'scientific'
  | 'camera'
  | 'ai_solver'
  | 'voice'
  | 'history'
  | 'tools'
  | 'settings';

export type InputMethod = 'Keyboard' | 'Camera' | 'Voice';

export interface SolutionStep {
  title: string;
  expression: string;
  explanation: string;
}

export interface SolveResponse {
  ok: boolean;
  configured?: boolean;
  offlineFallback?: boolean;
  recognizedQuestion: string;
  isUnclear?: boolean;
  clarificationMessage?: string;
  problemType?: string;
  finalAnswer: string;
  steps: SolutionStep[];
  summary?: string;
  verifiedDeterministic?: boolean;
  verifiedResult?: string;
  error?: string;
}

export interface HistoryRecord {
  id: string;
  question: string;
  answer: string;
  steps?: SolutionStep[];
  summary?: string;
  inputMethod: InputMethod;
  language?: ExplanationLanguage;
  imageThumbnail?: string;
  verifiedDeterministic?: boolean;
  createdAt: string;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  explanationLanguage: ExplanationLanguage;
  voiceLanguage: 'en-US' | 'ur-PK' | 'en-PK';
  voiceOutputEnabled: boolean;
  speechSpeed: number;
  hapticEnabled: boolean;
  precision: number;
  angleUnit: AngleUnit;
  scientificNotation: boolean;
}
