import React, { useState } from 'react';
import {
  Percent,
  Tag,
  Receipt,
  Landmark,
  Calendar,
  CalendarClock,
  Ruler,
  Coins,
  Divide,
  Scale,
  BarChart3,
} from 'lucide-react';
import { loadCurrencyRates, saveCurrencyRates, triggerHaptic } from '../utils/storage';

type ToolId =
  | 'percentage'
  | 'discount'
  | 'tax'
  | 'emi'
  | 'age'
  | 'date'
  | 'unit'
  | 'currency'
  | 'fraction'
  | 'ratio'
  | 'average';

interface ExtraToolsScreenProps {
  hapticEnabled: boolean;
}

export const ExtraToolsScreen: React.FC<ExtraToolsScreenProps> = ({ hapticEnabled }) => {
  const [activeTool, setActiveTool] = useState<ToolId>('percentage');
  const haptic = () => triggerHaptic(hapticEnabled, 10);

  const tools: Array<{ id: ToolId; label: string; icon: React.ReactNode }> = [
    { id: 'percentage', label: 'Percentage', icon: <Percent className="w-4 h-4" /> },
    { id: 'discount', label: 'Discount', icon: <Tag className="w-4 h-4" /> },
    { id: 'tax', label: 'Tax / GST', icon: <Receipt className="w-4 h-4" /> },
    { id: 'emi', label: 'EMI Loan', icon: <Landmark className="w-4 h-4" /> },
    { id: 'age', label: 'Age', icon: <CalendarClock className="w-4 h-4" /> },
    { id: 'date', label: 'Date Diff', icon: <Calendar className="w-4 h-4" /> },
    { id: 'unit', label: 'Units', icon: <Ruler className="w-4 h-4" /> },
    { id: 'currency', label: 'Currency', icon: <Coins className="w-4 h-4" /> },
    { id: 'fraction', label: 'Fraction', icon: <Divide className="w-4 h-4" /> },
    { id: 'ratio', label: 'Ratio', icon: <Scale className="w-4 h-4" /> },
    { id: 'average', label: 'Average', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Tool Selector Grid */}
      <div className="lg:col-span-4 rounded-3xl bg-white dark:bg-[#0D0D11] border border-zinc-200 dark:border-zinc-800 p-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3 px-1">
          Smart Calculator Tools
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2">
          {tools.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                haptic();
                setActiveTool(t.id);
              }}
              className={`min-h-[46px] px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                activeTool === t.id
                  ? 'bg-gradient-to-r from-[#FCE38A] to-[#D4AF37] text-zinc-950 border-amber-400 shadow-sm'
                  : 'bg-zinc-50 dark:bg-[#14141A] border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-amber-500/40'
              }`}
            >
              {t.icon}
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Active Tool Workspace */}
      <div className="lg:col-span-8 rounded-3xl bg-white dark:bg-[#0D0D11] border border-zinc-200 dark:border-amber-500/20 p-5 sm:p-6">
        {activeTool === 'percentage' && <PercentageTool />}
        {activeTool === 'discount' && <DiscountTool />}
        {activeTool === 'tax' && <TaxTool />}
        {activeTool === 'emi' && <EmiTool />}
        {activeTool === 'age' && <AgeTool />}
        {activeTool === 'date' && <DateDiffTool />}
        {activeTool === 'unit' && <UnitConverterTool />}
        {activeTool === 'currency' && <CurrencyTool />}
        {activeTool === 'fraction' && <FractionTool />}
        {activeTool === 'ratio' && <RatioTool />}
        {activeTool === 'average' && <AverageTool />}
      </div>
    </div>
  );
};

const inputCls =
  'w-full min-h-[44px] rounded-xl bg-zinc-50 dark:bg-[#14141A] border border-zinc-200 dark:border-zinc-800 px-3.5 text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500';

const ResultBox: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="rounded-2xl bg-zinc-50 dark:bg-[#14141A] border border-zinc-200 dark:border-zinc-800 p-4">
    <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
    <div className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-300 mt-1">
      {value}
    </div>
    {sub && <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{sub}</div>}
  </div>
);

