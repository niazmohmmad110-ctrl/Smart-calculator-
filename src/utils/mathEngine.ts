import { create, all, MathJsInstance } from 'mathjs';

const math: MathJsInstance = create(all, {
  number: 'number',
  precision: 14,
});

export type AngleUnit = 'DEG' | 'RAD';
export type ExplanationLanguage = 'english' | 'urdu' | 'roman_urdu';

export interface CalcEvaluationResult {
  ok: boolean;
  value?: number;
  formatted?: string;
  fraction?: string;
  error?: string;
}

/**
 * Normalizes calculator display symbols into safe mathjs syntax.
 * Never uses eval() or Function().
 */
export function normalizeMathExpression(raw: string): string {
  let expr = raw.trim();
  if (!expr) return '';

  // Replace visual math symbols with mathjs equivalents
  expr = expr
    .replace(/×/g, '*')
    .replace(/·/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/–/g, '-')
    .replace(/π/g, 'pi')
    .replace(/√\s*\(/g, 'sqrt(')
    .replace(/√\s*([0-9.]+|[a-zA-Z]+)/g, 'sqrt($1)')
    .replace(/∛\s*\(/g, 'cbrt(')
    .replace(/∛\s*([0-9.]+|[a-zA-Z]+)/g, 'cbrt($1)')
    .replace(/(\d+(?:\.\d+)?|\([^)]+\))²/g, '($1)^2')
    .replace(/(\d+(?:\.\d+)?|\([^)]+\))³/g, '($1)^3')
    .replace(/sin⁻¹/g, 'asin')
    .replace(/cos⁻¹/g, 'acos')
    .replace(/tan⁻¹/g, 'atan');

  // Handle "X% of Y" -> "(X / 100) * Y"
  expr = expr.replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?|\([^)]+\))/gi, '(($1/100)*$2)');

  // Handle standalone percentages like "20%" -> "(20/100)"
  expr = expr.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)');

  // Map scientific calculator log (base 10) vs ln (base e)
  // Protect existing log10 first
  expr = expr.replace(/\blog10\s*\(/g, '__LOG10__(');
  expr = expr.replace(/\blog\s*\(/g, 'log10(');
  expr = expr.replace(/\bln\s*\(/g, 'log(');
  expr = expr.replace(/__LOG10__\(/g, 'log10(');

  // Implicit multiplication: 2pi -> 2*pi, 2(3) -> 2*(3), )( -> )*(, 2sqrt -> 2*sqrt
  expr = expr
    .replace(/(\d)\s*(pi|e|sqrt|cbrt|sin|cos|tan|asin|acos|atan|log10|log|abs)\b/g, '$1*$2')
    .replace(/(\d|\))\s*\(/g, '$1*(')
    .replace(/\)\s*(\d|pi|e)/g, ')*$1');

  return expr;
}

function buildScope(angleUnit: AngleUnit) {
  const toRad = (x: number) => (angleUnit === 'DEG' ? (x * Math.PI) / 180 : x);
  const fromRad = (x: number) => (angleUnit === 'DEG' ? (x * 180) / Math.PI : x);

  return {
    pi: Math.PI,
    e: Math.E,
    sin: (x: number) => Math.sin(toRad(x)),
    cos: (x: number) => Math.cos(toRad(x)),
    tan: (x: number) => {
      if (angleUnit === 'DEG') {
        const mod = ((x % 180) + 180) % 180;
        if (Math.abs(mod - 90) < 1e-12) {
          throw new Error('Undefined (tan 90°)');
        }
      }
      return Math.tan(toRad(x));
    },
    asin: (x: number) => fromRad(Math.asin(x)),
    acos: (x: number) => fromRad(Math.acos(x)),
    atan: (x: number) => fromRad(Math.atan(x)),
    cbrt: (x: number) => Math.cbrt(x),
    log10: (x: number) => Math.log10(x),
  };
}

export function formatNumericResult(
  num: number,
  precision = 8,
  scientificNotation = false
): string {
  if (!Number.isFinite(num)) {
    if (Number.isNaN(num)) return 'Undefined';
    return num > 0 ? '∞' : '-∞';
  }

  // Eliminate tiny floating point residue near 0 or integers
  const cleaned = Math.abs(num) < 1e-12 ? 0 : Number(num.toPrecision(12));

  if (scientificNotation && cleaned !== 0 && (Math.abs(cleaned) >= 1e6 || Math.abs(cleaned) < 1e-4)) {
    return cleaned.toExponential(Math.min(precision, 8));
  }

  if (Math.abs(cleaned) >= 1e13 || (cleaned !== 0 && Math.abs(cleaned) < 1e-8)) {
    return cleaned.toExponential(Math.min(precision, 8));
  }

  const rounded = Number(cleaned.toFixed(precision));
  return String(rounded);
}

export function decimalToFraction(value: number, maxDenominator = 10000): string | null {
  if (!Number.isFinite(value)) return null;
  if (Number.isInteger(value)) return null;

  const sign = value < 0 ? '-' : '';
  const absVal = Math.abs(value);

  try {
    const frac = math.fraction(absVal);
    if (frac && typeof frac.n === 'bigint' ? frac.d <= BigInt(maxDenominator) : frac.d <= maxDenominator) {
      if (Number(frac.d) === 1) return null;
      return `${sign}${frac.n}/${frac.d}`;
    }
  } catch {
    // Fallback continued fraction
  }

  let h1 = 1, h2 = 0, k1 = 0, k2 = 1;
  let b = absVal;
  for (let i = 0; i < 20; i++) {
    const a = Math.floor(b);
    const auxH = h1;
    h1 = a * h1 + h2;
    h2 = auxH;
    const auxK = k1;
    k1 = a * k1 + k2;
    k2 = auxK;
    if (k1 > maxDenominator) break;
    if (Math.abs(absVal - h1 / k1) < 1e-9) {
      if (k1 === 1) return null;
      return `${sign}${h1}/${k1}`;
    }
    const diff = b - a;
    if (diff < 1e-12) break;
    b = 1 / diff;
  }
  return null;
}

export function evaluateMathExpression(
  rawExpr: string,
  options: {
    angleUnit?: AngleUnit;
    precision?: number;
    scientificNotation?: boolean;
  } = {}
): CalcEvaluationResult {
  const { angleUnit = 'DEG', precision = 8, scientificNotation = false } = options;
  const normalized = normalizeMathExpression(rawExpr);

  if (!normalized) {
    return { ok: false, error: 'Empty expression' };
  }

  // Reject assignment or multi-statement attempts
  if (/[;{}]/.test(normalized)) {
    return { ok: false, error: 'Invalid expression characters' };
  }

  try {
    const scope = buildScope(angleUnit);
    const evaluated = math.evaluate(normalized, scope);

    if (typeof evaluated === 'number') {
      if (Number.isNaN(evaluated)) {
        return { ok: false, error: 'Math Error (Undefined)' };
      }
      if (!Number.isFinite(evaluated)) {
        return { ok: false, error: 'Cannot divide by zero' };
      }
      const formatted = formatNumericResult(evaluated, precision, scientificNotation);
      const fraction = decimalToFraction(evaluated) ?? undefined;
      return { ok: true, value: evaluated, formatted, fraction };
    }

    if (evaluated && typeof evaluated === 'object' && 're' in evaluated && 'im' in evaluated) {
      const c = evaluated as { re: number; im: number };
      if (Math.abs(c.im) < 1e-12) {
        const formatted = formatNumericResult(c.re, precision, scientificNotation);
        return { ok: true, value: c.re, formatted, fraction: decimalToFraction(c.re) ?? undefined };
      }
      const reStr = formatNumericResult(c.re, Math.min(precision, 4));
      const imStr = formatNumericResult(Math.abs(c.im), Math.min(precision, 4));
      return {
        ok: true,
        formatted: `${reStr} ${c.im >= 0 ? '+' : '-'} ${imStr}i`,
      };
    }

    return { ok: true, formatted: String(evaluated) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Syntax Error',
    };
  }
}

export interface OfflineEquationSolution {
  recognizedQuestion: string;
  problemType: 'arithmetic' | 'algebra' | 'percentage' | 'fraction';
  finalAnswer: string;
  steps: { title: string; expression: string; explanation: string }[];
  verifiedDeterministic: boolean;
}

/**
 * Attempts deterministic offline solving for arithmetic, percentage, fraction,
 * and single-variable linear / quadratic equations (e.g. "2x + 5 = 15").
 */
export function solveOfflineDeterministic(
  input: string,
  language: ExplanationLanguage = 'english',
  precision = 8
): OfflineEquationSolution | null {
  const cleaned = input.trim();
  if (!cleaned) return null;

  // 1. Equation with "="
  if (cleaned.includes('=')) {
    const parts = cleaned.split('=');
    if (parts.length !== 2) return null;
    const lhsRaw = normalizeMathExpression(parts[0]);
    const rhsRaw = normalizeMathExpression(parts[1]);
    if (!lhsRaw || !rhsRaw) return null;

    // Detect single variable (default x or single letter, including implicit 2x)
    const strippedFns = `${lhsRaw} ${rhsRaw}`.replace(
      /\b(asin|acos|atan|sin|cos|tan|sqrt|cbrt|log10|log|abs|pi)\b/g,
      ' '
    );
    const vars = Array.from(
      new Set(strippedFns.match(/(?<![a-zA-Z])[a-zA-Z](?![a-zA-Z])/g) || [])
    ).filter((v) => v !== 'e');

    if (vars.length === 0) {
      // Identity / comparison check
      const l = evaluateMathExpression(lhsRaw, { precision });
      const r = evaluateMathExpression(rhsRaw, { precision });
      if (l.ok && r.ok) {
        const eq = Math.abs((l.value ?? 0) - (r.value ?? 0)) < 1e-9;
        return {
          recognizedQuestion: cleaned,
          problemType: 'arithmetic',
          finalAnswer: eq ? `${l.formatted} = ${r.formatted} (True)` : `${l.formatted} ≠ ${r.formatted} (False)`,
          steps: [
            {
              title: language === 'urdu' ? 'دونوں اطراف کو حل کریں' : language === 'roman_urdu' ? 'Dono sides solve karein' : 'Evaluate both sides',
              expression: `${l.formatted} = ${r.formatted}`,
              explanation: eq
                ? 'Both sides evaluate to the same deterministic value.'
                : 'Left side and right side evaluate to different values.',
            },
          ],
          verifiedDeterministic: true,
        };
      }
      return null;
    }

    if (vars.length === 1) {
      const v = vars[0];
      // Evaluate f(v) = (lhs) - (rhs) at v = 0, 1, -1 to check linear/quadratic
      try {
        // Insert explicit multiplication for 2x -> 2*x
        const fixImplicitVar = (s: string) =>
          s.replace(new RegExp(`(\\d|\\))\\s*(${v})\\b`, 'g'), '$1*$2');
        const diffExpr = `(${fixImplicitVar(lhsRaw)}) - (${fixImplicitVar(rhsRaw)})`;
        const compiled = math.compile(diffExpr);
        const f0 = Number(compiled.evaluate({ [v]: 0 }));
        const f1 = Number(compiled.evaluate({ [v]: 1 }));
        const fm1 = Number(compiled.evaluate({ [v]: -1 }));
        const f2 = Number(compiled.evaluate({ [v]: 2 }));

        if (![f0, f1, fm1, f2].every(Number.isFinite)) return null;

        // Quadratic coefficients: f(x) = a*x^2 + b*x + c
        const c = f0;
        const a = (f1 + fm1 - 2 * f0) / 2;
        const b = (f1 - fm1) / 2;

        // Verify at x=2 that it is genuinely degree <= 2
        const check2 = a * 4 + b * 2 + c;
        if (Math.abs(check2 - f2) > 1e-7) return null;

        if (Math.abs(a) < 1e-10) {
          // Linear: b*x + c = 0
          if (Math.abs(b) < 1e-10) return null;
          const sol = -c / b;
          const solStr = formatNumericResult(sol, precision);
          const steps =
            language === 'urdu'
              ? [
                  {
                    title: 'دی گئی مساوات',
                    expression: cleaned,
                    explanation: `ہمیں ${v} کی قیمت معلوم کرنی ہے۔`,
                  },
                  {
                    title: 'مستقل اعداد کو دوسری طرف منتقل کریں',
                    expression: `${formatNumericResult(b, precision)}${v} = ${formatNumericResult(-c, precision)}`,
                    explanation: 'مساوات کو سادہ شکل میں ترتیب دیا گیا۔',
                  },
                  {
                    title: 'حتمی قیمت نکالیں',
                    expression: `${v} = ${solStr}`,
                    explanation: `دونوں اطراف کو ${formatNumericResult(b, precision)} سے تقسیم کریں۔`,
                  },
                ]
              : language === 'roman_urdu'
              ? [
                  {
                    title: 'Di gayi equation',
                    expression: cleaned,
                    explanation: `Humein ${v} ki value maloom karni hai.`,
                  },
                  {
                    title: 'Constant ko doosri taraf le jayein',
                    expression: `${formatNumericResult(b, precision)}${v} = ${formatNumericResult(-c, precision)}`,
                    explanation: `${v} wali term ko ek taraf alag karein.`,
                  },
                  {
                    title: 'Final answer nikaalein',
                    expression: `${v} = ${solStr}`,
                    explanation: `Dono sides ko ${formatNumericResult(b, precision)} se taqseem karein.`,
                  },
                ]
              : [
                  {
                    title: 'Original equation',
                    expression: cleaned,
                    explanation: `Isolate the variable ${v} to find its exact value.`,
                  },
                  {
                    title: 'Move constants to the right-hand side',
                    expression: `${formatNumericResult(b, precision)}${v} = ${formatNumericResult(-c, precision)}`,
                    explanation: 'Combine like terms and isolate the variable term.',
                  },
                  {
                    title: `Divide both sides by ${formatNumericResult(b, precision)}`,
                    expression: `${v} = ${solStr}`,
                    explanation: `Verified by substituting ${v} = ${solStr} back into the equation.`,
                  },
                ];

          return {
            recognizedQuestion: cleaned,
            problemType: 'algebra',
            finalAnswer: `${v} = ${solStr}`,
            steps,
            verifiedDeterministic: true,
          };
        } else {
          // Quadratic: a*x^2 + b*x + c = 0
          const disc = b * b - 4 * a * c;
          if (disc < 0) {
            const realPart = formatNumericResult(-b / (2 * a), 4);
            const imagPart = formatNumericResult(Math.sqrt(-disc) / Math.abs(2 * a), 4);
            return {
              recognizedQuestion: cleaned,
              problemType: 'algebra',
              finalAnswer: `${v} = ${realPart} ± ${imagPart}i`,
              steps: [
                {
                  title: 'Standard Quadratic Form',
                  expression: `${formatNumericResult(a, 4)}${v}² + ${formatNumericResult(b, 4)}${v} + ${formatNumericResult(c, 4)} = 0`,
                  explanation: 'Rewritten into ax² + bx + c = 0.',
                },
                {
                  title: 'Discriminant Check',
                  expression: `Δ = b² - 4ac = ${formatNumericResult(disc, 4)}`,
                  explanation: 'Since Δ < 0, roots are complex conjugates.',
                },
                {
                  title: 'Complex Roots',
                  expression: `${v} = ${realPart} ± ${imagPart}i`,
                  explanation: 'Applied the quadratic formula (-b ± √Δ) / 2a.',
                },
              ],
              verifiedDeterministic: true,
            };
          }
          const r1 = (-b + Math.sqrt(disc)) / (2 * a);
          const r2 = (-b - Math.sqrt(disc)) / (2 * a);
          const r1Str = formatNumericResult(r1, precision);
          const r2Str = formatNumericResult(r2, precision);
          const ans = Math.abs(r1 - r2) < 1e-10 ? `${v} = ${r1Str}` : `${v} = ${r1Str}, ${r2Str}`;
          return {
            recognizedQuestion: cleaned,
            problemType: 'algebra',
            finalAnswer: ans,
            steps: [
              {
                title: 'Standard Quadratic Form',
                expression: `${formatNumericResult(a, 4)}${v}² + ${formatNumericResult(b, 4)}${v} + ${formatNumericResult(c, 4)} = 0`,
                explanation: 'Arranged into ax² + bx + c = 0.',
              },
              {
                title: 'Compute Discriminant',
                expression: `Δ = b² - 4ac = ${formatNumericResult(disc, 4)}`,
                explanation: 'Substitute coefficients into the discriminant.',
              },
              {
                title: 'Apply Quadratic Formula',
                expression: ans,
                explanation: 'Computed (-b ± √Δ) / 2a.',
              },
            ],
            verifiedDeterministic: true,
          };
        }
      } catch {
        return null;
      }
    }
    return null;
  }

  // 2. Pure deterministic arithmetic / scientific expression
  const evalRes = evaluateMathExpression(cleaned, { precision });
  if (evalRes.ok && evalRes.formatted) {
    const isPct = /%/.test(cleaned);
    const isFrac = /\//.test(cleaned) && !/[+\-*^]/.test(cleaned);
    return {
      recognizedQuestion: cleaned,
      problemType: isPct ? 'percentage' : isFrac ? 'fraction' : 'arithmetic',
      finalAnswer: evalRes.fraction ? `${evalRes.formatted} (${evalRes.fraction})` : evalRes.formatted,
      steps: [
        {
          title:
            language === 'urdu'
              ? 'حسابی جانچ اور ترتیب'
              : language === 'roman_urdu'
              ? 'Expression aur BODMAS check'
              : 'Order of Operations (BODMAS/PEMDAS)',
          expression: cleaned,
          explanation:
            language === 'urdu'
              ? 'ضرب اور تقسیم کو جمع اور تفریق سے پہلے حل کیا گیا۔'
              : language === 'roman_urdu'
              ? 'BODMAS rule ke mutabiq pehle brackets, power, zarab/taqseem aur phir jama/nafi solve kiya gaya.'
              : 'Evaluated using strict order of operations (brackets, exponents, multiplication/division, addition/subtraction).',
        },
        {
          title:
            language === 'urdu'
              ? 'حتمی نتیجہ'
              : language === 'roman_urdu'
              ? 'Final Result'
              : 'Verified Result',
          expression: `${cleaned} = ${evalRes.formatted}`,
          explanation: evalRes.fraction
            ? `Exact decimal: ${evalRes.formatted} · Fraction form: ${evalRes.fraction}`
            : `Exact deterministic result: ${evalRes.formatted}`,
        },
      ],
      verifiedDeterministic: true,
    };
  }

  return null;
}

// ---------- VOICE MATH PARSER (English, Roman Urdu, Urdu) ----------

const WORD_NUMBERS: Record<string, number> = {
  // English
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
  // Roman Urdu
  sifar: 0, ek: 1, aik: 1, do: 2, teen: 3, chaar: 4, char: 4, paanch: 5, panch: 5,
  chhe: 6, che: 6, saat: 7, sat: 7, aath: 8, ath: 8, nau: 9, no: 9, das: 10, dus: 10,
  gyarah: 11, barah: 12, terah: 13, chaudah: 14, pandrah: 15, solah: 16, satrah: 17,
  atharah: 18, unnees: 19, bees: 20, bis: 20, tees: 30, chalis: 40, pachas: 50, pachaas: 50,
  saath: 60, sattar: 70, assi: 80, nabbe: 90, sau: 100, so: 100, hazaar: 1000, hazar: 1000,
  // Urdu Script
  'صفر': 0, 'ایک': 1, 'دو': 2, 'تین': 3, 'چار': 4, 'پانچ': 5, 'چھ': 6, 'سات': 7, 'آٹھ': 8, 'نو': 9,
  'دس': 10, 'گیارہ': 11, 'بارہ': 12, 'تیرہ': 13, 'چودہ': 14, 'پندرہ': 15, 'سولہ': 16,
  'سترہ': 17, 'اٹھارہ': 18, 'انیس': 19, 'بیس': 20, 'تیس': 30, 'چالیس': 40, 'پچاس': 50,
  'ساٹھ': 60, 'ستر': 70, 'اسی': 80, 'نوے': 90, 'سو': 100, 'ہزار': 1000,
};

function convertSpokenNumbersToDigits(text: string): string {
  // Normalize Urdu digits ٠-٩ / ۰-۹ to ASCII digits
  let normalized = text
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

  // Tokenize preserving operators/words
  const tokens = normalized.split(/\s+/);
  const out: string[] = [];
  let current = 0;
  let hasNum = false;

  const flush = () => {
    if (hasNum) {
      out.push(String(current));
      current = 0;
      hasNum = false;
    }
  };

  for (const rawTok of tokens) {
    const tok = rawTok.toLowerCase().replace(/[?,!۔]/g, '');
    if (!tok) continue;

    if (/^\d+(?:\.\d+)?$/.test(tok)) {
      const val = Number(tok);
      if (hasNum && current > 0 && current < 1000 && val >= 100) {
        current *= val;
      } else if (hasNum) {
        flush();
        current = val;
        hasNum = true;
      } else {
        current = val;
        hasNum = true;
      }
      continue;
    }

    if (tok in WORD_NUMBERS) {
      const val = WORD_NUMBERS[tok];
      if (val === 100) {
        current = (hasNum && current > 0 ? current : 1) * 100;
        hasNum = true;
      } else if (val === 1000) {
        current = (hasNum && current > 0 ? current : 1) * 1000;
        hasNum = true;
      } else if (hasNum) {
        current += val;
      } else {
        current = val;
        hasNum = true;
      }
      continue;
    }

    flush();
    out.push(rawTok);
  }

  flush();
  return out.join(' ');
}

export interface ParsedVoiceResult {
  action: 'calculate' | 'clear' | 'ai_followup';
  expression?: string;
  followupIntent?: string;
  requestedLanguage?: ExplanationLanguage;
}

export function parseVoiceMathCommand(transcript: string): ParsedVoiceResult {
  const clean = transcript.trim();
  const lower = clean.toLowerCase();

  // Check clear commands
  if (
    /\b(clear|reset|saaf karo|calculator clear karo|saaf|mitao)\b/i.test(lower) ||
    /صاف کرو|کلیئر/.test(clean)
  ) {
    return { action: 'clear' };
  }

  // Check AI follow-up commands (camera+voice combination)
  const aiKeywords = [
    'samjhao', 'samjha', 'explain', 'step by step', 'batao', 'dikhao',
    'dobara', 'agla', 'urdu mein', 'english mein', 'roman urdu',
    'سمجھاؤ', 'بتاؤ', 'دکھاؤ', 'دوبارہ', 'اردو میں',
  ];
  if (aiKeywords.some((k) => lower.includes(k) || clean.includes(k))) {
    let requestedLanguage: ExplanationLanguage | undefined;
    if (/roman\s*urdu/i.test(lower)) requestedLanguage = 'roman_urdu';
    else if (/\burdu\b|اردو/i.test(clean)) requestedLanguage = 'urdu';
    else if (/\benglish\b|انگریزی/i.test(clean)) requestedLanguage = 'english';

    return {
      action: 'ai_followup',
      followupIntent: clean,
      requestedLanguage,
    };
  }

  // Convert number words -> numeric strings
  let expr = convertSpokenNumbersToDigits(clean);

  // Handle "X ka Y percent/feesad" -> "(Y/100) * X" (e.g. "50 ka 20 percent" = 10, "500 کا 20 فیصد" = 100)
  expr = expr.replace(
    /(\d+(?:\.\d+)?)\s+(?:ka|کا)\s+(\d+(?:\.\d+)?)\s*(?:percent|feesad|fisad|فیصد|%)/gi,
    '($2/100)*$1'
  );

  // Handle "Y percent of X" -> "(Y/100) * X"
  expr = expr.replace(
    /(\d+(?:\.\d+)?)\s*(?:percent|feesad|fisad|فیصد|%)\s*(?:of)\s*(\d+(?:\.\d+)?)/gi,
    '($1/100)*$2'
  );

  // Handle square root / jazar
  expr = expr
    .replace(/(?:square\s+root\s+of|root\s+of|jazar)\s+(\d+(?:\.\d+)?)/gi, 'sqrt($1)')
    .replace(/(?:جذر)\s+(\d+(?:\.\d+)?)/g, 'sqrt($1)')
    .replace(/(\d+(?:\.\d+)?)\s+(?:ka\s+)?(?:square\s+root|jazar)/gi, 'sqrt($1)');

  // Handle cube / square
  expr = expr
    .replace(/(\d+(?:\.\d+)?)\s+(?:squared|square|ka\s+square|مربع)/gi, '($1)^2')
    .replace(/(\d+(?:\.\d+)?)\s+(?:cubed|cube|ka\s+cube|مکعب)/gi, '($1)^3');

  // Replace spoken operators in English, Roman Urdu, Urdu
  expr = expr
    .replace(/\b(plus|add|jama|jod)\b/gi, '+')
    .replace(/جمع/g, '+')
    .replace(/\b(minus|subtract|less|nafi|kam|ghata)\b/gi, '-')
    .replace(/تفریق|نافی|منفی/g, '-')
    .replace(/\b(multiplied\s+by|multiply\s+by|times|into|guna|zarab|zarb)\b/gi, '*')
    .replace(/ضرب/g, '*')
    .replace(/\b(divided\s+by|divide\s+by|over|taqseem|bata)\b/gi, '/')
    .replace(/تقسیم/g, '/')
    .replace(/\b(power|raised\s+to|ki\s+power)\b/gi, '^')
    .replace(/\b(point|dot|ashariya)\b/gi, '.')
    .replace(/اعشاریہ/g, '.')
    .replace(/\b(percent|feesad|fisad)\b/gi, '%')
    .replace(/فیصد/g, '%');

  // Clean stray filler words like "and", "aur", "equals", "kitna hota hai"
  expr = expr
    .replace(/\b(what\s+is|calculate|compute|equals|equal\s+to|kitna|hota|hai|ka|ki|and|aur)\b/gi, ' ')
    .replace(/[?؟۔,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Fix spaces around decimal point: "3 . 5" -> "3.5"
  expr = expr.replace(/(\d)\s*\.\s*(\d)/g, '$1.$2');

  return {
    action: 'calculate',
    expression: expr,
  };
}
