import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Volume2,
  Mic,
  MicOff,
  Loader2,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import { ExplanationLanguage, solveOfflineDeterministic } from '../utils/mathEngine';
import { speakText, triggerHaptic } from '../utils/storage';
import { AppSettings, HistoryRecord, SolveResponse } from '../types/calculator';

interface AiMathSolverProps {
  initialQuestion: string;
  initialSolution: SolveResponse | null;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onSaveHistory: (record: Omit<HistoryRecord, 'id' | 'createdAt'>) => void;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export const AiMathSolver: React.FC<AiMathSolverProps> = ({
  initialQuestion,
  initialSolution,
  settings,
  onUpdateSettings,
  onSaveHistory,
}) => {
  const [question, setQuestion] = useState(initialQuestion);
  const [solution, setSolution] = useState<SolveResponse | null>(initialSolution);
  const [mode, setMode] = useState<'step_by_step' | 'final_only'>('step_by_step');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (initialQuestion) setQuestion(initialQuestion);
  }, [initialQuestion]);

  useEffect(() => {
    if (initialSolution) setSolution(initialSolution);
  }, [initialSolution]);

  const haptic = () => triggerHaptic(settings.hapticEnabled, 12);

  const handleSolve = async (overrideLang?: ExplanationLanguage, overrideMode?: 'step_by_step' | 'final_only') => {
    haptic();
    const q = question.trim();
    if (!q) {
      setError('Enter or paste a mathematical problem, equation, or word problem first.');
      return;
    }

    const lang = overrideLang || settings.explanationLanguage;
    const solveMode = overrideMode || mode;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/math/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expression: q,
          language: lang,
          mode: solveMode,
        }),
      });
      const data = (await res.json()) as SolveResponse;

      if (!res.ok || !data.ok) {
        const offline = solveOfflineDeterministic(q, lang, settings.precision);
        if (offline) {
          const fallback: SolveResponse = {
            ok: true,
            configured: false,
            offlineFallback: true,
            recognizedQuestion: offline.recognizedQuestion,
            problemType: offline.problemType,
            finalAnswer: offline.finalAnswer,
            steps: offline.steps,
            summary: `Solved deterministically offline: ${offline.finalAnswer}`,
            verifiedDeterministic: true,
          };
          setSolution(fallback);
          onSaveHistory({
            question: fallback.recognizedQuestion,
            answer: fallback.finalAnswer,
            steps: fallback.steps,
            summary: fallback.summary,
            inputMethod: 'Keyboard',
            language: lang,
            verifiedDeterministic: true,
          });
          setLoading(false);
          return;
        }
        setError(data.error || 'Could not solve this problem.');
        setLoading(false);
        return;
      }

      setSolution(data);
      if (!data.isUnclear) {
        onSaveHistory({
          question: data.recognizedQuestion || q,
          answer: data.finalAnswer,
          steps: data.steps,
          summary: data.summary,
          inputMethod: 'Keyboard',
          language: lang,
          verifiedDeterministic: data.verifiedDeterministic,
        });
      }
    } catch {
      const offline = solveOfflineDeterministic(q, lang, settings.precision);
      if (offline) {
        setSolution({
          ok: true,
          offlineFallback: true,
          recognizedQuestion: offline.recognizedQuestion,
          problemType: offline.problemType,
          finalAnswer: offline.finalAnswer,
          steps: offline.steps,
          summary: `Solved offline: ${offline.finalAnswer}`,
          verifiedDeterministic: true,
        });
      } else {
        setError('Unable to reach AI Math Solver. Check internet connection for word problems.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceFollowup = async (command: string) => {
    if (!command.trim()) return;
    setLoading(true);
    setError(null);
    let targetLang = settings.explanationLanguage;
    if (/roman\s*urdu/i.test(command)) targetLang = 'roman_urdu';
    else if (/urdu|اردو/i.test(command)) targetLang = 'urdu';
    else if (/english/i.test(command)) targetLang = 'english';
    onUpdateSettings({ explanationLanguage: targetLang });

    try {
      const res = await fetch('/api/math/voice-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: solution?.recognizedQuestion || question,
          currentAnswer: solution?.finalAnswer,
          userCommand: command,
          language: targetLang,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Voice command failed.');
        return;
      }
      setSolution((prev) => ({
        ok: true,
        recognizedQuestion: prev?.recognizedQuestion || question,
        finalAnswer: data.finalAnswer || prev?.finalAnswer || '',
        steps: data.steps || prev?.steps || [],
        summary: data.spokenSummary,
        verifiedDeterministic: prev?.verifiedDeterministic,
      }));
      if (settings.voiceOutputEnabled && data.spokenSummary) {
        speakText(data.spokenSummary, targetLang, settings.speechSpeed);
      }
    } catch {
      setError('Network error during voice command.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMic = () => {
    haptic();
    if (listening && recRef.current) {
      recRef.current.stop();
      setListening(false);
      return;
    }
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      setError('Speech recognition not available on this browser.');
      return;
    }
    const rec = new SpeechRec();
    rec.lang = settings.voiceLanguage;
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const txt = ev.results?.[0]?.[0]?.transcript || '';
      setListening(false);
      if (txt) {
        if (!solution) {
          setQuestion(txt);
        } else {
          handleVoiceFollowup(txt);
        }
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const samplePrompts = [
    '25 + 35 × 2',
    '2x + 5 = 15',
    'x^2 - 5x + 6 = 0',
    '3/4 + 5/8',
    'Ali bought 5 notebooks for Rs 450. What is the price of 8 notebooks?',
    'ایک ٹرین 60 کلومیٹر فی گھنٹہ کی رفتار سے 3 گھنٹے میں کتنا فاصلہ طے کرے گی؟',
  ];

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Input Column */}
      <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-[#0D0D11] border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            AI Math Solver
          </h2>
          <button
            type="button"
            onClick={toggleMic}
            className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
              listening
                ? 'bg-rose-600 text-white'
                : 'bg-zinc-100 dark:bg-zinc-900 text-amber-700 dark:text-amber-300 border border-amber-500/30'
            }`}
          >
            {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            {listening ? 'Stop' : 'Speak'}
          </button>
        </div>

        <textarea
          rows={5}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Type any equation, algebra, trigonometry, calculus, or English/Urdu word problem..."
          className="w-full rounded-2xl bg-zinc-50 dark:bg-[#14141A] border border-zinc-200 dark:border-zinc-800 p-3.5 text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
        />

        {/* Language Selector */}
        <div>
          <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-2">
            Explanation Language
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'english', label: 'English' },
                { id: 'roman_urdu', label: 'Roman Urdu' },
                { id: 'urdu', label: 'اردو' },
              ] as const
            ).map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onUpdateSettings({ explanationLanguage: l.id })}
                className={`min-h-[40px] rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  settings.explanationLanguage === l.id
                    ? 'bg-amber-500 text-zinc-950 border-amber-400'
                    : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setMode('step_by_step')}
            className={`min-h-[36px] rounded-lg text-xs font-semibold transition cursor-pointer ${
              mode === 'step_by_step'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-amber-300 shadow-xs'
                : 'text-zinc-500'
            }`}
          >
            Step by Step
          </button>
          <button
            type="button"
            onClick={() => setMode('final_only')}
            className={`min-h-[36px] rounded-lg text-xs font-semibold transition cursor-pointer ${
              mode === 'final_only'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-amber-300 shadow-xs'
                : 'text-zinc-500'
            }`}
          >
            Final Answer Only
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleSolve()}
          disabled={loading}
          className="min-h-[52px] w-full rounded-2xl bg-gradient-to-r from-[#FCE38A] via-[#D4AF37] to-[#B58B1E] text-zinc-950 font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Solving...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Solve Problem
            </>
          )}
        </button>

        {/* Quick Examples */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">
            Try Sample Questions
          </div>
          <div className="flex flex-wrap gap-1.5">
            {samplePrompts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setQuestion(p)}
                className="text-left px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-[#14141A] border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 hover:border-amber-500/40 cursor-pointer truncate max-w-full"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Solution Column */}
      <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-[#0D0D11] border border-zinc-200 dark:border-amber-500/20 p-5 sm:p-6 min-h-[360px] flex flex-col gap-4">
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 flex items-start gap-2.5 text-sm text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {!solution && !loading && !error && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4">
            <Sparkles className="w-10 h-10 text-amber-500/70 mb-3" />
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Ready to Explain Step by Step
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mt-1.5">
              Enter any arithmetic, algebra, trigonometry, geometry, calculus, or English/Urdu word problem to get verified step-by-step explanations.
            </p>
          </div>
        )}

        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              Analyzing and verifying mathematics...
            </div>
          </div>
        )}

        {solution && !loading && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-amber-700 dark:text-amber-400 capitalize">
                  {solution.problemType?.replace('_', ' ') || 'Solution'}
                </span>
                {solution.verifiedDeterministic && (
                  <>
                    <span className="text-zinc-400">·</span>
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mathematically Verified
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    speakText(
                      `${solution.finalAnswer}. ${solution.summary || ''}`,
                      settings.explanationLanguage,
                      settings.speechSpeed
                    )
                  }
                  className="min-h-[36px] px-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-amber-500" />
                  Speak
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(solution.finalAnswer).catch(() => {});
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="min-h-[36px] px-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-zinc-50 dark:bg-[#14141A] border border-zinc-200 dark:border-zinc-800 p-4">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Question</div>
              <div className="font-mono text-base font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                {solution.recognizedQuestion}
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-baseline justify-between gap-3">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  Final Answer
                </span>
                <span className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-300">
                  {solution.finalAnswer}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {solution.steps?.map((s, i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-zinc-50 dark:bg-[#121217] border border-zinc-200 dark:border-zinc-800/80 p-4"
                >
                  <div className="text-xs font-bold text-amber-700 dark:text-amber-400">
                    Step {i + 1}: {s.title}
                  </div>
                  {s.expression && (
                    <div className="mt-1 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {s.expression}
                    </div>
                  )}
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {s.explanation}
                  </p>
                </div>
              ))}
            </div>

            {/* Follow-up Language/Detail Bar */}
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-1.5">
              {[
                'Isko step by step samjhao',
                'Urdu mein samjhao',
                'English mein samjhao',
                'Sirf final answer dikhao',
              ].map((cmd) => (
                <button
                  key={cmd}
                  type="button"
                  onClick={() => handleVoiceFollowup(cmd)}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-[#15151C] border border-zinc-200 dark:border-zinc-800 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:border-amber-500/40 cursor-pointer"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