const PercentageTool: React.FC = () => {
  const [pct, setPct] = useState('20');
  const [base, setBase] = useState('500');
  const p = Number(pct) || 0;
  const b = Number(base) || 0;
  const val = (p / 100) * b;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Percentage Calculator</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Percentage (%)
          <input type="number" value={pct} onChange={(e) => setPct(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Total Value
          <input type="number" value={base} onChange={(e) => setBase(e.target.value)} className={inputCls} />
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ResultBox label={`${p}% of ${b}`} value={val.toFixed(2)} />
        <ResultBox label={`${b} + ${p}%`} value={(b + val).toFixed(2)} />
        <ResultBox label={`${b} − ${p}%`} value={(b - val).toFixed(2)} />
      </div>
    </div>
  );
};

const DiscountTool: React.FC = () => {
  const [price, setPrice] = useState('2500');
  const [disc, setDisc] = useState('15');
  const p = Number(price) || 0;
  const d = Number(disc) || 0;
  const saved = (p * d) / 100;
  const finalPrice = p - saved;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Discount Calculator</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Original Price
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Discount (%)
          <input type="number" value={disc} onChange={(e) => setDisc(e.target.value)} className={inputCls} />
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ResultBox label="Final Payable Price" value={finalPrice.toFixed(2)} />
        <ResultBox label="You Save" value={saved.toFixed(2)} />
      </div>
    </div>
  );
};

const TaxTool: React.FC = () => {
  const [amount, setAmount] = useState('1000');
  const [rate, setRate] = useState('18');
  const [inclusive, setInclusive] = useState(false);

  const amt = Number(amount) || 0;
  const r = Number(rate) || 0;
  const net = inclusive ? amt / (1 + r / 100) : amt;
  const tax = inclusive ? amt - net : (amt * r) / 100;
  const total = inclusive ? amt : amt + tax;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Tax / GST Calculator</h3>
        <button
          type="button"
          onClick={() => setInclusive((v) => !v)}
          className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-semibold cursor-pointer"
        >
          {inclusive ? 'Tax Inclusive' : 'Tax Exclusive'}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Amount
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Tax Rate (%)
          <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} className={inputCls} />
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ResultBox label="Net Amount" value={net.toFixed(2)} />
        <ResultBox label="Tax Amount" value={tax.toFixed(2)} />
        <ResultBox label="Total Amount" value={total.toFixed(2)} />
      </div>
    </div>
  );
};

const EmiTool: React.FC = () => {
  const [principal, setPrincipal] = useState('500000');
  const [annualRate, setAnnualRate] = useState('12');
  const [months, setMonths] = useState('24');

  const P = Math.max(0, Number(principal) || 0);
  const r = Math.max(0, Number(annualRate) || 0) / 12 / 100;
  const n = Math.max(1, Number(months) || 1);
  const emi = r === 0 ? P / n : (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const totalPayable = emi * n;
  const totalInterest = totalPayable - P;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">EMI Loan Calculator</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Loan Principal
          <input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Annual Interest (%)
          <input type="number" value={annualRate} onChange={(e) => setAnnualRate(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Tenure (Months)
          <input type="number" value={months} onChange={(e) => setMonths(e.target.value)} className={inputCls} />
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ResultBox label="Monthly EMI" value={emi.toFixed(2)} />
        <ResultBox label="Total Interest" value={totalInterest.toFixed(2)} />
        <ResultBox label="Total Payment" value={totalPayable.toFixed(2)} />
      </div>
    </div>
  );
};

const AgeTool: React.FC = () => {
  const [dob, setDob] = useState('2000-01-01');
  const birth = new Date(dob);
  const now = new Date();

  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();

  if (days < 0) {
    months--;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  const valid = !Number.isNaN(birth.getTime()) && years >= 0;
  const totalDays = valid ? Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Age Calculator</h3>
      <label className="flex flex-col gap-1 text-xs text-zinc-500 max-w-xs">
        Date of Birth
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputCls} />
      </label>
      {valid ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ResultBox label="Exact Age" value={`${years}y ${months}m ${days}d`} />
          <ResultBox label="Total Days Lived" value={totalDays.toLocaleString()} />
        </div>
      ) : (
        <div className="text-xs text-rose-500">Select a valid past date of birth.</div>
      )}
    </div>
  );
};

const DateDiffTool: React.FC = () => {
  const [d1, setD1] = useState('2026-01-01');
  const [d2, setD2] = useState('2026-12-31');

  const t1 = new Date(d1).getTime();
  const t2 = new Date(d2).getTime();
  const diffDays = Number.isFinite(t1) && Number.isFinite(t2) ? Math.abs(Math.round((t2 - t1) / 86400000)) : 0;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Date Difference Calculator</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Start Date
          <input type="date" value={d1} onChange={(e) => setD1(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          End Date
          <input type="date" value={d2} onChange={(e) => setD2(e.target.value)} className={inputCls} />
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ResultBox label="Total Days" value={`${diffDays} days`} />
        <ResultBox label="Weeks" value={`${(diffDays / 7).toFixed(1)} wks`} />
        <ResultBox label="Approx Months" value={`${(diffDays / 30.4375).toFixed(1)} mos`} />
      </div>
    </div>
  );
};

const UNIT_GROUPS: Record<string, Record<string, number>> = {
  Length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254 },
  Mass: { kg: 1, g: 0.001, mg: 0.000001, lb: 0.45359237, oz: 0.02834952 },
  Area: { sqm: 1, sqkm: 1e6, sqft: 0.092903, acre: 4046.856, ha: 10000 },
  Volume: { L: 1, mL: 0.001, gal: 3.78541, m3: 1000 },
  Speed: { 'm/s': 1, 'km/h': 1 / 3.6, mph: 0.44704 },
  Data: { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 },
};

