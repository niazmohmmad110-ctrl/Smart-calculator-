import React, { useRef, useState } from 'react';
import { Mic, MicOff, Volume2, Sparkles, Play, AlertTriangle } from 'lucide-react';
import { evaluateMathExpression, parseVoiceMathCommand } from '../utils/mathEngine';
import { speakText, stopSpeaking, triggerHaptic } from '../utils/storage';
import { AppSettings, HistoryRecord } from '../types/calculator';

interface VoiceCalculatorProps {
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onSaveHistory: (record: Omit<HistoryRecord, 'id' | 'createdAt'>) => void;
  onSendToSolver: (expr: string) => void;
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

export const VoiceCalculator: React.FC<VoiceCalculatorProps> = ({
  settings,
  onUpdateSettings,
  onSaveHistory,
  onSendToSolver,
}) => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedExpression, setParsedExpression] = useState('');
  const [answer, setAnswer] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  const haptic = () => triggerHaptic(settings.hapticEnabled, 14);

  const processSpokenPhrase = (spoken: string) => {
    setTranscript(spoken);
    setErrorMsg(null);
    setStatusMessage(null);

    const parsed = parseVoiceMathCommand(spoken);

    if (parsed.action === 'clear') {
      setParsedExpression('');
      setAnswer('');
      setStatusMessage('Calculator cleared.');
      if (settings.voiceOutputEnabled) {
        speakText('Calculator cleared', settings.voiceLanguage, settings.speechSpeed);
      }
      return;
    }

    if (parsed.action === 'ai_followup') {
      setStatusMessage('Detected AI explanation request. Opening AI Math Solver...');
      onSendToSolver(spoken);
      return;
    }

    const expr = parsed.expression || '';
    setParsedExpression(expr);

    if (!expr) {
      setErrorMsg('Could not parse a mathematical expression from the phrase. Try speaking numbers and operators clearly.');
      return;
    }

    const evalRes = evaluateMathExpression(expr, {
      angleUnit: settings.angleUnit,
      precision: settings.precision,
      scientificNotation: settings.scientificNotation,
    });

    if (!evalRes.ok || evalRes.formatted === undefined) {
      setErrorMsg(`Parsed "${expr}", but could not evaluate directly. Tap "Solve with AI" for word-problem interpretation.`);
      return;
    }

    setAnswer(evalRes.formatted);
    onSaveHistory({
      question: `${spoken} (${expr})`,
      answer: evalRes.formatted,
      inputMethod: 'Voice',
      verifiedDeterministic: true,
    });

    if (settings.voiceOutputEnabled) {
      const spokenAns =
        settings.voiceLanguage === 'ur-PK'
          ? `جواب ${evalRes.formatted} ہے`
          : settings.voiceLanguage === 'en-PK'
          ? `Jawab ${evalRes.formatted} hai`
          : `The answer is ${evalRes.formatted}`;
      speakText(spokenAns, settings.voiceLanguage, settings.speechSpeed);
    }
  };

  const toggleListening = () => {
    haptic();
    setErrorMsg(null);
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
      setErrorMsg(
        'Live microphone SpeechRecognition is not supported by this browser engine. Use the phrase test box or tap sample commands below.'
      );
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = settings.voiceLanguage;
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      rec.onresult = (event) => {
        const text = event.results?.[0]?.[0]?.transcript || '';
        setListening(false);
        if (text) {
          processSpokenPhrase(text);
        }
      };

      rec.onerror = (ev) => {
        setListening(false);
        if (ev.error === 'not-allowed') {
          setErrorMsg('Microphone permission denied. Enable microphone access in your browser settings.');
        } else if (ev.error !== 'aborted') {
          setErrorMsg(`Voice recognition error: ${ev.error}`);
        }
      };

      rec.onend = () => {
        setListening(false);
      };

      recRef.current = rec;
      setListening(true);
      rec.start();
    } catch (err) {
      setListening(false);
      setErrorMsg(err instanceof Error ? err.message : 'Unable to start microphone.');
    }
  };

  const sampleCommands = [
    { label: 'Five plus five', lang: 'en-US' as const },
    { label: 'One hundred divided by four', lang: 'en-US' as const },
    { label: 'Twenty percent of five hundred', lang: 'en-US' as const },
    { label: 'Square root of 144', lang: 'en-US' as const },
    { label: 'Paanch jama paanch', lang: 'en-PK' as const },
    { label: 'Sau taqseem chaar', lang: 'en-PK' as const },
    { label: 'Das guna bees', lang: 'en-PK' as const },
    { label: 'Pachas ka bees percent', lang: 'en-PK' as const },
    { label: 'Calculator clear karo', lang: 'en-PK' as const },
    { label: 'پانچ جمع پانچ', lang: 'ur-PK' as const },
    { label: 'سو تقسیم چار', lang: 'ur-PK' as const },
    { label: 'پانچ سو کا بیس فیصد', lang: 'ur-PK' as const },
  ];

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Main Voice Console */}
      <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-[#0D0D11] border border-zinc-200 dark:border-amber-500/20 p-6 flex flex-col items-center text-center gap-5">
        <div className="w-full flex flex-wrap items-center justify-between gap-2">
          <div className="text-left">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Voice Math Calculator
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              English · Roman Urdu · اردو
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'en-US', label: 'English' },
                { id: 'en-PK', label: 'Roman Urdu' },
                { id: 'ur-PK', label: 'اردو' },
              ] as const
            ).map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onUpdateSettings({ voiceLanguage: l.id })}
                className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  settings.voiceLanguage === l.id
                    ? 'bg-amber-500 text-zinc-950 border-amber-400'
                    : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Large Gold Mic Trigger */}
        <div className="py-4">
          <button
            type="button"
            onClick={toggleListening}
            aria-label={listening ? 'Stop Listening' : 'Start Voice Command'}
            className={`w-28 h-28 rounded-full flex items-center justify-center transition-transform active:scale-95 cursor-pointer shadow-xl ${
              listening
                ? 'bg-rose-600 text-white shadow-rose-500/30 ring-8 ring-rose-500/20'
                : 'bg-gradient-to-br from-[#FCE38A] via-[#D4AF37] to-[#9E7B1C] text-zinc-950 shadow-amber-500/25 hover:brightness-105'
            }`}
          >
            {listening ? <MicOff className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
          </button>
          <div className="mt-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            {listening ? 'Listening... Speak your math expression' : 'Tap microphone and speak'}
          </div>
        </div>

        {/* Recognized Transcript & Answer Display */}
        <div className="w-full rounded-2xl bg-zinc-50 dark:bg-[#14141A] border border-zinc-200 dark:border-zinc-800 p-4 text-left">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Heard Speech</div>
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mt-0.5 min-h-[20px]">
            {transcript || '—'}
          </div>

          <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Parsed Expression</div>
              <div className="font-mono text-base font-semibold text-zinc-800 dark:text-zinc-200">
                {parsedExpression || '—'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-amber-700 dark:text-amber-400 font-semibold">Result</div>
              <div
                data-testid="voice-result"
                className="font-mono tabular-nums text-3xl font-bold text-amber-600 dark:text-amber-300"
              >
                {answer || '0'}
              </div>
            </div>
          </div>

          {statusMessage && (
            <div className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {statusMessage}
            </div>
          )}

          {errorMsg && (
            <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Voice Output Controls */}
        <div className="w-full flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (answer) {
                  speakText(`Answer is ${answer}`, settings.voiceLanguage, settings.speechSpeed);
                }
              }}
              disabled={!answer}
              className="min-h-[40px] px-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
            >
              <Volume2 className="w-4 h-4 text-amber-500" />
              Speak Answer
            </button>
            <button
              type="button"
              onClick={() => stopSpeaking()}
              className="min-h-[40px] px-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-xs font-semibold text-zinc-600 dark:text-zinc-300 cursor-pointer"
            >
              Mute
            </button>
          </div>

          {parsedExpression && (
            <button
              type="button"
              onClick={() => onSendToSolver(parsedExpression)}
              className="min-h-[40px] px-3.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Explain Steps
            </button>
          )}
        </div>

        {/* Manual Phrase Tester */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manualInput.trim()) processSpokenPhrase(manualInput.trim());
          }}
          className="w-full flex gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800"
        >
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder='Type spoken phrase e.g. "Paanch jama paanch"'
            className="flex-1 min-h-[44px] rounded-xl bg-zinc-50 dark:bg-[#14141A] border border-zinc-200 dark:border-zinc-800 px-3.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            className="min-h-[44px] px-4 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            Run
          </button>
        </form>
      </div>

      {/* Supported Voice Phrases Column */}
      <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-[#0D0D11] border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-3">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
          Tap Any Command to Test
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Works with live microphone speech and instant text-to-speech readout across English, Roman Urdu, and Urdu.
        </p>

        <div className="flex flex-col gap-2">
          {sampleCommands.map((cmd) => (
            <button
              key={cmd.label}
              type="button"
              onClick={() => {
                haptic();
                onUpdateSettings({ voiceLanguage: cmd.lang });
                processSpokenPhrase(cmd.label);
              }}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-[#14141A] border border-zinc-200 dark:border-zinc-800 text-left flex items-center justify-between gap-2 hover:border-amber-500/45 transition cursor-pointer"
            >
              <span className="text-sm text-zinc-800 dark:text-zinc-200">{cmd.label}</span>
              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 shrink-0">
                {cmd.lang === 'en-US' ? 'EN' : cmd.lang === 'en-PK' ? 'Roman UR' : 'UR'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
