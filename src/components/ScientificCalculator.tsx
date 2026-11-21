import React, { useEffect, useState } from 'react';
import { Delete, Sparkles, Volume2 } from 'lucide-react';
import { evaluateMathExpression } from '../utils/mathEngine';
import { triggerHaptic, speakText } from '../utils/storage';
import { AppSettings } from '../types/calculator';

interface ScientificCalculatorProps {
  expression: string;
  setExpression: React.Dispatch<React.SetStateAction<string>>;
  memory: number;
  onMemoryChange: (val: number) => void;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onSaveHistory: (record: { question: string; answer: string; inputMethod: 'Keyboard'; verifiedDeterministic: boolean }) => void;
  onSendToSolver: (expr: string) => void;
}

export const ScientificCalculator: React.FC<ScientificCalculatorProps> = ({
  expression,
  setExpression,
  memory,
  onMemoryChange,
  settings,
  onUpdateSettings,
  onSaveHistory,
  onSendToSolver,
}) => {
  const [result, setResult] = useState('0');
  const [fraction, setFraction] = useState<string | undefined>();
  const [showFraction, setShowFraction] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [justEvaluated, setJustEvaluated] = useState(false);

  useEffect(() => {
    if (!expression.trim()) {
      setResult('0');
      setFraction(undefined);
      setErrorMsg(null);
      return;
    }
    const res = evaluateMathExpression(expression, {
      angleUnit: settings.angleUnit,
      precision: settings.precision,
      scientificNotation: settings.scientificNotation,
    });
    if (res.ok && res.formatted !== undefined) {
      setResult(res.formatted);
      setFraction(res.fraction);
      setErrorMsg(null);
    }
  }, [expression, settings.angleUnit, settings.precision, settings.scientificNotation]);

  const haptic = () => triggerHaptic(settings.hapticEnabled, 12);

  const append = (tok: string, isOp = false) => {
    haptic();
    setErrorMsg(null);
    if (justEvaluated) {
      setJustEvaluated(false);
      setExpression(isOp ? `${result}${tok}` : tok);
      return;
    }
    setExpression((p) => p + tok);
  };

  const handleEquals = () => {
    haptic();
    if (!expression.trim()) return;
    const res = evaluateMathExpression(expression, {
      angleUnit: settings.angleUnit,
      precision: settings.precision,
      scientificNotation: settings.scientificNotation,
    });
    if (!res.ok || res.formatted === undefined) {
      setErrorMsg(res.error || 'Syntax error');
      return;
    }
    setResult(res.formatted);
    setFraction(res.fraction);
    setJustEvaluated(true);
    onSaveHistory({
      question: expression,
      answer: showFraction && res.fraction ? res.fraction : res.formatted,
      inputMethod: 'Keyboard',
      verifiedDeterministic: true,
    });
  };

  const handleBackspace = () => {
    haptic();
    setJustEvaluated(false);
    setExpression((p) => {
      const fnSuffixes = ['sin⁻¹(', 'cos⁻¹(', 'tan⁻¹(', 'sin(', 'cos(', 'tan(', 'log(', 'ln(', '√(', '∛('];
      for (const s of fnSuffixes) {
        if (p.endsWith(s)) return p.slice(0, -s.length);
      }
      return p.slice(0, -1);
    });
  };

  const handleClear = () => {
    haptic();
    setExpression('');
    setResult('0');
    setFraction(undefined);
    setErrorMsg(null);
    setJustEvaluated(false);
  };

  const displayedAnswer = showFraction && fraction ? fraction : result;

  const sciButtons: Array<{ label: string; action: () => void; accent?: boolean }> = [
    { label: 'sin', action: () => append('sin(') },
    { label: 'cos', action: () => append('cos(') },
    { label: 'tan', action: () => append('tan(') },
    { label: 'log', action: () => append('log(') },
    { label: 'ln', action: () => append('ln(') },

    { label: 'sin⁻¹', action: () => append('sin⁻¹(') },
    { label: 'cos⁻¹', action: () => append('cos⁻¹(') },
    { label: 'tan⁻¹', action: () => append('tan⁻¹(') },
    { label: '10ˣ', action: () => append('10^(') },
    { label: 'eˣ', action: () => append('e^(') },

    { label: '√', action: () => append('√(') },
    { label: '∛', action: () => append('∛(') },
    { label: 'x²', action: () => append('²', true) },
    { label: 'x³', action: () => append('³', true) },
    { label: 'xʸ', action: () => append('^', true) },

    { label: 'π', action: () => append('π') },
    { label: 'e', action: () => append('e') },
    { label: 'n!', action: () => append('!', true) },
    { label: '(', action: () => append('(') },
    { label: ')', action: () => append(')') },
  ];

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4">
      {/* Display */}
      <div className="rounded-3xl bg-white dark:bg-[#0D0D11] border border-zinc-200 dark:border-amber-500/20 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                haptic();
                onUpdateSettings({ angleUnit: settings.angleUnit === 'DEG' ? 'RAD' : 'DEG' });
              }}
              className="min-h-[36px] px-3 rounded-lg bg-amber-500/15 border border-amber-500/35 text-xs font-bold text-amber-700 dark:text-amber-300 cursor-pointer"
            >
              {settings.angleUnit}
            </button>
            <button
              type="button"
              onClick={() => {
                haptic();
                onUpdateSettings({ scientificNotation: !settings.scientificNotation });
              }}
              className={`min-h-[36px] px-3 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                settings.scientificNotation
                  ? 'bg-amber-500 text-zinc-950 border-amber-400'
                  : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300'
              }`}
            >
              SCI
            </button>
            <button
              type="button"
              onClick={() => {
                haptic();
                setShowFraction((v) => !v);
              }}
              className={`min-h-[36px] px-3 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                showFraction
                  ? 'bg-amber-500 text-zinc-950 border-amber-400'
                  : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300'
              }`}
            >
              a/b {fraction ? `(${fraction})` : ''}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {memory !== 0 && (
              <span className="text-xs font-mono text-amber-600 dark:text-amber-300 mr-2">
                M={memory}
              </span>
            )}
            <button
              type="button"
              onClick={() => speakText(`Result is ${displayedAnswer}`, settings.explanationLanguage, settings.speechSpeed)}
              className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 cursor-pointer"
              title="Speak result"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            {expression.trim() && (
              <button
                type="button"
                onClick={() => onSendToSolver(expression)}
                className="min-h-[36px] px-2.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI Steps
              </button>
            )}
          </div>
        </div>

        <div className="min-h-[28px] text-right font-mono text-base sm:text-lg text-zinc-500 dark:text-zinc-400 break-all">
          {expression || '0'}
        </div>
        <div className="mt-1 text-right font-mono tabular-nums text-3xl sm:text-5xl font-bold text-zinc-950 dark:text-amber-50 overflow-x-auto">
          {displayedAnswer}
        </div>
        {errorMsg && <div className="mt-1.5 text-xs text-rose-500 text-right">{errorMsg}</div>}
      </div>

      {/* Scientific Functions Grid */}
      <div className="grid grid-cols-5 gap-2">
        {sciButtons.map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={btn.action}
            className="min-h-[46px] rounded-xl bg-zinc-100 dark:bg-[#14141A] border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm font-mono font-semibold text-amber-700 dark:text-amber-300 hover:border-amber-500/50 active:scale-[0.97] transition cursor-pointer"
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Memory Row */}
      <div className="grid grid-cols-4 gap-2">
        {(['MC', 'MR', 'M+', 'M-'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              haptic();
              if (m === 'MC') onMemoryChange(0);
              if (m === 'MR') append(String(memory));
              const num = Number(result);
              if (Number.isFinite(num)) {
                if (m === 'M+') onMemoryChange(memory + num);
                if (m === 'M-') onMemoryChange(memory - num);
              }
            }}
            className="min-h-[44px] rounded-xl bg-zinc-100 dark:bg-[#131318] border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-amber-500/40 cursor-pointer"
          >
            {m}
          </button>
        ))}
      </div>

      {/* Standard Keypad */}
      <div className="grid grid-cols-4 gap-2.5">
        <button
          type="button"
          onClick={handleClear}
          className="min-h-[52px] rounded-2xl bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-500/25 text-base font-bold text-rose-600 dark:text-rose-400 cursor-pointer"
        >
          AC
        </button>
        <button
          type="button"
          onClick={handleBackspace}
          className="min-h-[52px] rounded-2xl bg-zinc-100 dark:bg-[#16161C] border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-200 cursor-pointer"
        >
          <Delete className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => append('%', true)}
          className="min-h-[52px] rounded-2xl bg-zinc-100 dark:bg-[#16161C] border border-zinc-200 dark:border-zinc-800 text-lg font-mono font-semibold text-amber-700 dark:text-amber-400 cursor-pointer"
        >
          %
        </button>
        <button
          type="button"
          onClick={() => append('÷', true)}
          className="min-h-[52px] rounded-2xl bg-amber-500/15 border border-amber-500/35 text-xl font-mono font-semibold text-amber-700 dark:text-amber-400 cursor-pointer"
        >
          ÷
        </button>

        {['7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => append(d)}
            className="min-h-[54px] rounded-2xl bg-white dark:bg-[#121217] border border-zinc-200 dark:border-zinc-800 text-xl font-mono font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => append('×', true)}
          className="min-h-[54px] rounded-2xl bg-amber-500/15 border border-amber-500/35 text-xl font-mono font-semibold text-amber-700 dark:text-amber-400 cursor-pointer"
        >
          ×
        </button>

        {['4', '5', '6'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => append(d)}
            className="min-h-[54px] rounded-2xl bg-white dark:bg-[#121217] border border-zinc-200 dark:border-zinc-800 text-xl font-mono font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => append('−', true)}
          className="min-h-[54px] rounded-2xl bg-amber-500/15 border border-amber-500/35 text-xl font-mono font-semibold text-amber-700 dark:text-amber-400 cursor-pointer"
        >
          −
        </button>

        {['1', '2', '3'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => append(d)}
            className="min-h-[54px] rounded-2xl bg-white dark:bg-[#121217] border border-zinc-200 dark:border-zinc-800 text-xl font-mono font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => append('+', true)}
          className="min-h-[54px] rounded-2xl bg-amber-500/15 border border-amber-500/35 text-xl font-mono font-semibold text-amber-700 dark:text-amber-400 cursor-pointer"
        >
          +
        </button>

        <button
          type="button"
          onClick={() => append('0')}
          className="col-span-2 min-h-[54px] rounded-2xl bg-white dark:bg-[#121217] border border-zinc-200 dark:border-zinc-800 text-xl font-mono font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => append('.')}
          className="min-h-[54px] rounded-2xl bg-white dark:bg-[#121217] border border-zinc-200 dark:border-zinc-800 text-xl font-mono font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer"
        >
          .
        </button>
        <button
          type="button"
          onClick={handleEquals}
          className="min-h-[54px] rounded-2xl bg-gradient-to-br from-[#FCE38A] via-[#D4AF37] to-[#A67C1B] text-zinc-950 text-2xl font-mono font-bold cursor-pointer"
        >
          =
        </button>
      </div>
    </div>
  );
};