const UnitConverterTool: React.FC = () => {
  const [cat, setCat] = useState<string>('Length');
  const [val, setVal] = useState('1');
  const [from, setFrom] = useState('km');
  const [to, setTo] = useState('m');
  const [tempFrom, setTempFrom] = useState<'C' | 'F' | 'K'>('C');
  const [tempTo, setTempTo] = useState<'C' | 'F' | 'K'>('F');

  const isTemp = cat === 'Temperature';
  const numVal = Number(val) || 0;

  let converted = 0;
  if (isTemp) {
    let celsius = numVal;
    if (tempFrom === 'F') celsius = ((numVal - 32) * 5) / 9;
    if (tempFrom === 'K') celsius = numVal - 273.15;
    if (tempTo === 'C') converted = celsius;
    if (tempTo === 'F') converted = (celsius * 9) / 5 + 32;
    if (tempTo === 'K') converted = celsius + 273.15;
  } else {
    const units = UNIT_GROUPS[cat];
    const fromFactor = units[from] ?? 1;
    const toFactor = units[to] ?? 1;
    converted = (numVal * fromFactor) / toFactor;
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Unit Converter</h3>
      <div className="flex flex-wrap gap-1.5">
        {[...Object.keys(UNIT_GROUPS), 'Temperature'].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setCat(c);
              if (c !== 'Temperature') {
                const keys = Object.keys(UNIT_GROUPS[c]);
                setFrom(keys[0]);
                setTo(keys[1] || keys[0]);
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
              cat === c
                ? 'bg-amber-500 text-zinc-950 border-amber-400'
                : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Value
          <input type="number" value={val} onChange={(e) => setVal(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          From
          {isTemp ? (
            <select value={tempFrom} onChange={(e) => setTempFrom(e.target.value as 'C' | 'F' | 'K')} className={inputCls}>
              <option value="C">Celsius (°C)</option>
              <option value="F">Fahrenheit (°F)</option>
              <option value="K">Kelvin (K)</option>
            </select>
          ) : (
            <select value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls}>
              {Object.keys(UNIT_GROUPS[cat]).map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          )}
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          To
          {isTemp ? (
            <select value={tempTo} onChange={(e) => setTempTo(e.target.value as 'C' | 'F' | 'K')} className={inputCls}>
              <option value="C">Celsius (°C)</option>
              <option value="F">Fahrenheit (°F)</option>
              <option value="K">Kelvin (K)</option>
            </select>
          ) : (
            <select value={to} onChange={(e) => setTo(e.target.value)} className={inputCls}>
              {Object.keys(UNIT_GROUPS[cat]).map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          )}
        </label>
      </div>

      <ResultBox
        label={`Converted (${isTemp ? tempTo : to})`}
        value={Number(converted.toPrecision(8)).toString()}
      />
    </div>
  );
};

const CurrencyTool: React.FC = () => {
  const [rates, setRates] = useState<Record<string, number>>(() => loadCurrencyRates());
  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState('PKR');
  const [editingRates, setEditingRates] = useState(false);

  const amt = Number(amount) || 0;
  const usdVal = amt / (rates[from] || 1);
  const result = usdVal * (rates[to] || 1);

  const updateRate = (code: string, val: string) => {
    const num = Number(val);
    if (!Number.isFinite(num) || num <= 0) return;
    const next = { ...rates, [code]: num };
    setRates(next);
    saveCurrencyRates(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
          Currency Converter (Editable Rates)
        </h3>
        <button
          type="button"
          onClick={() => setEditingRates((v) => !v)}
          className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-xs font-semibold text-amber-700 dark:text-amber-300 cursor-pointer"
        >
          {editingRates ? 'Done Editing' : 'Edit Rates'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Amount
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          From
          <select value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls}>
            {Object.keys(rates).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          To
          <select value={to} onChange={(e) => setTo(e.target.value)} className={inputCls}>
            {Object.keys(rates).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      <ResultBox label={`${amt} ${from} =`} value={`${result.toFixed(2)} ${to}`} sub="Rates stored locally and editable offline." />

      {editingRates && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          {Object.entries(rates).map(([code, r]) => (
            <label key={code} className="flex flex-col gap-1 text-xs text-zinc-500">
              1 USD → {code}
              <input
                type="number"
                step="0.01"
                value={r}
                disabled={code === 'USD'}
                onChange={(e) => updateRate(code, e.target.value)}
                className={inputCls}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

const FractionTool: React.FC = () => {
  const [n1, setN1] = useState('3');
  const [d1, setD1] = useState('4');
  const [op, setOp] = useState<'+' | '-' | '*' | '/'>('+');
  const [n2, setN2] = useState('1');
  const [d2, setD2] = useState('2');

  const a = Number(n1) || 0;
  const b = Number(d1) || 1;
  const c = Number(n2) || 0;
  const d = Number(d2) || 1;

  let resN = 0;
  let resD = 1;
  if (op === '+') { resN = a * d + c * b; resD = b * d; }
  if (op === '-') { resN = a * d - c * b; resD = b * d; }
  if (op === '*') { resN = a * c; resD = b * d; }
  if (op === '/') { resN = a * d; resD = b * c; }

  const valid = resD !== 0;
  const g = valid ? gcd(resN, resD) : 1;
  const simpN = valid ? (resD < 0 ? -resN / g : resN / g) : 0;
  const simpD = valid ? Math.abs(resD / g) : 1;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Fraction Calculator</h3>
      <div className="grid grid-cols-5 gap-2 items-center">
        <div className="col-span-2 flex flex-col gap-1.5">
          <input type="number" value={n1} onChange={(e) => setN1(e.target.value)} placeholder="Num" className={inputCls} />
          <div className="h-0.5 bg-amber-500/50" />
          <input type="number" value={d1} onChange={(e) => setD1(e.target.value)} placeholder="Den" className={inputCls} />
        </div>
        <select value={op} onChange={(e) => setOp(e.target.value as '+' | '-' | '*' | '/')} className={`${inputCls} text-center`}>
          <option value="+">+</option>
          <option value="-">−</option>
          <option value="*">×</option>
          <option value="/">÷</option>
        </select>
        <div className="col-span-2 flex flex-col gap-1.5">
          <input type="number" value={n2} onChange={(e) => setN2(e.target.value)} placeholder="Num" className={inputCls} />
          <div className="h-0.5 bg-amber-500/50" />
          <input type="number" value={d2} onChange={(e) => setD2(e.target.value)} placeholder="Den" className={inputCls} />
        </div>
      </div>
      <ResultBox
        label="Simplified Fraction"
        value={valid ? `${simpN}/${simpD}` : 'Undefined (÷ 0)'}
        sub={valid ? `Decimal: ${(simpN / simpD).toFixed(6)}` : undefined}
      />
    </div>
  );
};

const RatioTool: React.FC = () => {
  const [a, setA] = useState('4');
  const [b, setB] = useState('6');
  const [c, setC] = useState('10');

  const na = Number(a) || 0;
  const nb = Number(b) || 0;
  const nc = Number(c) || 0;
  const g = na && nb ? gcd(na, nb) : 1;
  const propX = na !== 0 ? (nb * nc) / na : 0;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Ratio & Proportion Calculator</h3>
      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          A
          <input type="number" value={a} onChange={(e) => setA(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          B
          <input type="number" value={b} onChange={(e) => setB(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          C (Solve A:B = C:X)
          <input type="number" value={c} onChange={(e) => setC(e.target.value)} className={inputCls} />
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ResultBox label="Simplified Ratio A : B" value={`${na / g} : ${nb / g}`} />
        <ResultBox label="Proportion Value X" value={na !== 0 ? propX.toFixed(4) : 'Undefined'} />
      </div>
    </div>
  );
};

const AverageTool: React.FC = () => {
  const [raw, setRaw] = useState('10, 20, 30, 40, 50');
  const nums = raw
    .split(/[,\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => sValid(n));

  function sValid(n: number) {
    return Number.isFinite(n);
  }

  const count = nums.length;
  const sum = nums.reduce((acc, v) => acc + v, 0);
  const mean = count ? sum / count : 0;
  const sorted = [...nums].sort((x, y) => x - y);
  const median =
    count === 0
      ? 0
      : count % 2 === 1
      ? sorted[(count - 1) / 2]
      : (sorted[count / 2 - 1] + sorted[count / 2]) / 2;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Average & Statistics Calculator</h3>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        Numbers (comma or space separated)
        <input type="text" value={raw} onChange={(e) => setRaw(e.target.value)} className={inputCls} />
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ResultBox label="Mean (Average)" value={mean.toFixed(4)} />
        <ResultBox label="Median" value={median.toFixed(4)} />
        <ResultBox label="Sum" value={sum.toFixed(2)} />
        <ResultBox label="Count" value={String(count)} />
      </div>
    </div>
  );
};
