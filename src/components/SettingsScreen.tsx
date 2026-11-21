import React, { useEffect, useState } from 'react';
import {
  Camera,
  Mic,
  Cpu,
  Download,
  Smartphone,
  Trash2,
  Sun,
  Moon,
  CheckCircle2,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import { AppSettings } from '../types/calculator';
import { triggerHaptic } from '../utils/storage';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onClearHistory: () => void;
  historyCount: number;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onClearHistory,
  historyCount,
}) => {
  const [aiStatus, setAiStatus] = useState<{ aiConfigured: boolean; model: string } | null>(null);
  const [camPerm, setCamPerm] = useState<string>('checking');
  const [micPerm, setMicPerm] = useState<string>('checking');
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [clearedMsg, setClearedMsg] = useState(false);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSHint, setShowIOSHint] = useState(false);

  const haptic = () => triggerHaptic(settings.hapticEnabled, 12);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setAiStatus({ aiConfigured: Boolean(d.aiConfigured), model: d.model || 'gemini-4-hydrogen' }))
      .catch(() => setAiStatus({ aiConfigured: false, model: 'offline' }));

    const checkPerms = async () => {
      if (navigator.permissions?.query) {
        try {
          const c = await navigator.permissions.query({ name: 'camera' as PermissionName });
          setCamPerm(c.state);
        } catch {
          setCamPerm('prompt');
        }
        try {
          const m = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setMicPerm(m.state);
        } catch {
          setMicPerm('prompt');
        }
      } else {
        setCamPerm('prompt');
        setMicPerm('prompt');
      }
    };
    checkPerms();
  }, []);

  const requestCamPermission = async () => {
    haptic();
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach((t) => t.stop());
      setCamPerm('granted');
    } catch {
      setCamPerm('denied');
    }
  };

  const requestMicPermission = async () => {
    haptic();
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      setMicPerm('granted');
    } catch {
      setMicPerm('denied');
    }
  };

  const handleDownloadZip = async () => {
    haptic();
    setDownloadingZip(true);
    try {
      const res = await fetch('/api/project-zip');
      if (!res.ok) throw new Error('Failed to download ZIP');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kbr-smart-calculator-pro.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5">
      {/* Preferences */}
      <div className="rounded-3xl bg-white dark:bg-[#0D0D11] border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-5">
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
          Preferences & Display
        </h2>

        {/* Theme */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Theme</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Obsidian Black & Gold or Warm Ivory & Gold
            </div>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => {
                haptic();
                onUpdateSettings({ theme: 'dark' });
              }}
              className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                settings.theme === 'dark'
                  ? 'bg-zinc-800 text-amber-300 shadow-xs'
                  : 'text-zinc-500'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              Dark
            </button>
            <button
              type="button"
              onClick={() => {
                haptic();
                onUpdateSettings({ theme: 'light' });
              }}
              className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                settings.theme === 'light'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-500'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              Light
            </button>
          </div>
        </div>

        {/* Explanation Language */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Explanation Language
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Used for AI step-by-step math explanations
            </div>
          </div>
          <div className="flex gap-1.5">
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
                onClick={() => {
                  haptic();
                  onUpdateSettings({ explanationLanguage: l.id });
                }}
                className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold border cursor-pointer ${
                  settings.explanationLanguage === l.id
                    ? 'bg-amber-500 text-zinc-950 border-amber-400'
                    : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Voice Output & Speech Speed */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Voice Answer Output
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Speak voice calculator and follow-up answers aloud
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              haptic();
              onUpdateSettings({ voiceOutputEnabled: !settings.voiceOutputEnabled });
            }}
            className={`min-h-[38px] px-4 rounded-xl text-xs font-bold cursor-pointer ${
              settings.voiceOutputEnabled
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
            }`}
          >
            {settings.voiceOutputEnabled ? 'Enabled' : 'Muted'}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Speech Speed ({settings.speechSpeed.toFixed(1)}x)
          </span>
          <input
            type="range"
            min={0.6}
            max={1.6}
            step={0.1}
            value={settings.speechSpeed}
            onChange={(e) => onUpdateSettings({ speechSpeed: Number(e.target.value) })}
            className="w-44 accent-amber-500"
          />
        </div>

        {/* Haptic Feedback */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Haptic Feedback
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Subtle tactile vibration on keypad presses (Android devices)
            </div>
          </div>
          <button
            type="button"
            onClick={() => onUpdateSettings({ hapticEnabled: !settings.hapticEnabled })}
            className={`min-h-[38px] px-4 rounded-xl text-xs font-bold cursor-pointer ${
              settings.hapticEnabled
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
            }`}
          >
            {settings.hapticEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Calculation Precision */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Calculation Precision
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Maximum decimal digits ({settings.precision} digits)
            </div>
          </div>
          <select
            value={settings.precision}
            onChange={(e) => onUpdateSettings({ precision: Number(e.target.value) })}
            className="min-h-[40px] px-3 rounded-xl bg-zinc-50 dark:bg-[#14141A] border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-900 dark:text-zinc-100"
          >
            {[2, 4, 6, 8, 10, 12].map((n) => (
              <option key={n} value={n}>
                {n} decimal places
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Permissions & AI Service Status */}
      <div className="rounded-3xl bg-white dark:bg-[#0D0D11] border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-4">
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
          Permissions & AI Service Status
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-zinc-50 dark:bg-[#14141A] border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <Camera className="w-4 h-4 text-amber-500" />
              Camera
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
              Status: <span className="font-semibold text-zinc-900 dark:text-zinc-200">{camPerm}</span>
            </div>
            <button
              type="button"
              onClick={requestCamPermission}
              className="min-h-[38px] rounded-xl bg-zinc-200 dark:bg-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer"
            >
              Check / Request
            </button>
          </div>

          <div className="rounded-2xl bg-zinc-50 dark:bg-[#14141A] border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <Mic className="w-4 h-4 text-amber-500" />
              Microphone
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
              Status: <span className="font-semibold text-zinc-900 dark:text-zinc-200">{micPerm}</span>
            </div>
            <button
              type="button"
              onClick={requestMicPermission}
              className="min-h-[38px] rounded-xl bg-zinc-200 dark:bg-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer"
            >
              Check / Request
            </button>
          </div>

          <div className="rounded-2xl bg-zinc-50 dark:bg-[#14141A] border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <Cpu className="w-4 h-4 text-amber-500" />
              AI Math Service
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              {aiStatus?.aiConfigured ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    Configured ({aiStatus.model})
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-amber-700 dark:text-amber-300 font-semibold">
                    Not configured (Offline mode active)
                  </span>
                </>
              )}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Server secret: GEMINI_API_KEY
            </div>
          </div>
        </div>
      </div>

      {/* Android Install, Project ZIP & Data */}
      <div className="rounded-3xl bg-white dark:bg-[#0D0D11] border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-4">
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
          App Package, Android & Storage
        </h2>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={downloadingZip}
            className="min-h-[46px] px-4 rounded-xl bg-gradient-to-r from-[#FCE38A] to-[#D4AF37] text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {downloadingZip ? 'Preparing ZIP...' : 'Download Complete Project ZIP'}
          </button>

          {!isInstalled && isInstallable && (
            <button
              type="button"
              onClick={install}
              className="min-h-[46px] px-4 rounded-xl bg-zinc-900 dark:bg-zinc-800 text-amber-300 border border-amber-500/40 font-semibold text-xs flex items-center gap-2 cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              Install on Android / Device
            </button>
          )}

          {!isInstalled && isIOS && (
            <button
              type="button"
              onClick={() => setShowIOSHint((v) => !v)}
              className="min-h-[46px] px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              Install on iOS
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowDocs((v) => !v)}
            className="min-h-[46px] px-4 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-amber-500" />
            {showDocs ? 'Hide APK & Setup Guide' : 'Android APK & API Setup Guide'}
          </button>

          <button
            type="button"
            onClick={() => {
              haptic();
              onClearHistory();
              setClearedMsg(true);
              setTimeout(() => setClearedMsg(false), 2000);
            }}
            className="min-h-[46px] px-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/25 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            {clearedMsg ? 'History Cleared' : `Clear History (${historyCount})`}
          </button>
        </div>

        {showIOSHint && (
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#14141A] border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300">
            Tap the <strong>Share</strong> icon in Safari, then choose <strong>Add to Home Screen</strong>.
          </div>
        )}

        {showDocs && (
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#14141A] border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 space-y-2.5 leading-relaxed">
            <div className="font-bold text-amber-700 dark:text-amber-300">
              1. Configure Gemini API Key (Server-Side)
            </div>
            <p>
              Set <code className="font-mono">GEMINI_API_KEY</code> in your server environment or in Google AI Studio{' '}
              <strong>Settings &gt; Secrets</strong>. The Express backend (<code className="font-mono">server.ts</code>)
              keeps your key strictly on the server.
            </p>
            <div className="font-bold text-amber-700 dark:text-amber-300 pt-1">
              2. Build Android APK (Capacitor or Bubblewrap TWA)
            </div>
            <p>
              Download the project ZIP above, extract it, run <code className="font-mono">npm install &amp;&amp; npm run build</code>,
              then wrap <code className="font-mono">dist/</code> with Capacitor (<code className="font-mono">npx cap add android &amp;&amp; npx cap open android</code>)
              or Bubblewrap (<code className="font-mono">bubblewrap init --manifest ...</code>). Full instructions are included in{' '}
              <code className="font-mono">README.md</code> and <code className="font-mono">ANDROID_APK_GUIDE.md</code>.
            </p>
          </div>
        )}

        {/* About KBR Tech */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <div>
            <strong className="text-zinc-900 dark:text-zinc-100">KBR Smart Calculator Pro</strong> · Built by{' '}
            <strong className="text-amber-600 dark:text-amber-400">KBR Tech</strong>
          </div>
          <div className="font-mono">Version 1.0.0</div>
        </div>
      </div>
    </div>
  );
};
