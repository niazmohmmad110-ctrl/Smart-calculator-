import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Flashlight,
  SwitchCamera,
  ImagePlus,
  RotateCw,
  Crop,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Mic,
  MicOff,
  Volume2,
  ScanLine,
  Loader2,
  SlidersHorizontal,
} from 'lucide-react';
import {
  analyzeFrameForMathContent,
  CropRect,
  extractMathOCR,
  processMathImage,
} from '../utils/imageProcessor';
import { solveOfflineDeterministic, ExplanationLanguage } from '../utils/mathEngine';
import { speakText, triggerHaptic } from '../utils/storage';
import { AppSettings, HistoryRecord, SolveResponse } from '../types/calculator';

interface CameraScannerProps {
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onSaveHistory: (record: Omit<HistoryRecord, 'id' | 'createdAt'>) => void;
  onOpenInSolver: (question: string, solution?: SolveResponse) => void;
}

type ScannerStage = 'live' | 'edit' | 'result';

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

export const CameraScanner: React.FC<CameraScannerProps> = ({
  settings,
  onUpdateSettings,
  onSaveHistory,
  onOpenInSolver,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stage, setStage] = useState<ScannerStage>('live');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [continuousScan, setContinuousScan] = useState(false);
  const [frameDetected, setFrameDetected] = useState(false);

  // Captured / edited image state
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | undefined>();
  const [rotationDeg, setRotationDeg] = useState(0);
  const [enhanceClarity, setEnhanceClarity] = useState(true);
  const [contrast, setContrast] = useState(20);
  const [brightness, setBrightness] = useState(5);
  const [cropPreset, setCropPreset] = useState<'full' | 'focus' | 'custom'>('full');
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 1, height: 1 });

  // OCR & Solver state
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [solving, setSolving] = useState(false);
  const [solveError, setSolveError] = useState<string | null>(null);
  const [solution, setSolution] = useState<SolveResponse | null>(null);

  // Camera + Voice Follow-up
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [followupLoading, setFollowupLoading] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const haptic = () => triggerHaptic(settings.hapticEnabled, 14);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setTorchOn(false);
  }, []);

  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    stopCamera();
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Live camera API is unavailable in this browser. Use Gallery Picker below to scan math photos.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities ? (track.getCapabilities() as { torch?: boolean }) : {};
      setTorchSupported(Boolean(caps.torch));
      setCameraActive(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Permission denied';
      setCameraError(
        `Camera access was not granted (${msg}). Grant camera permission or pick a photo from your Gallery.`
      );
    }
  }, [stopCamera]);

  useEffect(() => {
    if (stage === 'live') {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [stage, facingMode, startCamera, stopCamera]);

  // Continuous Math Scan (100% local edge/text contrast detector — never uploads automatically)
  useEffect(() => {
    if (!continuousScan || stage !== 'live' || !cameraActive) {
      setFrameDetected(false);
      return;
    }
    const timer = window.setInterval(() => {
      if (videoRef.current) {
        const res = analyzeFrameForMathContent(videoRef.current);
        setFrameDetected(res.hasClearContent);
      }
    }, 900);
    return () => window.clearInterval(timer);
  }, [continuousScan, stage, cameraActive]);

  const toggleTorch = async () => {
    haptic();
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  };

  const applyProcessingAndOCR = useCallback(
    async (
      srcUrl: string,
      opts: {
        rot: number;
        cropRect: CropRect;
        clarity: boolean;
        con: number;
        bri: number;
      },
      runOcr = true
    ) => {
      try {
        const { processedDataUrl, thumbnailDataUrl } = await processMathImage(srcUrl, {
          rotationDeg: opts.rot,
          crop: opts.cropRect,
          enhanceClarity: opts.clarity,
          contrast: opts.con,
          brightness: opts.bri,
          grayscale: opts.clarity,
        });
        setProcessedImageUrl(processedDataUrl);
        setThumbnailUrl(thumbnailDataUrl);

        if (runOcr) {
          setOcrProgress(5);
          const extracted = await extractMathOCR(processedDataUrl, (p) => setOcrProgress(p));
          setOcrText(extracted);
          setOcrProgress(null);
        }
      } catch (err) {
        setOcrProgress(null);
        setSolveError(err instanceof Error ? err.message : 'Image processing failed');
      }
    },
    []
  );

  const handleCapturePhoto = async () => {
    haptic();
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    setRawImageUrl(dataUrl);
    setRotationDeg(0);
    setCropPreset('full');
    const initialCrop = { x: 0, y: 0, width: 1, height: 1 };
    setCrop(initialCrop);
    setSolution(null);
    setSolveError(null);
    setStage('edit');

    await applyProcessingAndOCR(
      dataUrl,
      { rot: 0, cropRect: initialCrop, clarity: enhanceClarity, con: contrast, bri: brightness },
      true
    );
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    haptic();
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      setRawImageUrl(dataUrl);
      setRotationDeg(0);
      setCropPreset('full');
      const initialCrop = { x: 0, y: 0, width: 1, height: 1 };
      setCrop(initialCrop);
      setSolution(null);
      setSolveError(null);
      setStage('edit');

      await applyProcessingAndOCR(
        dataUrl,
        { rot: 0, cropRect: initialCrop, clarity: enhanceClarity, con: contrast, bri: brightness },
        true
      );
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleReprocessImage = async (
    nextRot = rotationDeg,
    nextCrop = crop,
    nextClarity = enhanceClarity,
    nextCon = contrast,
    nextBri = brightness,
    rerunOcr = false
  ) => {
    if (!rawImageUrl) return;
    await applyProcessingAndOCR(
      rawImageUrl,
      { rot: nextRot, cropRect: nextCrop, clarity: nextClarity, con: nextCon, bri: nextBri },
      rerunOcr
    );
  };

  const handleScanAndSolve = async (overrideLang?: ExplanationLanguage) => {
    haptic();
    if (!processedImageUrl && !ocrText.trim()) return;

    setSolving(true);
    setSolveError(null);
    const lang = overrideLang || settings.explanationLanguage;

    try {
      const response = await fetch('/api/math/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expression: ocrText.trim(),
          ocrText: ocrText.trim(),
          imageBase64: processedImageUrl,
          mimeType: 'image/jpeg',
          language: lang,
          mode: 'step_by_step',
        }),
      });

      const data = (await response.json()) as SolveResponse;

      if (!response.ok || !data.ok) {
        // Attempt offline deterministic solve on OCR text if AI service is unavailable
        if (ocrText.trim()) {
          const offline = solveOfflineDeterministic(ocrText.trim(), lang, settings.precision);
          if (offline) {
            const fallbackSol: SolveResponse = {
              ok: true,
              configured: false,
              offlineFallback: true,
              recognizedQuestion: offline.recognizedQuestion,
              problemType: offline.problemType,
              finalAnswer: offline.finalAnswer,
              steps: offline.steps,
              summary: `Solved offline with deterministic math engine: ${offline.finalAnswer}`,
              verifiedDeterministic: true,
            };
            setSolution(fallbackSol);
            setStage('result');
            onSaveHistory({
              question: fallbackSol.recognizedQuestion,
              answer: fallbackSol.finalAnswer,
              steps: fallbackSol.steps,
              summary: fallbackSol.summary,
              inputMethod: 'Camera',
              language: lang,
              imageThumbnail: thumbnailUrl,
              verifiedDeterministic: true,
            });
            setSolving(false);
            return;
          }
        }
        setSolveError(data.error || 'Could not solve image. Try editing the recognized expression or retaking the photo.');
        setSolving(false);
        return;
      }

      setSolution(data);
      setStage('result');

      if (!data.isUnclear) {
        onSaveHistory({
          question: data.recognizedQuestion || ocrText || 'Scanned Math Problem',
          answer: data.finalAnswer,
          steps: data.steps,
          summary: data.summary,
          inputMethod: 'Camera',
          language: lang,
          imageThumbnail: thumbnailUrl,
          verifiedDeterministic: data.verifiedDeterministic,
        });
      }
    } catch {
      // Network offline fallback using OCR text
      if (ocrText.trim()) {
        const offline = solveOfflineDeterministic(ocrText.trim(), lang, settings.precision);
        if (offline) {
          const fallbackSol: SolveResponse = {
            ok: true,
            offlineFallback: true,
            recognizedQuestion: offline.recognizedQuestion,
            problemType: offline.problemType,
            finalAnswer: offline.finalAnswer,
            steps: offline.steps,
            summary: `Solved offline: ${offline.finalAnswer}`,
            verifiedDeterministic: true,
          };
          setSolution(fallbackSol);
          setStage('result');
          setSolving(false);
          return;
        }
      }
      setSolveError('Network unavailable. Check your connection or edit the OCR expression above to solve arithmetic/algebra offline.');
    } finally {
      setSolving(false);
    }
  };

  // Camera + Voice follow-up command
  const handleVoiceFollowupCommand = async (spoken: string) => {
    if (!spoken.trim() || !solution) return;
    setVoiceTranscript(spoken);
    setFollowupLoading(true);
    setSolveError(null);

    const lower = spoken.toLowerCase();
    let targetLang: ExplanationLanguage = settings.explanationLanguage;
    if (/roman\s*urdu/i.test(lower)) targetLang = 'roman_urdu';
    else if (/\burdu\b|اردو/i.test(spoken)) targetLang = 'urdu';
    else if (/\benglish\b/i.test(lower)) targetLang = 'english';

    if (targetLang !== settings.explanationLanguage) {
      onUpdateSettings({ explanationLanguage: targetLang });
    }

    try {
      const resp = await fetch('/api/math/voice-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: solution.recognizedQuestion,
          currentAnswer: solution.finalAnswer,
          userCommand: spoken,
          language: targetLang,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        setSolveError(data.error || 'Voice follow-up failed.');
        return;
      }

      setSolution((prev) =>
        prev
          ? {
              ...prev,
              finalAnswer: data.finalAnswer || prev.finalAnswer,
              steps: Array.isArray(data.steps) && data.steps.length ? data.steps : prev.steps,
              summary: data.spokenSummary || prev.summary,
            }
          : prev
      );

      if (settings.voiceOutputEnabled && data.spokenSummary) {
        speakText(data.spokenSummary, targetLang, settings.speechSpeed);
      }
    } catch {
      setSolveError('Unable to reach AI service for voice follow-up.');
    } finally {
      setFollowupLoading(false);
    }
  };

  const toggleCameraVoiceMic = () => {
    haptic();
    if (voiceListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setVoiceListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      setSolveError('Microphone speech recognition is unsupported in this browser. Tap a quick follow-up chip below.');
      return;
    }

    const rec = new SpeechRec();
    rec.lang = settings.voiceLanguage;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      const text = ev.results?.[0]?.[0]?.transcript || '';
      setVoiceListening(false);
      if (text) handleVoiceFollowupCommand(text);
    };
    rec.onerror = () => {
      setVoiceListening(false);
    };
    rec.onend = () => {
      setVoiceListening(false);
    };
    recognitionRef.current = rec;
    setVoiceListening(true);
    rec.start();
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-5">
      {/* Hidden gallery input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleGalleryUpload}
        className="hidden"
      />

      {/* Stage 1: Live Camera Preview */}
      {stage === 'live' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-8 rounded-3xl overflow-hidden bg-zinc-950 border border-amber-500/25 relative">
            {/* Top camera controls */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-950/90 border-b border-zinc-800/80">
              <div className="flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-zinc-100">
                  Live Math Scanner
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    haptic();
                    setContinuousScan((v) => !v);
                  }}
                  className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    continuousScan
                      ? 'bg-amber-500 text-zinc-950 border-amber-400'
                      : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-amber-500/40'
                  }`}
                >
                  Continuous Scan: {continuousScan ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* Video viewport */}
            <div className="relative aspect-[4/3] sm:aspect-[16/10] bg-black flex items-center justify-center overflow-hidden">
              {cameraError ? (
                <div className="p-6 text-center max-w-md">
                  <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                  <p className="text-sm text-zinc-200 mb-4">{cameraError}</p>
                  <div className="flex flex-wrap justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      className="min-h-[44px] px-4 rounded-xl bg-zinc-800 text-zinc-100 text-xs font-semibold hover:bg-zinc-700 cursor-pointer"
                    >
                      Retry Camera
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-[#FCE38A] to-[#D4AF37] text-zinc-950 text-xs font-bold cursor-pointer"
                    >
                      Choose from Gallery
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="w-full h-full object-cover"
                  />
                  {/* Document Scanning Frame Overlay */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 sm:p-10">
                    <div
                      className={`w-full max-w-lg h-44 sm:h-56 relative rounded-2xl border transition-colors ${
                        frameDetected
                          ? 'border-emerald-400 bg-emerald-500/5'
                          : 'border-amber-400/50 bg-black/10'
                      }`}
                    >
                      <span className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-3 border-l-3 border-amber-400 rounded-tl-xl" />
                      <span className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-3 border-r-3 border-amber-400 rounded-tr-xl" />
                      <span className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-3 border-l-3 border-amber-400 rounded-bl-xl" />
                      <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-3 border-r-3 border-amber-400 rounded-br-xl" />

                      <div className="absolute bottom-2.5 left-0 right-0 text-center">
                        <span className="px-3 py-1 rounded-lg bg-black/75 text-[11px] font-medium text-amber-200">
                          {continuousScan
                            ? frameDetected
                              ? 'Math text detected in frame — tap Capture'
                              : 'Scanning frame locally — align equation inside box'
                            : 'Align handwritten or printed math inside the gold frame'}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Bottom Camera Action Bar */}
            <div className="px-4 py-4 bg-zinc-950 border-t border-zinc-800/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[46px] px-3.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-semibold text-zinc-200 hover:border-amber-500/50 flex items-center gap-2 cursor-pointer"
                >
                  <ImagePlus className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Gallery</span>
                </button>
                <button
                  type="button"
                  onClick={toggleTorch}
                  disabled={!cameraActive || torchSupported === false}
                  title={torchSupported === false ? 'Flashlight unavailable on this device' : 'Toggle Flashlight'}
                  className={`min-h-[46px] min-w-[46px] rounded-xl border flex items-center justify-center transition cursor-pointer ${
                    torchOn
                      ? 'bg-amber-500 text-zinc-950 border-amber-400'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-200 disabled:opacity-40'
                  }`}
                >
                  <Flashlight className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleCapturePhoto}
                disabled={!cameraActive}
                className="min-h-[54px] px-7 rounded-2xl bg-gradient-to-r from-[#FCE38A] via-[#D4AF37] to-[#B58B1E] text-zinc-950 font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center gap-2 disabled:opacity-40 active:scale-[0.98] transition cursor-pointer"
              >
                <Camera className="w-5 h-5" />
                Capture Math
              </button>

              <button
                type="button"
                onClick={() => {
                  haptic();
                  setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'));
                }}
                aria-label="Switch Camera"
                className="min-h-[46px] min-w-[46px] rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 hover:border-amber-500/50 flex items-center justify-center cursor-pointer"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Guidance & Supported Types Column */}
          <div className="lg:col-span-4 rounded-3xl bg-white dark:bg-[#0D0D11] border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-4">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-amber-100">
                Supported Math Questions
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Scan printed textbooks, handwritten school notebooks, whiteboards, or upload a photo.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-zinc-700 dark:text-zinc-300">
              {[
                'Arithmetic & BODMAS',
                'Fractions & Decimals',
                'Percentages',
                'Linear & Quadratic',
                'Square Roots & Powers',
                'Trigonometry',
                'Geometry & Formulas',
                'Word Problems (EN/UR)',
              ].map((t) => (
                <div
                  key={t}
                  className="px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#141419] border border-zinc-200 dark:border-zinc-800/80"
                >
                  {t}
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 mb-2">
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
                    className={`min-h-[38px] rounded-xl text-xs font-semibold border transition cursor-pointer ${
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
          </div>
        </div>
      )}

      {/* Stage 2: Crop, Rotate, Enhance, OCR & Confirm Expression */}
      {stage === 'edit' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-[#0D0D11] border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                1. Crop, Rotate & Enhance
              </h2>
              <button
                type="button"
                onClick={() => setStage('live')}
                className="min-h-[38px] px-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retake
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center max-h-[360px]">
              {processedImageUrl ? (
                <img
                  src={processedImageUrl}
                  alt="Processed math scan"
                  className="max-h-[360px] w-auto object-contain"
                />
              ) : (
                <div className="py-16 text-xs text-zinc-400">Processing image...</div>
              )}
            </div>

            {/* Image Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  haptic();
                  const nextRot = (rotationDeg + 90) % 360;
                  setRotationDeg(nextRot);
                  handleReprocessImage(nextRot, crop, enhanceClarity, contrast, brightness, true);
                }}
                className="min-h-[42px] px-3.5 rounded-xl bg-zinc-100 dark:bg-[#15151B] border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCw className="w-4 h-4 text-amber-500" />
                Rotate 90°
              </button>

              <button
                type="button"
                onClick={() => {
                  haptic();
                  const nextPreset = cropPreset === 'full' ? 'focus' : 'full';
                  setCropPreset(nextPreset);
                  const nextCrop =
                    nextPreset === 'focus'
                      ? { x: 0.1, y: 0.2, width: 0.8, height: 0.6 }
                      : { x: 0, y: 0, width: 1, height: 1 };
                  setCrop(nextCrop);
                  handleReprocessImage(rotationDeg, nextCrop, enhanceClarity, contrast, brightness, true);
                }}
                className={`min-h-[42px] px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                  cropPreset === 'focus'
                    ? 'bg-amber-500 text-zinc-950 border-amber-400'
                    : 'bg-zinc-100 dark:bg-[#15151B] border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200'
                }`}
              >
                <Crop className="w-4 h-4" />
                {cropPreset === 'focus' ? 'Center Crop Active' : 'Crop Center Frame'}
              </button>

              <button
                type="button"
                onClick={() => {
                  haptic();
                  const next = !enhanceClarity;
                  setEnhanceClarity(next);
                  handleReprocessImage(rotationDeg, crop, next, contrast, brightness, true);
                }}
                className={`min-h-[42px] px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                  enhanceClarity
                    ? 'bg-amber-500/15 border-amber-500/45 text-amber-700 dark:text-amber-300'
                    : 'bg-zinc-100 dark:bg-[#15151B] border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                Clarity Boost: {enhanceClarity ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Contrast & Brightness sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                <span>Contrast ({contrast})</span>
                <input
                  type="range"
                  min={-20}
                  max={80}
                  value={contrast}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setContrast(val);
                    handleReprocessImage(rotationDeg, crop, enhanceClarity, val, brightness, false);
                  }}
                  className="accent-amber-500"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                <span>Brightness ({brightness})</span>
                <input
                  type="range"
                  min={-30}
                  max={40}
                  value={brightness}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setBrightness(val);
                    handleReprocessImage(rotationDeg, crop, enhanceClarity, contrast, val, false);
                  }}
                  className="accent-amber-500"
                />
              </label>
            </div>
          </div>

          {/* Right column: OCR Confirmation & Solve */}
          <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-[#0D0D11] border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                2. Verify Recognized Math
              </h2>
              {ocrProgress !== null && (
                <span className="text-xs font-mono text-amber-500">OCR {ocrProgress}%</span>
              )}
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Review or edit the extracted OCR text below before solving, or leave as-is for direct AI Vision reading of handwriting & fractions.
            </p>

            <textarea
              rows={4}
              value={ocrText}
              onChange={(e) => setOcrText(e.target.value)}
              placeholder={
                ocrProgress !== null
                  ? 'Running offline OCR...'
                  : 'e.g. 25 + 35 × 2 or 2x + 5 = 15 (edit if needed)'
              }
              className="w-full rounded-2xl bg-zinc-50 dark:bg-[#14141A] border border-zinc-200 dark:border-zinc-800 p-3.5 font-mono text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
            />

            <button
              type="button"
              onClick={() => handleReprocessImage(rotationDeg, crop, enhanceClarity, contrast, brightness, true)}
              className="min-h-[40px] px-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 self-start cursor-pointer"
            >
              Re-run Offline OCR
            </button>

            <div>
              <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
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

            {solveError && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-700 dark:text-rose-300">
                {solveError}
              </div>
            )}

            <button
              type="button"
              onClick={() => handleScanAndSolve()}
              disabled={solving}
              className="min-h-[54px] w-full rounded-2xl bg-gradient-to-r from-[#FCE38A] via-[#D4AF37] to-[#B58B1E] text-zinc-950 font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {solving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Solving Step by Step...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Scan & Solve
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Stage 3: Step-by-Step Result + Camera + Voice Combination */}
      {stage === 'result' && solution && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-8 rounded-3xl bg-white dark:bg-[#0D0D11] border border-zinc-200 dark:border-amber-500/25 p-5 sm:p-6 flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-semibold text-amber-600 dark:text-amber-400 capitalize">
                  {solution.problemType?.replace('_', ' ') || 'Math Solution'}
                </span>
                {solution.verifiedDeterministic && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verified Answer
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    haptic();
                    speakText(
                      `${solution.finalAnswer}. ${solution.summary || ''}`,
                      settings.explanationLanguage,
                      settings.speechSpeed
                    );
                  }}
                  className="min-h-[38px] px-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4 text-amber-500" />
                  Speak
                </button>
                <button
                  type="button"
                  onClick={() => setStage('edit')}
                  className="min-h-[38px] px-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-200 cursor-pointer"
                >
                  Edit Scan
                </button>
                <button
                  type="button"
                  onClick={() => setStage('live')}
                  className="min-h-[38px] px-3 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold cursor-pointer"
                >
                  Scan Next
                </button>
              </div>
            </div>

            {solution.isUnclear ? (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-900 dark:text-amber-200">
                <div className="font-bold mb-1">Clarification Needed</div>
                <p>{solution.clarificationMessage || 'The scanned math text was unclear. Please retake a clearer photo or edit the recognized text.'}</p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl bg-zinc-50 dark:bg-[#14141A] border border-zinc-200 dark:border-zinc-800 p-4">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                    Recognized Question
                  </div>
                  <div className="font-mono text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {solution.recognizedQuestion}
                  </div>
                  <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-baseline justify-between gap-4">
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      Final Answer
                    </span>
                    <span className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-300">
                      {solution.finalAnswer}
                    </span>
                  </div>
                </div>

                {/* Steps */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Step-by-Step Solution
                  </h3>
                  {solution.steps?.map((st, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl bg-zinc-50 dark:bg-[#121217] border border-zinc-200 dark:border-zinc-800/80 p-4"
                    >
                      <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                        Step {idx + 1}. {st.title}
                      </div>
                      {st.expression && (
                        <div className="mt-1.5 font-mono text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100">
                          {st.expression}
                        </div>
                      )}
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        {st.explanation}
                      </p>
                    </div>
                  ))}
                </div>

                {solution.summary && (
                  <div className="text-sm text-zinc-600 dark:text-zinc-300 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    {solution.summary}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Camera + Voice Combination Panel */}
          <div className="lg:col-span-4 rounded-3xl bg-white dark:bg-[#0D0D11] border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-4">
            {processedImageUrl && (
              <img
                src={processedImageUrl}
                alt="Scanned preview"
                className="w-full h-32 object-cover rounded-2xl border border-zinc-200 dark:border-zinc-800"
              />
            )}

            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-amber-200">
                Ask About This Photo by Voice
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Press the microphone and say commands like &ldquo;Isko step by step samjhao&rdquo; or &ldquo;Urdu mein samjhao&rdquo;.
              </p>
            </div>

            <button
              type="button"
              onClick={toggleCameraVoiceMic}
              disabled={followupLoading}
              className={`min-h-[52px] w-full rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                voiceListening
                  ? 'bg-rose-600 text-white'
                  : 'bg-gradient-to-r from-[#FCE38A] to-[#D4AF37] text-zinc-950'
              }`}
            >
              {followupLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Thinking...
                </>
              ) : voiceListening ? (
                <>
                  <MicOff className="w-4 h-4" />
                  Listening... Tap to Stop
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  Press Mic & Ask
                </>
              )}
            </button>

            {voiceTranscript && (
              <div className="text-xs text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900 rounded-xl p-2.5">
                Heard: &ldquo;{voiceTranscript}&rdquo;
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {[
                'Isko step by step samjhao',
                'Urdu mein samjhao',
                'English mein samjhao',
                'Sirf final answer dikhao',
                'Dobara samjhao',
              ].map((cmd) => (
                <button
                  key={cmd}
                  type="button"
                  onClick={() => handleVoiceFollowupCommand(cmd)}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-[#15151C] border border-zinc-200 dark:border-zinc-800 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:border-amber-500/40 cursor-pointer"
                >
                  {cmd}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onOpenInSolver(solution.recognizedQuestion, solution)}
              className="min-h-[42px] w-full rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:border-amber-500/40 cursor-pointer"
            >
              Open Full View in AI Math Solver
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
