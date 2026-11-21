import React, { useEffect, useState } from 'react';
import {
  Camera,
  Mic,
  Delete,
  Sparkles,
  Volume2,
  Copy,
  Check,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { evaluateMathExpression } from '../utils/mathEngine';
import { triggerHaptic, speakText } from '../utils/storage';
import { AppSettings, HistoryRecord, ActiveScreen } from '../types/calculator';

interface NormalCalculatorProps {
  expression: string;
  setExpression: React.Dispatch<React.SetStateAction<string>>;
  memory: number;
  onMemoryChange: (val: number) => void;
  settings: AppSettings;
  history: HistoryRecord[];
  onSaveHistory: (record: Omit<HistoryRecord, 'id' | 'createdAt'>) => void;
  onNavigate: (screen: ActiveScreen) => void;
  onSendToSolver: (expr: string) => void;
}

export const NormalCalculator: React.FC<NormalCalculatorProps> = ({
  expression,
  setExpression,
  memory,
  onMemoryChange,
  settings,
  history,
  onSaveHistory,
  onNavigate,
  onSendToSolver,
}) => {
  const [result, setResult] = useState<string>('0');
  const [fractionHint, setFractionHint] = useState<string | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [copied, setCopied] = useState(false);

  // Live preview calculation
  useEffect(() => {
    if (!expression.trim()) {
      setResult('0');
      setFractionHint(undefined);
      setErrorMsg(null);
      return;
    }
    const evalRes = evaluateMathExpression(expression, {
      angleUnit: settings.angleUnit,
      precision: settings.precision,
      scientificNotation: settings.scientificNotation,
    });
    if (evalRes.ok && evalRes.formatted !== undefined) {
      setResult(evalRes.formatted);
      setFractionHint(evalRes.fraction);
      setErrorMsg(null);
    } else {
      setFractionHint(undefined);
    }
  }, [expression, settings.angleUnit, settings.precision, settings.scientificNotation]);

  const haptic = () => triggerHaptic(settings.hapticEnabled, 12);

  const appendToken = (token: string, isOperator = false) => {
    haptic();
    setErrorMsg(null);
    if (justEvaluated) {
      setJustEvaluated(false);
      if (isOperator) {
        setExpression((result !== 'Undefined' ? result : '0') + token);
      } else {
        setExpression(token);
      }
      return;
    }
    setExpression((prev) => prev + token);
  };

  const handleClear = () => {
    haptic();
    setExpression('');
    setResult('0');
    setFractionHint(undefined);
    setErrorMsg(null);
    setJustEvaluated(false);
  };

  const handleBackspace = () => {
    haptic();
    setErrorMsg(null);
    setJustEvaluated(false);
    setExpression((prev) => {
      if (prev.endsWith('sqrt(')) return prev.slice(0, -5);
      return prev.slice(0, -1);
    });
  };

  const handleEquals = () => {
    haptic();
    if (!expression.trim()) return;
    const evalRes = evaluateMathExpression(expression, {
      angleUnit: settings.angleUnit,
      precision: settings.precision,
      scientificNotation: settings.scientificNotation,
    });
    if (!evalRes.ok || evalRes.formatted === undefined) {
      setErrorMsg(evalRes.error || 'Invalid expression');
      return;
    }
    setResult(evalRes.formatted);
    setFractionHint(evalRes.fraction);
    setErrorMsg(null);
    setJustEvaluated(true);
    onSaveHistory({
      question: expression,
      answer: evalRes.formatted,
      inputMethod: 'Keyboard',
      verifiedDeterministic: true,
    });
    if (settings.voiceOutputEnabled && settings.speechSpeed > 0) {
      // Speak only on explicit tap of speaker or voice screen, keep button calc crisp
    }
  };

  const handleUnaryOp = (type: 'sqrt' | 'sq' | 'cube' | 'inv' | 'fact') => {
    haptic();
    const target = expression.trim() || result;
    if (!target || target === '0' && !expression.trim()) {
      if (type === 'sqrt') {
        appendToken('√(');
      }
      return;
    }
    const wrapped = /[+\-×÷*/^]/.test(target) && !target.startsWith('(') ? `(${target})` : target;
    let next = target;
    if (type === 'sqrt') next = `√(${target})`;
    if (type === 'sq') next = `${wrapped}²`;
    if (type === 'cube') next = `${wrapped}³`;
    if (type === 'inv') next = `1/(${target})`;
    if (type === 'fact') next = `${wrapped}!`;
    setExpression(next);
    setJustEvaluated(false);
  };

  const handleMemory = (op: 'MC' | 'MR' | 'M+' | 'M-') => {
    haptic();
    if (op === 'MC') {
      onMemoryChange(0);
      return;
    }
    if (op === 'MR') {
      appendToken(String(memory));
      return;
    }
    const currentNum = Number(result);
    if (!Number.isFinite(currentNum)) return;
    if (op === 'M+') onMemoryChange(memory + currentNum);
    if (op === 'M-') onMemoryChange(memory - currentNum);
  };

  const handleCopy = async () => {
    haptic();
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard fallback
    }
  };

  // Physical keyboard support
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (/^[0-9.()]$/.test(e.key)) {
        appendToken(e.key);
      } else if (e.key === '+') {
        appendToken('+', true);
      } else if (e.key === '-') {
        appendToken('−', true);
      } else if (e.key === '*') {
        appendToken('×', true);
      } else if (e.key === '/') {
        e.preventDefault();
        appendToken('÷', true);
      } else if (e.key === '%') {
        appendToken('%', true);
      } else if (e.key === '^') {
        appendToken('^', true);
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const recentKeyboardHistory = history.slice(0, 6);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Main Calculator Column */}
      <div className="lg:col-span-7 xl:col-span-7 flex flex-col gap-3.5">
        {/* Prominent AI Camera + Voice Quick Action Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => {
              haptic();
              onNavigate('camera');
            }}
            className="sm:col-span-2 min-h-[54px] px-4 py-3 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#F0CE6B] to-[#C99E26] text-zinc-950 font-semibold shadow-lg shadow-amber-500/15 hover:brightness-105 active:scale-[0.99] transition flex items-center justify-between gap-3 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-zinc-950/15 flex items-center justify-center shrink-0">
                <Camera className="w-5 h-5 text-zinc-950" />
              </span>
              <div className="text-left">
                <div className="text-sm font-bold leading-tight whitespace-nowrap">
                  AI Camera Math Scan
                </div>
                <div className="text-[11px] font-medium text-zinc-900/80 whitespace-nowrap">
                  Scan notebook, textbook or handwriting
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => {
              haptic();
              onNavigate('voice');
            }}
            className="min-h-[54px] px-4 py-3 rounded-2xl bg-white dark:bg-[#121216] border border-amber-500/35 text-zinc-900 dark:text-amber-300 font-semibold hover:border-amber-400 active:scale-[0.99] transition flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <Mic className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0" />
            <span className="text-sm whitespace-nowrap">Voice Math</span>
          </button>
        </div>

        {/* Premium Display Panel */}
        <div className="rounded-3xl bg-white dark:bg-[#0D0D11] border border-zinc-200 dark:border-amber-500/20 p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            <div className="flex items-center gap-3">
              <span className="font-medium text-amber-700 dark:text-amber-400">
                {settings.angleUnit}
              </span>
              {memory !== 0 && (
                <span className="font-mono text-amber-600 dark:text-amber-300">
                  M = {memory}
                </span>
              )}
              {fractionHint && (
                <span className="font-mono text-zinc-500 dark:text-zinc-400">
                  Fraction: {fractionHint}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  haptic();
                  speakText(`Answer is ${result}`, settings.explanationLanguage, settings.speechSpeed);
                }}
                title="Speak result"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/70 text-zinc-500 dark:text-zinc-400 transition cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleCopy}
                title="Copy result"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/70 text-zinc-500 dark:text-zinc-400 transition cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="min-h-[34px] text-right font-mono text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 break-all tracking-tight">
            {expression || '0'}
          </div>

          <div className="mt-2 flex items-baseline justify-end gap-3 overflow-x-auto">
            <div
              data-testid="calc-result"
              className="font-mono tabular-nums text-4xl sm:text-5xl font-bold text-zinc-950 dark:text-amber-50 tracking-tight"
            >
              {result}
            </div>
          </div>

          {errorMsg && (
            <div className="mt-2 text-xs text-rose-500 text-right font-medium">{errorMsg}</div>
          )}

          {expression.trim() && (
            <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Need step-by-step explanation?
              </span>
              <button
                type="button"
                onClick={() => {
                  haptic();
                  onSendToSolver(expression);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Explain with AI
              </button>
            </div>
          )}
        </div>

        {/* Memory & Advanced Row */}
        <div className="grid grid-cols-6 gap-2">
          {(['MC', 'MR', 'M+', 'M-'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => handleMemory(m)}
              className="min-h-[44px] rounded-xl bg-zinc-100 dark:bg-[#131318] border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-amber-500/40 active:scale-[0.97] transition cursor-pointer"
            >
              {m}
            </button>
          ))}
          <button
            type="button"
            onClick={() => appendToken('(')}
            className="min-h-[44px] rounded-xl bg-zinc-100 dark:bg-[#131318] border border-zinc-200 dark:border-zinc-800 text-sm font-mono font-semibold text-zinc-700 dark:text-zinc-300 hover:border-amber-500/40 active:scale-[0.97] transition cursor-pointer"
          >
            (
          </button>
          <button
            type="button"
            onClick={() => appendToken(')')}
            className="min-h-[44px] rounded-xl bg-zinc-100 dark:bg-[#131318] border border-zinc-200 dark:border-zinc-800 text-sm font-mono font-semibold text-zinc-700 dark:text-zinc-300 hover:border-amber-500/40 active:scale-[0.97] transition cursor-pointer"
          >
            )
          </button>
        </div>

        {/* Extra Scientific Quick Row: √, x², x³, xʸ, 1/x, π, n! */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => handleUnaryOp('sqrt')}
            className="min-h-[44px] rounded-xl bg-zinc-100 dark:bg-[#141419] border border-zinc-200 dark:border-zinc-800/90 text-sm font-mono font-semibold text-amber-700 dark:text-amber-300 hover:border-amber-500/50 active:scale-[0.97] transition cursor-pointer"
          >
            √x
          </button>
          <button
            type="button"
            onClick={() => handleUnaryOp('sq')}
            className="min-h-[44px] rounded-xl bg-zinc-100 dark:bg-[#141419] border border-zinc-200 dark:border-zinc-800/90 text-sm font-mono font-semibold text-amber-700 dark:text-amber-300 hover:border-amber-500/50 active:scale-[0.97] transition cursor-pointer"
          >
            x²
          </button>
          <button
            type="button"
            onClick={() => handleUnaryOp('cube')}
            className="min-h-[44px] rounded-xl bg-zinc-100 dark:bg-[#141419] border border-zinc-200 dark:border-zinc-800/90 text-sm font-mono font-semibold text-amber-700 dark:text-amber-300 hover:border-amber-500/50 active:scale-[0.97] transition cursor-pointer"
          >
            x³
          </button>
          <button
            type="button"
            onClick={() => appendToken('^', true)}
            className="min-h-[44px] rounded-xl bg-zinc-100 dark:bg-[#141419] border border-zinc-200 dark:border-zinc-800/90 text-sm font-mono font-semibold text-amber-700 dark:text-amber-300 hover:border-amber-500/50 active:scale-[0.97] transition cursor-pointer"
          >
            xʸ
          </button>
          <button
            type="button"
            onClick={() => handleUnaryOp('inv')}
            className="min-h-[44px] rounded-xl bg-zinc-100 dark:bg-[#141419] border border-zinc-200 dark:border-zinc-800/90 text-xs sm:text-sm font-mono font-semibold text-amber-700 dark:text-amber-300 hover:border-amber-500/50 active:scale-[0.97] transition cursor-pointer"
          >
            1/x
          </button>
          <button
            type="button"
            onClick={() => appendToken('π')}
            className="min-h-[44px] rounded-xl bg-zinc-100 dark:bg-[#141419] border border-zinc-200 dark:border-zinc-800/90 text-sm font-mono font-semibold text-amber-700 dark:text-amber-300 hover:border-amber-500/50 active:scale-[0.97] transition cursor-pointer"
          >
            π
          </button>
          <button
            type="button"
            onClick={() => handleUnaryOp('fact')}
            className="min-h-[44px] rounded-xl bg-zinc-100 dark:bg-[#141419] border border-zinc-200 dark:border-zinc-800/90 text-sm font-mono font-semibold text-amber-700 dark:text-amber-300 hover:border-amber-500/50 active:scale-[0.97] transition cursor-pointer"
          >
            n!
          </button>
        </div>

        {/* Core Numeric + Operator Keypad */}
        <div className="grid grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={handleClear}
            className="min-h-[56px] rounded-2xl bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-500/25 text-base font-bold text-rose-600 dark:text-rose-400 hover:brightness-105 active:scale-[0.97] transition cursor-pointer"
          >
            C
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            aria-label="Delete"
            className="min-h-[56px] rounded-2xl bg-zinc-100 dark:bg-[#16161C] border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 flex items-center justify-center hover:border-amber-500/40 active:scale-[0.97] transition cursor-pointer"
          >
            <Delete className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => appendToken('%', true)}
            className="min-h-[56px] rounded-2xl bg-zinc-100 dark:bg-[#16161C] border border-zinc-200 dark:border-zinc-800 text-xl font-mono font-semibold text-amber-700 dark:text-amber-400 hover:border-amber-500/40 active:scale-[0.97] transition cursor-pointer"
          >
            %
          </button>
          <button
            type="button"
            onClick={() => appendToken('÷', true)}
            className="min-h-[56px] rounded-2xl bg-amber-500/12 dark:bg-amber-500/15 border border-amber-500/35 text-2xl font-mono font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-500/25 active:scale-[0.97] transition cursor-pointer"
          >
            ÷
          </button>

          {['7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => appendToken(d)}
              className="min-h-[58px] rounded-2xl bg-white dark:bg-[#121217] border border-zinc-200 dark:border-zinc-800 text-2xl font-mono font-semibold text-zinc-900 dark:text-zinc-100 hover:border-amber-500/40 active:scale-[0.97] transition cursor-pointer shadow-xs"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => appendToken('×', true)}
            className="min-h-[58px] rounded-2xl bg-amber-500/12 dark:bg-amber-500/15 border border-amber-500/35 text-2xl font-mono font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-500/25 active:scale-[0.97] transition cursor-pointer"
          >
            ×
          </button>

          {['4', '5', '6'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => appendToken(d)}
              className="min-h-[58px] rounded-2xl bg-white dark:bg-[#121217] border border-zinc-200 dark:border-zinc-800 text-2xl font-mono font-semibold text-zinc-900 dark:text-zinc-100 hover:border-amber-500/40 active:scale-[0.97] transition cursor-pointer shadow-xs"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => appendToken('−', true)}
            className="min-h-[58px] rounded-2xl bg-amber-500/12 dark:bg-amber-500/15 border border-amber-500/35 text-2xl font-mono font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-500/25 active:scale-[0.97] transition cursor-pointer"
          >
            −
          </button>

          {['1', '2', '3'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => appendToken(d)}
              className="min-h-[58px] rounded-2xl bg-white dark:bg-[#121217] border border-zinc-200 dark:border-zinc-800 text-2xl font-mono font-semibold text-zinc-900 dark:text-zinc-100 hover:border-amber-500/40 active:scale-[0.97] transition cursor-pointer shadow-xs"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => appendToken('+', true)}
            className="min-h-[58px] rounded-2xl bg-amber-500/12 dark:bg-amber-500/15 border border-amber-500/35 text-2xl font-mono font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-500/25 active:scale-[0.97] transition cursor-pointer"
          >
            +
          </button>

          <button
            type="button"
            onClick={() => appendToken('00')}
            className="min-h-[58px] rounded-2xl bg-white dark:bg-[#121217] border border-zinc-200 dark:border-zinc-800 text-xl font-mono font-semibold text-zinc-900 dark:text-zinc-100 hover:border-amber-500/40 active:scale-[0.97] transition cursor-pointer shadow-xs"
          >
            00
          </button>
          <button
            type="button"
            onClick={() => appendToken('0')}
            className="min-h-[58px] rounded-2xl bg-white dark:bg-[#121217] border border-zinc-200 dark:border-zinc-800 text-2xl font-mono font-semibold text-zinc-900 dark:text-zinc-100 hover:border-amber-500/40 active:scale-[0.97] transition cursor-pointer shadow-xs"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => appendToken('.')}
            className="min-h-[58px] rounded-2xl bg-white dark:bg-[#121217] border border-zinc-200 dark:border-zinc-800 text-2xl font-mono font-semibold text-zinc-900 dark:text-zinc-100 hover:border-amber-500/40 active:scale-[0.97] transition cursor-pointer shadow-xs"
          >
            .
          </button>
          <button
            type="button"
            onClick={handleEquals}
            className="min-h-[58px] rounded-2xl bg-gradient-to-br from-[#FCE38A] via-[#D4AF37] to-[#A67C1B] text-zinc-950 text-2xl font-mono font-bold shadow-lg shadow-amber-500/20 hover:brightness-105 active:scale-[0.97] transition cursor-pointer"
          >
            =
          </button>
        </div>
      </div>

      {/* Desktop Live Tape & Quick Switcher Column */}
      <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-4">
        <div className="rounded-3xl bg-white dark:bg-[#0D0D11] border border-zinc-200 dark:border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Recent Calculation Tape
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>

          {recentKeyboardHistory.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No calculations yet. Tap keys, scan with AI Camera, or speak a command.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {recentKeyboardHistory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    haptic();
                    setExpression(item.question);
                    setJustEvaluated(false);
                  }}
                  className="w-full py-3 text-left flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 px-2 rounded-xl transition cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      {item.inputMethod} · {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="font-mono text-sm text-zinc-700 dark:text-zinc-300 truncate mt-0.5">
                      {item.question}
                    </div>
                  </div>
                  <div className="font-mono tabular-nums text-base font-bold text-amber-700 dark:text-amber-400 shrink-0">
                    = {item.answer}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Mode Switch Card */}
        <div className="rounded-3xl bg-white dark:bg-[#0D0D11] border border-zinc-200 dark:border-zinc-800 p-5">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Quick Math Modes
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('scientific')}
              className="min-h-[48px] px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#141419] border border-zinc-200 dark:border-zinc-800 text-left hover:border-amber-500/40 transition cursor-pointer"
            >
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Scientific</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Trig, log, roots</div>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('ai_solver')}
              className="min-h-[48px] px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#141419] border border-zinc-200 dark:border-zinc-800 text-left hover:border-amber-500/40 transition cursor-pointer"
            >
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">AI Solver</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Word problems & steps</div>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('tools')}
              className="min-h-[48px] px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#141419] border border-zinc-200 dark:border-zinc-800 text-left hover:border-amber-500/40 transition cursor-pointer"
            >
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">11 Tools</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">EMI, tax, units</div>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('voice')}
              className="min-h-[48px] px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#141419] border border-zinc-200 dark:border-zinc-800 text-left hover:border-amber-500/40 transition cursor-pointer"
            >
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Voice Calc</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Urdu & English</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
