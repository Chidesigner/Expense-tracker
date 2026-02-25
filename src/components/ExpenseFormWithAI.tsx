// components/ExpenseFormWithAI.tsx
import { useState, useEffect, useRef } from 'react';
import { suggestCategory } from '../lib/ai';
import {
  ShoppingCart, Car, ShoppingBag, Receipt,
  Popcorn, Package, Calendar, ChevronLeft,
  ChevronRight, Sparkles, X, Check,
  DollarSign, FileText, Tag, LucideIcon,
} from 'lucide-react';

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Category = 'Food' | 'Transport' | 'Shopping' | 'Bills' | 'Entertainment' | 'Other';

const CATEGORIES: Category[] = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Other'];

interface CatMeta { icon: LucideIcon; bg: string; text: string; border: string; }

const CAT_META: Record<Category, CatMeta> = {
  Food:          { icon: ShoppingCart, bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  Transport:     { icon: Car,          bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
  Shopping:      { icon: ShoppingBag,  bg: '#fce7f3', text: '#9d174d', border: '#fbcfe8' },
  Bills:         { icon: Receipt,      bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' },
  Entertainment: { icon: Popcorn,      bg: '#ede9fe', text: '#5b21b6', border: '#ddd6fe' },
  Other:         { icon: Package,      bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
};

interface ExpenseData {
  title: string;
  amount: number;
  category: string;
  date: string;
  notes: string;
}

interface Props {
  editingExpense?: (ExpenseData & { id?: string }) | null;
  onSave: (data: ExpenseData) => Promise<void>;
  onCancel: () => void;
  symbol: string;
}

// ─── DATE PICKER ──────────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

interface DatePickerProps { value: string; onChange: (v: string) => void; max: string; }

function DatePicker({ value, onChange, max }: DatePickerProps) {
  const [open, setOpen]           = useState(false);
  const [viewYear, setViewYear]   = useState(() => value ? parseInt(value.split('-')[0]) : new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => value ? parseInt(value.split('-')[1]) - 1 : new Date().getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected    = value ? new Date(value + 'T00:00:00') : null;
  const maxDate     = new Date(max + 'T00:00:00');
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const canGoNext   = new Date(viewYear, viewMonth + 1, 1) <= maxDate;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (!canGoNext) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };
  const selectDay = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    if (d > maxDate) return;
    onChange(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    setOpen(false);
  };

  const display = selected
    ? selected.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Select date';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(v => !v)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', background: '#fafaf9',
        border: `1px solid ${open ? '#818cf8' : '#e7e5e0'}`,
        borderRadius: 10, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
        boxShadow: open ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
        transition: 'all 0.15s',
      }}>
        <Calendar size={15} color={open ? '#6366f1' : '#a8a49d'} />
        <span style={{ fontSize: 14, color: selected ? '#1c1917' : '#a8a49d', flex: 1, textAlign: 'left' }}>{display}</span>
        <ChevronRight size={14} color="#a8a49d" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#fff', border: '1px solid #e7e5e0', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.12)', zIndex: 100, padding: 16, animation: 'dropIn 0.15s ease' }}>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button type="button" onClick={prevMonth} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #e7e5e0', background: '#fafaf9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={14} color="#57534e" />
            </button>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1c1917' }}>{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} disabled={!canGoNext} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #e7e5e0', background: canGoNext ? '#fafaf9' : '#f5f5f4', cursor: canGoNext ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canGoNext ? 1 : 0.4 }}>
              <ChevronRight size={14} color="#57534e" />
            </button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 6 }}>
            {DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#a8a49d', padding: '4px 0', textTransform: 'uppercase' }}>{d}</div>)}
          </div>

          {/* Days */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
            {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
            {Array(daysInMonth).fill(null).map((_, i) => {
              const day   = i + 1;
              const date  = new Date(viewYear, viewMonth, day);
              const isSel = selected ? date.toDateString() === selected.toDateString() : false;
              const isToday = date.toDateString() === new Date().toDateString();
              const isDis = date > maxDate;
              return (
                <button key={day} type="button" onClick={() => selectDay(day)} disabled={isDis} style={{ padding: '6px 0', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: isSel ? 700 : 500, background: isSel ? '#4f46e5' : isToday ? '#eef2ff' : 'transparent', color: isSel ? 'white' : isToday ? '#4f46e5' : isDis ? '#d4d2cd' : '#1c1917', cursor: isDis ? 'not-allowed' : 'pointer', transition: 'all 0.1s' }}
                  onMouseEnter={e => { if (!isSel && !isDis) (e.currentTarget as HTMLButtonElement).style.background = '#f5f5f4'; }}
                  onMouseLeave={e => { if (!isSel && !isDis) (e.currentTarget as HTMLButtonElement).style.background = isToday ? '#eef2ff' : 'transparent'; }}
                >{day}</button>
              );
            })}
          </div>

          {/* Today shortcut */}
          <div style={{ borderTop: '1px solid #f5f5f4', marginTop: 10, paddingTop: 10, textAlign: 'center' }}>
            <button type="button" onClick={() => { onChange(max); setOpen(false); }} style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Today</button>
          </div>
        </div>
      )}
      <style>{`@keyframes dropIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  );
}

// ─── SANITIZE ─────────────────────────────────────────────────────────────────
function sanitize(raw: string): { value: string; blocked: boolean } {
  if (!raw) return { value: '', blocked: false };
  const val     = raw.replace(/<[^>]*>/g, '');
  const blocked = /javascript:|data:|on\w+\s*=|\bDROP\b|\bDELETE\b|\bUNION\b/i.test(raw);
  return { value: blocked ? '' : val, blocked };
}

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: '#fafaf9',
  border: '1px solid #e7e5e0', borderRadius: 10, fontSize: 14,
  fontFamily: "'DM Sans',sans-serif", color: '#1c1917', outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};
const focusIn  = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.target.style.borderColor = '#818cf8'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)';
};
const focusOut = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.target.style.borderColor = '#e7e5e0'; e.target.style.boxShadow = 'none';
};

// ─── MAIN FORM ────────────────────────────────────────────────────────────────
export default function ExpenseFormWithAI({ editingExpense, onSave, onCancel, symbol }: Props) {
  const [title,        setTitle]        = useState(editingExpense?.title    || '');
  const [amount,       setAmount]       = useState(editingExpense?.amount?.toString() || '');
  const [category,     setCategory]     = useState<Category>((editingExpense?.category as Category) || 'Food');
  const [date,         setDate]         = useState(editingExpense?.date     || new Date().toISOString().split('T')[0]);
  const [notes,        setNotes]        = useState(editingExpense?.notes    || '');
  const [saving,       setSaving]       = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<Category | null>(null);
  const [aiLoading,    setAiLoading]    = useState(false);
  const [userOverrode, setUserOverrode] = useState(false);
  const prevTitleRef = useRef('');
  const today = new Date().toISOString().split('T')[0];

  // Live AI categorization
  useEffect(() => {
    if (userOverrode || title === prevTitleRef.current || title.length < 3) return;
    prevTitleRef.current = title;
    setAiLoading(true);
    suggestCategory(title, (suggested) => {
      setAiSuggestion(suggested);
      if (!userOverrode) setCategory(suggested);
      setAiLoading(false);
    }, 550);
    const t = setTimeout(() => setAiLoading(false), 3000);
    return () => clearTimeout(t);
  }, [title, userOverrode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tr = sanitize(title);
    const nr = sanitize(notes);
    if (tr.blocked || nr.blocked) return;
    const num = parseFloat(amount);
    if (!tr.value.trim() || isNaN(num) || num <= 0 || num > 10_000_000) return;
    setSaving(true);
    await onSave({ title: tr.value, amount: num, category, date, notes: nr.value });
    setSaving(false);
  };

  const meta = CAT_META[category];
  const Icon = meta.icon;

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e7e5e0', boxShadow: '0 20px 60px rgba(0,0,0,0.12)', overflow: 'hidden', animation: 'formSlideIn 0.2s ease', fontFamily: "'DM Sans',sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ padding: '18px 22px', borderBottom: '1px solid #f5f5f4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(to right,#fafaf9,#fff)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: meta.bg, border: `1px solid ${meta.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: meta.text, transition: 'all 0.3s' }}>
            <Icon size={15} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1917' }}>{editingExpense ? 'Edit expense' : 'New expense'}</div>
            <div style={{ fontSize: 11, color: '#a8a49d' }}>Fill in the details below</div>
          </div>
        </div>
        <button type="button" onClick={onCancel} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #e7e5e0', background: '#fafaf9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#78746c', transition: 'all 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff1f2'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#fca5a5'; (e.currentTarget as HTMLButtonElement).style.color = '#e11d48'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fafaf9'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#e7e5e0'; (e.currentTarget as HTMLButtonElement).style.color = '#78746c'; }}>
          <X size={14} />
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '20px 22px' }}>

        {/* ── Title ── */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#78746c', letterSpacing: '0.06em', textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center', gap: 5 }}>
              <FileText size={11} /> Description
            </label>
            {aiLoading && <span style={{ fontSize: 10, color: '#818cf8', display: 'flex', alignItems: 'center', gap: 3 }}><Sparkles size={10} /> AI thinking…</span>}
          </div>
          <div style={{ position: 'relative' }}>
            <input type="text" placeholder="e.g. Groceries at Shoprite" value={title} maxLength={100} required
              onChange={e => { setTitle(e.target.value); setUserOverrode(false); }}
              style={{ ...inputStyle, paddingRight: aiLoading ? 40 : 14 }}
              onFocus={focusIn} onBlur={focusOut}
            />
            {aiLoading && (
              <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: '2px solid #e0e7ff', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            )}
          </div>
          {aiSuggestion && !aiLoading && !userOverrode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '4px 10px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 99, width: 'fit-content' }}>
              <Sparkles size={10} color="#6366f1" />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#4338ca' }}>AI: {aiSuggestion}</span>
              <button type="button" onClick={() => setUserOverrode(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#818cf8', fontSize: 10, padding: 0, fontFamily: 'inherit', fontWeight: 600 }}>change</button>
            </div>
          )}
        </div>

        {/* ── Amount + Category ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#78746c', letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
              <DollarSign size={11} /> Amount ({symbol})
            </label>
            <input type="number" step="0.01" min="0.01" max="10000000" placeholder="0.00" value={amount} required
              onChange={e => setAmount(e.target.value)}
              style={{ ...inputStyle, fontFamily: "'DM Mono',monospace" }}
              onFocus={focusIn} onBlur={focusOut}
            />
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#78746c', letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
              <Tag size={11} /> Category
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4 }}>
              {CATEGORIES.map(cat => {
                const m      = CAT_META[cat];
                const CatIcon = m.icon;
                const isActive = category === cat;
                return (
                  <button key={cat} type="button"
                    onClick={() => { setCategory(cat); setUserOverrode(true); setAiSuggestion(null); }}
                    style={{ padding: '7px 4px', borderRadius: 8, border: `1.5px solid ${isActive ? m.text + '55' : '#e7e5e0'}`, background: isActive ? m.bg : '#fafaf9', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, transition: 'all 0.15s' }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = '#f5f5f4'; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = '#fafaf9'; }}
                  >
                    <CatIcon size={14} color={isActive ? m.text : '#a8a49d'} />
                    <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' as const, color: isActive ? m.text : '#78746c' }}>{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Date ── */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#78746c', letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
            <Calendar size={11} /> Date
          </label>
          <DatePicker value={date} onChange={setDate} max={today} />
        </div>

        {/* ── Notes ── */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#78746c', letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
            <FileText size={11} /> Notes <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'none' as const, letterSpacing: 0 }}>(optional)</span>
          </label>
          <textarea placeholder="Any additional details…" value={notes} maxLength={500} rows={2}
            onChange={e => setNotes(e.target.value)}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 } as React.CSSProperties}
            onFocus={focusIn} onBlur={focusOut}
          />
        </div>

        {/* ── Summary strip ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 10, marginBottom: 16, transition: 'all 0.3s' }}>
          <Icon size={15} color={meta.text} />
          <span style={{ fontSize: 13, fontWeight: 600, color: meta.text }}>{category}</span>
          {date && (
            <span style={{ fontSize: 11, color: meta.text, opacity: 0.7 }}>
              {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {amount && !isNaN(parseFloat(amount)) && (
            <span style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 800, color: meta.text, fontFamily: "'DM Mono',monospace" }}>
              {symbol}{parseFloat(amount).toLocaleString('en', { minimumFractionDigits: 2 })}
            </span>
          )}
          {aiSuggestion && !userOverrode && (
            <span style={{ fontSize: 9, background: '#4f46e5', color: 'white', padding: '2px 6px', borderRadius: 99, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Sparkles size={8} /> AI
            </span>
          )}
        </div>

        {/* ── Buttons ── */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" disabled={saving} style={{ flex: 1, padding: '11px 0', background: saving ? '#e7e5e0' : '#4f46e5', color: saving ? '#a8a49d' : 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: saving ? 'none' : '0 4px 12px rgba(79,70,229,0.3)', transition: 'all 0.15s' }}>
            {saving
              ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Saving…</>
              : <><Check size={15} /> {editingExpense ? 'Update expense' : 'Save expense'}</>
            }
          </button>
          <button type="button" onClick={onCancel} style={{ padding: '11px 18px', background: 'transparent', border: '1px solid #e7e5e0', color: '#78746c', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#d4d2cd'; (e.currentTarget as HTMLButtonElement).style.background = '#fafaf9'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e7e5e0'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
            <X size={14} /> Cancel
          </button>
        </div>
      </form>

      <style>{`
        @keyframes formSlideIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}