import React, { useState } from 'react';
import {
  Trash2,
  Copy,
  Check,
  Share2,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Search,
  Clock,
} from 'lucide-react';
import { HistoryRecord, InputMethod } from '../types/calculator';
import { triggerHaptic } from '../utils/storage';

interface HistoryScreenProps {
  history: HistoryRecord[];
  hapticEnabled: boolean;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
  onReopenItem: (item: HistoryRecord) => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  history,
  hapticEnabled,
  onDeleteItem,
  onClearAll,
  onReopenItem,
}) => {
  const [filter, setFilter] = useState<'All' | InputMethod>('All');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const haptic = () => triggerHaptic(hapticEnabled, 12);

  const filtered = history.filter((item) => {
    const matchesMethod = filter === 'All' || item.inputMethod === filter;
    const q = search.trim().toLowerCase();
    const matchesText =
      !q ||
      item.question.toLowerCase().includes(q) ||
      item.answer.toLowerCase().includes(q);
    return matchesMethod && matchesText;
  });

  const handleCopy = async (item: HistoryRecord) => {
    haptic();
    await navigator.clipboard.writeText(`${item.question} = ${item.answer}`).catch(() => {});
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleShare = async (item: HistoryRecord) => {
    haptic();
    const stepsText = item.steps?.length
      ? '\n\nSteps:\n' +
        item.steps.map((s, idx) => `${idx + 1}. ${s.title}: ${s.expression} (${s.explanation})`).join('\n')
      : '';
    const shareText = `KBR Smart Calculator Pro\nQuestion: ${item.question}\nAnswer: ${item.answer}${stepsText}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'KBR Smart Calculator Pro Solution',
          text: shareText,
        });
        return;
      } catch {
        // User cancelled or unsupported
      }
    }
    await navigator.clipboard.writeText(shareText).catch(() => {});
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4">
      <div className="rounded-3xl bg-white dark:bg-[#0D0D11] border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Calculation & Scan History
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {history.length} saved locally on this device
            </p>
          </div>

          {history.length > 0 && (
            <div className="flex items-center gap-2">
              {confirmClear ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      haptic();
                      onClearAll();
                      setConfirmClear(false);
                    }}
                    className="min-h-[38px] px-3 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
                  >
                    Confirm Clear All
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="min-h-[38px] px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="min-h-[38px] px-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/25 text-xs font-semibold text-rose-600 dark:text-rose-400 cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>
          )}
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions or answers..."
              className="w-full min-h-[42px] pl-9 pr-3 rounded-xl bg-zinc-50 dark:bg-[#14141A] border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900">
            {(['All', 'Camera', 'Voice', 'Keyboard'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  haptic();
                  setFilter(tab);
                }}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                  filter === tab
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-amber-300 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-[#0D0D11] border border-zinc-200 dark:border-zinc-800 p-12 text-center">
          <Clock className="w-9 h-9 text-amber-500/60 mx-auto mb-3" />
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            No matching history records
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Calculations from Keyboard, Voice, and AI Camera Scanner appear here automatically.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((item) => {
            const expanded = expandedId === item.id;
            return (
              <div
                key={item.id}
                className="rounded-2xl bg-white dark:bg-[#0D0D11] border border-zinc-200 dark:border-zinc-800 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {item.imageThumbnail && (
                      <img
                        src={item.imageThumbnail}
                        alt="Scanned reference"
                        className="w-14 h-14 rounded-xl object-cover border border-zinc-200 dark:border-zinc-800 shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="font-semibold text-amber-700 dark:text-amber-400">
                          {item.inputMethod}
                        </span>
                        <span>·</span>
                        <span>
                          {new Date(item.createdAt).toLocaleString([], {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                      <div className="font-mono text-sm sm:text-base font-medium text-zinc-800 dark:text-zinc-200 mt-1 break-words">
                        {item.question}
                      </div>
                      <div className="font-mono tabular-nums text-xl font-bold text-amber-600 dark:text-amber-300 mt-1">
                        = {item.answer}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onReopenItem(item)}
                      title="Reopen"
                      className="min-h-[38px] min-w-[38px] rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 cursor-pointer"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(item)}
                      title="Copy"
                      className="min-h-[38px] min-w-[38px] rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 cursor-pointer"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShare(item)}
                      title="Share"
                      className="min-h-[38px] min-w-[38px] rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 cursor-pointer"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        haptic();
                        onDeleteItem(item.id);
                      }}
                      title="Delete"
                      className="min-h-[38px] min-w-[38px] rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {item.steps && item.steps.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : item.id)}
                      className="text-xs font-semibold text-amber-700 dark:text-amber-400 inline-flex items-center gap-1 cursor-pointer"
                    >
                      {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {expanded ? 'Hide Steps' : `View ${item.steps.length} Step-by-Step Details`}
                    </button>

                    {expanded && (
                      <div className="mt-2.5 flex flex-col gap-2">
                        {item.steps.map((s, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl bg-zinc-50 dark:bg-[#14141A] p-3 text-xs"
                          >
                            <div className="font-semibold text-zinc-900 dark:text-amber-300">
                              {idx + 1}. {s.title}
                            </div>
                            {s.expression && (
                              <div className="font-mono text-zinc-800 dark:text-zinc-200 mt-0.5">
                                {s.expression}
                              </div>
                            )}
                            <div className="text-zinc-600 dark:text-zinc-400 mt-0.5">
                              {s.explanation}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
