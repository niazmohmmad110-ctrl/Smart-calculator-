import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import {
  evaluateMathExpression,
  solveOfflineDeterministic,
  ExplanationLanguage,
} from './src/utils/mathEngine.ts';

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

function getApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  return key;
}

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function languageDirective(lang: ExplanationLanguage): string {
  if (lang === 'urdu') {
    return 'Write all step titles, explanations, clarification messages, and summary in natural, proper Urdu script (اردو). Keep mathematical equations and numbers clear.';
  }
  if (lang === 'roman_urdu') {
    return 'Write all step titles, explanations, clarification messages, and summary in clear, natural Pakistani Roman Urdu (e.g., "Dono sides se 5 minus karein", "Jawab 95 hai").';
  }
  return 'Write all step titles, explanations, clarification messages, and summary in clear, concise English.';
}

const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  // Health & AI status endpoint (never exposes secrets)
  app.get('/api/health', (_req: Request, res: Response) => {
    const aiConfigured = Boolean(getApiKey());
    res.json({
      ok: true,
      brand: 'KBR Tech',
      app: 'KBR Smart Calculator Pro',
      version: '1.0.0',
      aiConfigured,
      model: MODEL_NAME,
    });
  });

  // Multimodal + Text AI Math Solver with deterministic verification
  app.post('/api/math/solve', async (req: Request, res: Response) => {
    try {
      const {
        expression,
        ocrText,
        imageBase64,
        mimeType,
        language = 'english',
        mode = 'step_by_step',
      } = req.body as {
        expression?: string;
        ocrText?: string;
        imageBase64?: string;
        mimeType?: string;
        language?: ExplanationLanguage;
        mode?: 'step_by_step' | 'final_only';
      };

      const safeLang: ExplanationLanguage =
        language === 'urdu' || language === 'roman_urdu' ? language : 'english';

      const cleanExpr = typeof expression === 'string' ? expression.trim() : '';
      const cleanOcr = typeof ocrText === 'string' ? ocrText.trim() : '';
      const hasImage = typeof imageBase64 === 'string' && imageBase64.length > 0;

      if (!cleanExpr && !cleanOcr && !hasImage) {
        res.status(400).json({
          ok: false,
          error: 'Provide a mathematical expression, OCR text, or image to solve.',
        });
        return;
      }

      if (hasImage) {
        if (!mimeType || !ALLOWED_IMAGE_MIME.has(mimeType.toLowerCase())) {
          res.status(400).json({
            ok: false,
            error: 'Unsupported image format. Use JPEG, PNG, or WEBP.',
          });
          return;
        }
        if (imageBase64.length > 14_000_000) {
          res.status(400).json({
            ok: false,
            error: 'Image size exceeds limit. Please crop or capture a smaller photo.',
          });
          return;
        }
      }

      const ai = createGeminiClient();
      if (!ai) {
        // Attempt deterministic offline fallback for text/OCR expressions before returning 503
        const candidate = cleanExpr || cleanOcr;
        if (candidate && !hasImage) {
          const offline = solveOfflineDeterministic(candidate, safeLang);
          if (offline) {
            res.json({
              ok: true,
              configured: false,
              offlineFallback: true,
              ...offline,
              summary: `Solved offline with deterministic engine: ${offline.finalAnswer}`,
              isUnclear: false,
            });
            return;
          }
        }

        res.status(503).json({
          ok: false,
          configured: false,
          error:
            'Gemini AI service is not configured. Add GEMINI_API_KEY in Settings > Secrets to enable AI camera & word-problem solving. Normal calculator and offline OCR remain fully operational.',
        });
        return;
      }

      const systemInstruction = [
        'You are the KBR Smart Calculator Pro mathematics engine by KBR Tech.',
        'Your job is to accurately recognize printed or handwritten math expressions, equations, fractions, word problems (in English or Urdu), geometry, trigonometry, algebra, or multiple questions on one page, and solve them with zero hallucination.',
        'CRITICAL ACCURACY RULES:',
        '1. If an image is blurry, cut off, or too ambiguous to read reliably, set isUnclear=true and write a helpful clarificationMessage asking the user to retake the photo or edit the recognized text.',
        '2. Never invent numbers or guess unreadable digits.',
        '3. Always verify arithmetic step by step. For pure arithmetic or single-expression evaluations, provide a clean mathjs-compatible string in numericExpressionForVerification (e.g. "25 + 35 * 2" or "(3/4) + (1/2)"). Leave numericExpressionForVerification empty for equations with variables or multi-part word problems.',
        mode === 'final_only'
          ? '4. User requested final answer mode: keep steps minimal (1 concise summary step) and emphasize finalAnswer.'
          : '4. Provide clear, logical step-by-step teaching steps.',
        languageDirective(safeLang),
      ].join('\n');

      const parts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
      > = [];

      if (hasImage && imageBase64 && mimeType) {
        const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
        parts.push({
          inlineData: {
            mimeType: mimeType.toLowerCase(),
            data: cleanBase64,
          },
        });
      }

      const promptSegments: string[] = [];
      if (cleanExpr) {
        promptSegments.push(`User confirmed / entered problem:\n${cleanExpr}`);
      }
      if (cleanOcr && cleanOcr !== cleanExpr) {
        promptSegments.push(`Local OCR raw hint (verify carefully against image if attached):\n${cleanOcr}`);
      }
      if (!cleanExpr && !cleanOcr && hasImage) {
        promptSegments.push(
          'Read the mathematical problem(s) from this image carefully, normalize the question, and solve step by step.'
        );
      }

      parts.push({ text: promptSegments.join('\n\n') });

      const callGeminiWithRetry = async () => {
        const delays = [700, 1500];
        let lastErr: unknown;
        for (let attempt = 0; attempt <= delays.length; attempt++) {
          try {
            return await ai.models.generateContent({
              model: MODEL_NAME,
              contents: { parts },
              config: {
                systemInstruction,
                thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    recognizedQuestion: {
                      type: Type.STRING,
                      description: 'Normalized clean mathematical question or equation.',
                    },
                    isUnclear: {
                      type: Type.BOOLEAN,
                      description: 'True if image or expression is ambiguous or unreadable.',
                    },
                    clarificationMessage: {
                      type: Type.STRING,
                      description: 'Actionable message asking user to retake or edit if isUnclear is true.',
                    },
                    problemType: {
                      type: Type.STRING,
                      description:
                        'One of: arithmetic, algebra, fraction, percentage, trigonometry, geometry, calculus, word_problem, multi_question',
                    },
                    finalAnswer: {
                      type: Type.STRING,
                      description: 'Concise final answer (e.g. "95" or "x = 5").',
                    },
                    numericExpressionForVerification: {
                      type: Type.STRING,
                      description:
                        'Pure numeric math expression for deterministic verification (e.g. "25 + 35 * 2"), or empty string if algebraic/word problem.',
                    },
                    steps: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING, description: 'Short step heading (3-6 words).' },
                          expression: { type: Type.STRING, description: 'Mathematical equation or calculation for this step.' },
                          explanation: { type: Type.STRING, description: 'Clear explanation of this step.' },
                        },
                        required: ['title', 'expression', 'explanation'],
                      },
                    },
                    summary: {
                      type: Type.STRING,
                      description: 'One-sentence conclusion in the requested language.',
                    },
                  },
                  required: ['recognizedQuestion', 'isUnclear', 'problemType', 'finalAnswer', 'steps', 'summary'],
                },
              },
            });
          } catch (err) {
            lastErr = err;
            const errMsg = err instanceof Error ? err.message : '';
            const isTransient = errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('429');
            if (!isTransient || attempt === delays.length) throw err;
            await new Promise((r) => setTimeout(r, delays[attempt]));
          }
        }
        throw lastErr;
      };

      const response = await callGeminiWithRetry();

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText) as {
        recognizedQuestion: string;
        isUnclear: boolean;
        clarificationMessage?: string;
        problemType: string;
        finalAnswer: string;
        numericExpressionForVerification?: string;
        steps: { title: string; expression: string; explanation: string }[];
        summary: string;
      };

      // Deterministic mathjs verification layer
      let verifiedDeterministic = false;
      let verifiedResult: string | undefined;

      const verifyCandidate =
        parsed.numericExpressionForVerification?.trim() ||
        (!/[a-zA-Z=]{2,}/.test(parsed.recognizedQuestion || '') ? parsed.recognizedQuestion : '');

      if (verifyCandidate && !parsed.isUnclear) {
        const detEval = evaluateMathExpression(verifyCandidate, { precision: 8 });
        if (detEval.ok && detEval.formatted) {
          verifiedDeterministic = true;
          verifiedResult = detEval.formatted;
          // If AI numeric answer differs on a pure arithmetic expression, trust deterministic engine
          const aiNum = Number(parsed.finalAnswer.replace(/[^0-9.\-eE]/g, ''));
          if (
            parsed.problemType === 'arithmetic' &&
            Number.isFinite(aiNum) &&
            detEval.value !== undefined &&
            Math.abs(aiNum - detEval.value) > 1e-6
          ) {
            parsed.finalAnswer = detEval.formatted;
          }
        } else if (parsed.recognizedQuestion?.includes('=')) {
          const offlineEq = solveOfflineDeterministic(parsed.recognizedQuestion, safeLang);
          if (offlineEq) {
            verifiedDeterministic = true;
            verifiedResult = offlineEq.finalAnswer;
          }
        }
      }

      res.json({
        ok: true,
        configured: true,
        ...parsed,
        verifiedDeterministic,
        verifiedResult,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to solve mathematical problem.';
      console.error('AI solve error:', msg);
      res.status(500).json({
        ok: false,
        error: msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED')
          ? 'Gemini API key error. Please verify GEMINI_API_KEY in Settings > Secrets.'
          : `AI Solver error: ${msg}`,
      });
    }
  });

  // Contextual Camera + Voice Follow-Up Assistant
  app.post('/api/math/voice-followup', async (req: Request, res: Response) => {
    try {
      const {
        question,
        currentAnswer,
        userCommand,
        language = 'roman_urdu',
      } = req.body as {
        question?: string;
        currentAnswer?: string;
        userCommand?: string;
        language?: ExplanationLanguage;
      };

      if (!userCommand?.trim()) {
        res.status(400).json({ ok: false, error: 'Voice command is required.' });
        return;
      }

      const safeLang: ExplanationLanguage =
        language === 'urdu' || language === 'roman_urdu' ? language : 'english';

      const ai = createGeminiClient();
      if (!ai) {
        res.status(503).json({
          ok: false,
          configured: false,
          error: 'Gemini AI key is not configured for voice explanation follow-ups.',
        });
        return;
      }

      const systemInstruction = [
        'You are the voice math tutor inside KBR Smart Calculator Pro (KBR Tech).',
        'The user has a scanned or entered math question and is speaking a follow-up request (often in Roman Urdu, Urdu, or English).',
        'Examples of commands:',
        '- "Isko step by step samjhao" -> explain every step in Roman Urdu.',
        '- "Urdu mein samjhao" -> switch explanation to proper Urdu script.',
        '- "English mein samjhao" -> explain in clear English.',
        '- "Sirf final answer dikhao" -> give only the final answer concisely.',
        '- "Dobara samjhao" -> re-explain more simply with an everyday intuition.',
        '- "Agla question solve karo" -> explain how to solve the next question or prompt them to scan/select the next question.',
        languageDirective(safeLang),
      ].join('\n');

      const prompt = [
        question ? `Current Math Question: ${question}` : 'No active question yet.',
        currentAnswer ? `Current Final Answer: ${currentAnswer}` : '',
        `User Voice Command: "${userCommand}"`,
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedLanguage: {
                type: Type.STRING,
                description: 'english, urdu, or roman_urdu',
              },
              finalAnswer: { type: Type.STRING },
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    expression: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                  },
                },
              },
              spokenSummary: {
                type: Type.STRING,
                description: 'Short, clear explanation suitable to read aloud via Text-to-Speech.',
              },
            },
            required: ['detectedLanguage', 'finalAnswer', 'steps', 'spokenSummary'],
          },
        },
      });

      const data = JSON.parse((response.text ?? '{}').trim());
      res.json({ ok: true, ...data });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Voice follow-up failed.';
      res.status(500).json({ ok: false, error: msg });
    }
  });

  // Real downloadable ZIP containing the complete project source code
  app.get('/api/project-zip', async (_req: Request, res: Response) => {
    try {
      const baseDir = path.resolve(process.cwd());
      const zip = new JSZip();

      const EXCLUDE_DIRS = new Set(['node_modules', 'dist', '.git', '.aistudio']);
      const EXCLUDE_FILES = new Set(['.env', '.env.local']);

      function addDirRecursive(currentDir: string) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.resolve(currentDir, entry.name);
          if (!fullPath.startsWith(baseDir + path.sep)) continue;

          if (entry.isDirectory()) {
            if (EXCLUDE_DIRS.has(entry.name)) continue;
            addDirRecursive(fullPath);
          } else if (entry.isFile()) {
            if (EXCLUDE_FILES.has(entry.name) || entry.name.endsWith('.zip')) continue;
            const relPath = path.relative(baseDir, fullPath).split(path.sep).join('/');
            const content = fs.readFileSync(fullPath);
            zip.file(relPath, content);
          }
        }
      }

      addDirRecursive(baseDir);

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="kbr-smart-calculator-pro.zip"'
      );
      res.setHeader('Content-Length', String(zipBuffer.length));
      res.send(zipBuffer);
    } catch (err) {
      console.error('ZIP generation failed:', err);
      res.status(500).json({ ok: false, error: 'Failed to generate project ZIP.' });
    }
  });

  // Vite middleware in dev / static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KBR Smart Calculator Pro server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
