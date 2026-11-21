import React, { useEffect, useState } from 'react';
import {
  Calculator,
  FlaskConical,
  Camera,
  Sparkles,
  Mic,
  History,
  Wrench,
  Settings,
  Sun,
  Moon,
  LayoutGrid,
  X,
  WifiOff,
  Download,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ActiveScreen,
  AppSettings,
  HistoryRecord,
  SolveResponse,
} from './types/calculator';
import {
  loadHistory,
  loadMemory,
  loadSettings,
  saveHistory,
  saveMemory,
  saveSettings,
  triggerHaptic,
} from './utils/storage';
import { KbrLogo } from './components/KbrLogo';
import { NormalCalculator } from './components/NormalCalculator';
import { ScientificCalculator } from './components/ScientificCalculator';
import { CameraScanner } from './components/CameraScanner';
import { AiMathSolver } from './components/AiMathSolver';
import { VoiceCalculator } from './components/VoiceCalculator';
import { HistoryScreen } from './components/HistoryScreen';
import { ExtraToolsScreen } from './components/ExtraToolsScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { usePWAInstall } from './hooks/usePWAInstall';

export default function App() {
  const [screen, setScreen] = useState<ActiveScreen>('home');
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [history, setHistory] = useState<HistoryRecord[]>(() => loadHistory());
  const [memory, setMemory] = useState<number>(() => loadMemory());

  const [calcExpression, setCalcExpression] = useState<string>('');
  const [solverQuestion, setSolverQuestion] = useState<string>('');
  const [solverSolution, setSolverSolution] = useState<SolveResponse | null>(null);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, install } = usePWAInstall();

  // Sync dark/light theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', settings.theme === 'dark' ? '#060608' : '#fafaf9');
    }
  }, [settings.theme]);

  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  const handleMemoryChange = (val: number) => {
    setMemory(val);
    saveMemory(val);
  };

  const addHistoryRecord = (record: Omit<HistoryRecord, 'id' | 'createdAt'>) => {
    const newItem: HistoryRecord = {
      ...record,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    setHistory((prev) => {
      const next = [newItem, ...prev];
      saveHistory(next);
      return next;
    });
  };

  const deleteHistoryItem = (id: string) => {
    setHistory((prev) => {
      const next = prev.filter((i) => i.id !== id);
      saveHistory(next);
      return next;
    });
  };

  const clearAllHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  const navigate = (nextScreen: ActiveScreen) => {
    triggerHaptic(settings.hapticEnabled, 10);
    setScreen(nextScreen);
    setMoreSheetOpen(false);
  };

  const sendToSolver = (q: string, sol?: SolveResponse) => {
    setSolverQuestion(q);
    setSolverSolution(sol || null);
    navigate('ai_solver');
  };

  const reopenHistoryItem = (item: HistoryRecord) => {
    triggerHaptic(settings.hapticEnabled, 10);
    if (item.steps && item.steps.length > 0) {
      setSolverQuestion(item.question);
      setSolverSolution({
        ok: true,
        recognizedQuestion: item.question,
        finalAnswer: item.answer,
        steps: item.steps,
        summary: item.summary,
        verifiedDeterministic: item.verifiedDeterministic,
      });
      navigate('ai_solver');
    } else {
      setCalcExpression(item.question);
      navigate('home');
    }
  };

  const navItems: Array<{ id: ActiveScreen; label: string; icon: React.ReactNode }> = [
    { id: 'home', label: 'Calculator', icon: <Calculator className="w-4 h-4" /> },
    { id: 'scientific', label: 'Scientific', icon: <FlaskConical className="w-4 h-4" /> },
    { id: 'camera', label: 'Camera Scan', icon: <Camera className="w-4 h-4" /> },
    { id: 'ai_solver', label: 'AI Solver', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'voice', label: 'Voice Calc', icon: <Mic className="w-4 h-4" /> },
    { id: 'history', label: 'History', icon: <History className="w-4 h-4" /> },
    { id: 'tools', label: 'Extra Tools', icon: <Wrench className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const screenTitle = navItems.find((n) => n.id === screen)?.label || 'Calculator';

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-[#060608] text-zinc-900 dark:text-zinc-100 flex flex-col lg:flex-row">
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:sticky lg:top-0 lg:h-screen bg-white dark:bg-[#0A0A0E] border-r border-zinc-200 dark:border-zinc-800/80 p-4 justify-between">
        <div>
          <div className="flex items-center gap-3 px-2 py-2 mb-6">
            <KbrLogo size={38} />
            <div className="min-w-0">
              <div className="font-display text-sm font-bold text-zinc-950 dark:text-amber-100 truncate">
                KBR Smart Calc Pro
              </div>
              <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                KBR Tech
              </div>
            </div>
          </div>

          <nav className="flex flex-col gap-1" aria-label="Main Navigation">
            {navItems.map((item) => {
              const active = screen === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  className={`min-h-[44px] px-3.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-gradient-to-r from-[#FCE38A] to-[#D4AF37] text-zinc-950 shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-950 dark:hover:text-zinc-100'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800/80">
          {!isInstalled && isInstallable && (
            <button
              type="button"
              onClick={install}
              className="min-h-[42px] px-3 rounded-xl bg-amber-500/15 border border-amber-500/35 text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Install App
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
            }
            className="min-h-[42px] px-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between cursor-pointer"
          >
            <span>{settings.theme === 'dark' ? 'Obsidian Gold' : 'Ivory Gold'}</span>
            {settings.theme === 'dark' ? (
              <Moon className="w-4 h-4 text-amber-400" />
            ) : (
              <Sun className="w-4 h-4 text-amber-600" />
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Compact Sticky Mobile Top Bar (<= 52px) */}
        <header className="lg:hidden sticky top-0 z-30 h-13 px-4 bg-white/90 dark:bg-[#060608]/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <KbrLogo size={30} />
            <span className="font-display text-sm font-bold text-zinc-950 dark:text-amber-100 truncate">
              {screen === 'home' ? 'KBR Calc Pro' : screenTitle}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => navigate('history')}
              aria-label="History"
              className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
            >
              <History className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
              }
              aria-label="Toggle Theme"
              className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
            >
              {settings.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => navigate('settings')}
              aria-label="Settings"
              className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Desktop Compact Page Title Header */}
        <div className="hidden lg:flex items-center justify-between px-8 py-4 border-b border-zinc-200 dark:border-zinc-800/70">
          <h1 className="font-display text-xl font-bold text-zinc-950 dark:text-amber-50">
            {screenTitle}
          </h1>
          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            {!isOnline && (
              <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                <WifiOff className="w-3.5 h-3.5" />
                Offline Calculator Mode
              </span>
            )}
            <span>Language: {settings.explanationLanguage === 'urdu' ? 'اردو' : settings.explanationLanguage === 'roman_urdu' ? 'Roman Urdu' : 'English'}</span>
          </div>
        </div>

        {/* Non-intrusive offline banner on mobile */}
        {!isOnline && (
          <div className="lg:hidden px-4 py-1.5 bg-amber-500/15 border-b border-amber-500/25 text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center justify-center gap-1.5">
            <WifiOff className="w-3.5 h-3.5" />
            Offline Mode — Calculator, Tools & Offline OCR active
          </div>
        )}

        {/* Active Screen Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={screen}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              {screen === 'home' && (
                <NormalCalculator
                  expression={calcExpression}
                  setExpression={setCalcExpression}
                  memory={memory}
                  onMemoryChange={handleMemoryChange}
                  settings={settings}
                  history={history}
                  onSaveHistory={addHistoryRecord}
                  onNavigate={navigate}
                  onSendToSolver={(expr) => sendToSolver(expr)}
                />
              )}

              {screen === 'scientific' && (
                <ScientificCalculator
                  expression={calcExpression}
                  setExpression={setCalcExpression}
                  memory={memory}
                  onMemoryChange={handleMemoryChange}
                  settings={settings}
                  onUpdateSettings={updateSettings}
                  onSaveHistory={addHistoryRecord}
                  onSendToSolver={(expr) => sendToSolver(expr)}
                />
              )}

              {screen === 'camera' && (
                <CameraScanner
                  settings={settings}
                  onUpdateSettings={updateSettings}
                  onSaveHistory={addHistoryRecord}
                  onOpenInSolver={sendToSolver}
                />
              )}

              {screen === 'ai_solver' && (
                <AiMathSolver
                  initialQuestion={solverQuestion}
                  initialSolution={solverSolution}
                  settings={settings}
                  onUpdateSettings={updateSettings}
                  onSaveHistory={addHistoryRecord}
                />
              )}

              {screen === 'voice' && (
                <VoiceCalculator
                  settings={settings}
                  onUpdateSettings={updateSettings}
                  onSaveHistory={addHistoryRecord}
                  onSendToSolver={(expr) => sendToSolver(expr)}
                />
              )}

              {screen === 'history' && (
                <HistoryScreen
                  history={history}
                  hapticEnabled={settings.hapticEnabled}
                  onDeleteItem={deleteHistoryItem}
                  onClearAll={clearAllHistory}
                  onReopenItem={reopenHistoryItem}
                />
              )}

              {screen === 'tools' && (
                <ExtraToolsScreen hapticEnabled={settings.hapticEnabled} />
              )}

              {screen === 'settings' && (
                <SettingsScreen
                  settings={settings}
                  onUpdateSettings={updateSettings}
                  onClearHistory={clearAllHistory}
                  historyCount={history.length}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (5 thumb-friendly destinations) */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#09090D]/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800/90 pb-safe"
      >
        <div className="grid grid-cols-5 items-center h-16 px-1">
          <button
            type="button"
            onClick={() => navigate('home')}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              screen === 'home'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <Calculator className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Calc</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('scientific')}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              screen === 'scientific'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <FlaskConical className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Scientific</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('camera')}
            className="min-h-[48px] flex flex-col items-center justify-center cursor-pointer"
            aria-label="AI Camera Math Scanner"
          >
            <span
              className={`w-12 h-10 rounded-2xl flex items-center justify-center shadow-md transition ${
                screen === 'camera'
                  ? 'bg-amber-400 text-zinc-950 ring-2 ring-amber-300'
                  : 'bg-gradient-to-br from-[#FCE38A] to-[#D4AF37] text-zinc-950'
              }`}
            >
              <Camera className="w-5 h-5" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('voice')}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              screen === 'voice'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <Mic className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Voice</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(settings.hapticEnabled, 10);
              setMoreSheetOpen((v) => !v);
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              ['ai_solver', 'history', 'tools', 'settings'].includes(screen) || moreSheetOpen
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[10px] font-semibold">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile More Bottom Sheet for AI Solver, Extra Tools, History, Settings */}
      <AnimatePresence>
        {moreSheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end"
            onClick={() => setMoreSheetOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-t-3xl bg-white dark:bg-[#0D0D12] border-t border-zinc-200 dark:border-amber-500/25 p-5 pb-safe"
            >
              <div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 mx-auto mb-4" />
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-zinc-900 dark:text-amber-100">
                  All Features
                </span>
                <button
                  type="button"
                  onClick={() => setMoreSheetOpen(false)}
                  className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-zinc-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: 'ai_solver' as const, label: 'AI Math Solver', sub: 'Step-by-step AI', icon: <Sparkles className="w-5 h-5 text-amber-500" /> },
                  { id: 'tools' as const, label: 'Extra Tools', sub: '11 utility calcs', icon: <Wrench className="w-5 h-5 text-amber-500" /> },
                  { id: 'history' as const, label: 'History', sub: `${history.length} saved`, icon: <History className="w-5 h-5 text-amber-500" /> },
                  { id: 'settings' as const, label: 'Settings', sub: 'ZIP, APK & theme', icon: <Settings className="w-5 h-5 text-amber-500" /> },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.id)}
                    className={`min-h-[64px] p-3.5 rounded-2xl border text-left flex items-center gap-3 cursor-pointer ${
                      screen === item.id
                        ? 'bg-amber-500/15 border-amber-500/50'
                        : 'bg-zinc-50 dark:bg-[#14141A] border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    {item.icon}
                    <div>
                      <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {item.sub}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
