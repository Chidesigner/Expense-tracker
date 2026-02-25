// components/ExpenseFormWithAI.tsx
import { useState, useEffect, useRef } from 'react';
import { suggestCategory } from '../lib/ai';
import {
  ShoppingCart, Car, ShoppingBag, FileText as BillsIcon,
  Tv, Package, CalendarDays, ChevronLeft, ChevronRight,
  Sparkles, X, Check, Hash, AlignLeft, LucideIcon,
} from 'lucide-react';

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Category = 'Food' | 'Transport' | 'Shopping' | 'Bills' | 'Entertainment' | 'Other';
const CATEGORIES: Category[] = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Other'];

interface CatMeta { icon: LucideIcon; color: string; bg: string; border: string; }
const CAT_META: Record<Category, CatMeta> = {
  Food:          { icon: ShoppingCart,  color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
  Transport:     { icon: Car,           color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd' },
  Shopping:      { icon: ShoppingBag,   color: '#be185d', bg: '#fce7f3', border: '#f9a8d4' },
  Bills:         { icon: BillsIcon,     color: '#374151', bg: '#f3f4f6', border: '#d1d5db' },
  Entertainment: { icon: Tv,            color: '#6d28d9', bg: '#ede9fe', border: '#c4b5fd' },
  Other:         { icon: Package,       color: '#065f46', bg: '#d1fae5', border: '#6ee7b7' },
};

interface ExpenseData { title: string; amount: number; category: string; date: string; notes: string; }
interface Props {
  editingExpense?: (ExpenseData & { id?: string }) | null;
  onSave: (data: ExpenseData) => Promise<void>;
  onCancel: () => void;
  symbol: string;
}

// ─── CUSTOM DATE PICKER ───────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['S','M','T','W','T','F','S'];

function DatePicker({ value, onChange, max }: { value: string; onChange: (v: string) => void; max: string }) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(() => value ? +value.split('-')[0] : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => value ? +value.split('-')[1] - 1 : today.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const maxDate     = new Date(max + 'T00:00:00');
  const selected    = value ? new Date(value + 'T00:00:00') : null;
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const canNext     = new Date(viewYear, viewMonth + 1, 1) <= maxDate;

  const prevM = () => viewMonth === 0 ? (setViewMonth(11), setViewYear(y => y-1)) : setViewMonth(m => m-1);
  const nextM = () => { if (!canNext) return; viewMonth === 11 ? (setViewMonth(0), setViewYear(y => y+1)) : setViewMonth(m => m+1); };

  const pick = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    if (d > maxDate) return;
    onChange(`${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`);
    setOpen(false);
  };

  const displayVal = selected
    ? `${SHORT_MONTHS[selected.getMonth()]} ${selected.getDate()}, ${selected.getFullYear()}`
    : 'Pick a date';

  return (
    <div ref={ref} style={{ position: 'relative', zIndex: 10 }}>
      {/* Trigger */}
      <button type="button" onClick={() => setOpen(v => !v)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
        background: open ? '#fff' : '#f9fafb',
        border: `1.5px solid ${open ? '#6366f1' : '#e5e7eb'}`,
        borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
        boxShadow: open ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
        transition: 'all 0.15s',
      }}>
        <CalendarDays size={16} color={open ? '#6366f1' : '#9ca3af'} />
        <span style={{ flex: 1, textAlign: 'left', fontSize: 14, color: selected ? '#111827' : '#9ca3af', fontWeight: selected ? 500 : 400 }}>
          {displayVal}
        </span>
        <ChevronRight size={14} color="#9ca3af" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {/* Calendar dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
          background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: '16px',
          animation: 'calIn 0.18s cubic-bezier(0.16,1,0.3,1)',
        }}>
          {/* Month/Year header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button type="button" onClick={prevM} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.1s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb'; }}>
              <ChevronLeft size={14} color="#374151" />
            </button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{MONTHS[viewMonth]}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{viewYear}</div>
            </div>
            <button type="button" onClick={nextM} disabled={!canNext} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb', background: canNext ? '#f9fafb' : '#f3f4f6', cursor: canNext ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canNext ? 1 : 0.35, transition: 'all 0.1s' }}
              onMouseEnter={e => { if (canNext) (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'; }}
              onMouseLeave={e => { if (canNext) (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb'; }}>
              <ChevronRight size={14} color="#374151" />
            </button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 6 }}>
            {WEEKDAYS.map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#9ca3af', padding: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' }}>
            {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
            {Array(daysInMonth).fill(null).map((_, i) => {
              const day     = i + 1;
              const thisDay = new Date(viewYear, viewMonth, day);
              const isSel   = selected ? thisDay.toDateString() === selected.toDateString() : false;
              const isToday = thisDay.toDateString() === today.toDateString();
              const isDis   = thisDay > maxDate;
              return (
                <button key={day} type="button" onClick={() => pick(day)} disabled={isDis} style={{
                  aspectRatio: '1', borderRadius: 8, border: 'none', fontSize: 12,
                  fontWeight: isSel ? 700 : isToday ? 600 : 400,
                  background: isSel ? '#4f46e5' : isToday ? '#eef2ff' : 'transparent',
                  color: isSel ? '#fff' : isToday ? '#4f46e5' : isDis ? '#d1d5db' : '#374151',
                  cursor: isDis ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.1s', position: 'relative',
                }}
                  onMouseEnter={e => { if (!isSel && !isDis) (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'; }}
                  onMouseLeave={e => { if (!isSel && !isDis) (e.currentTarget as HTMLButtonElement).style.background = isToday ? '#eef2ff' : 'transparent'; }}
                >
                  {day}
                  {isToday && !isSel && <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#6366f1' }} />}
                </button>
              );
            })}
          </div>

          {/* Quick shortcuts */}
          <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 12, paddingTop: 10, display: 'flex', gap: 6, justifyContent: 'center' }}>
            {['Today', 'Yesterday'].map((label, i) => {
              const d = new Date(today); d.setDate(today.getDate() - i);
              const str = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
              return (
                <button key={label} type="button" onClick={() => { onChange(str); setOpen(false); }} style={{ padding: '4px 12px', borderRadius: 99, border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 11, fontWeight: 600, color: '#4f46e5', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#eef2ff'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#c7d2fe'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb'; }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <style>{`
        @keyframes calIn { from{opacity:0;transform:translateY(-8px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
      `}</style>
    </div>
  );
}

// ─── SANITIZE ─────────────────────────────────────────────────────────────────
function sanitize(raw: string) {
  const val     = raw.replace(/<[^>]*>/g, '');
  const blocked = /javascript:|data:|on\w+\s*=|\bDROP\b|\bDELETE\b|\bUNION\b/i.test(raw);
  return { value: blocked ? '' : val, blocked };
}

// ─── FORM ─────────────────────────────────────────────────────────────────────
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
  const prevTitle = useRef('');
  const today     = new Date().toISOString().split('T')[0];

  // Live AI categorization
  useEffect(() => {
    if (userOverrode || title === prevTitle.current || title.length < 3) return;
    prevTitle.current = title;
    setAiLoading(true);
    suggestCategory(title, (cat) => {
      setAiSuggestion(cat);
      if (!userOverrode) setCategory(cat);
      setAiLoading(false);
    }, 600);
    const t = setTimeout(() => setAiLoading(false), 3500);
    return () => clearTimeout(t);
  }, [title, userOverrode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tr = sanitize(title), nr = sanitize(notes);
    if (tr.blocked || nr.blocked) return;
    const num = parseFloat(amount);
    if (!tr.value.trim() || isNaN(num) || num <= 0) return;
    setSaving(true);
    await onSave({ title: tr.value, amount: num, category, date, notes: nr.value });
    setSaving(false);
  };

  const meta = CAT_META[category];
  const Icon = meta.icon;
  const parsedAmount = parseFloat(amount);

  // Shared input style
  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 14px', background: '#f9fafb',
    border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14,
    fontFamily: "'DM Sans',sans-serif", color: '#111827',
    outline: 'none', transition: 'all 0.15s',
    boxSizing: 'border-box',
  };
  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = '#6366f1';
    e.target.style.background  = '#fff';
    e.target.style.boxShadow   = '0 0 0 3px rgba(99,102,241,0.1)';
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = '#e5e7eb';
    e.target.style.background  = '#f9fafb';
    e.target.style.boxShadow   = 'none';
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 998, animation: 'fadeIn 0.2s ease' }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: '100%', maxWidth: 480,
        maxHeight: '92vh', overflowY: 'auto',
        background: '#fff', borderRadius: 20,
        boxShadow: '0 32px 80px rgba(0,0,0,0.22)',
        zIndex: 999, animation: 'modalIn 0.25s cubic-bezier(0.16,1,0.3,1)',
        fontFamily: "'DM Sans',sans-serif",
      }}>

        {/* ── Coloured category header ── */}
        <div style={{ background: meta.bg, padding: '22px 24px 18px', borderBottom: `1px solid ${meta.border}`, position: 'relative', transition: 'background 0.3s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: '#fff', boxShadow: `0 4px 12px ${meta.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}>
              <Icon size={20} color={meta.color} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>
                {editingExpense ? 'Edit expense' : 'Add expense'}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
                {category} · {date ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'}
              </div>
            </div>
            {/* Big amount preview */}
            {!isNaN(parsedAmount) && parsedAmount > 0 && (
              <div style={{ marginLeft: 'auto', fontSize: 22, fontWeight: 800, color: meta.color, fontFamily: "'DM Mono',monospace", letterSpacing: '-0.03em' }}>
                {symbol}{parsedAmount.toLocaleString('en', { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>
          {/* Close button */}
          <button type="button" onClick={onCancel} style={{ position: 'absolute', top: 16, right: 16, width: 30, height: 30, borderRadius: '50%', border: '1px solid', borderColor: meta.border, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff1f2'; (e.currentTarget as HTMLButtonElement).style.color = '#e11d48'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}>
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '22px 24px 24px' }}>

          {/* ── Description ── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.07em', textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center', gap: 5 }}>
                <AlignLeft size={10} /> Description
              </label>
              {aiLoading && (
                <span style={{ fontSize: 10, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                  <div style={{ width: 10, height: 10, border: '2px solid #c7d2fe', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.6s linear infinite', flexShrink: 0 }} />
                  AI thinking…
                </span>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <input type="text" placeholder="e.g. Uber ride to office" value={title} maxLength={100} required
                onChange={e => { setTitle(e.target.value); setUserOverrode(false); }}
                style={inp} onFocus={onFocus} onBlur={onBlur}
              />
            </div>
            {/* AI badge */}
            {aiSuggestion && !aiLoading && !userOverrode && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 7, padding: '4px 10px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 99 }}>
                <Sparkles size={10} color="#6366f1" />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#4338ca' }}>AI picked: {aiSuggestion}</span>
                <button type="button" onClick={() => setUserOverrode(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a5b4fc', fontSize: 10, padding: 0, fontFamily: 'inherit', fontWeight: 600 }}>change</button>
              </div>
            )}
          </div>

          {/* ── Amount ── */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.07em', textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
              <Hash size={10} /> Amount ({symbol})
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15, fontWeight: 700, color: '#9ca3af', pointerEvents: 'none' }}>{symbol}</span>
              <input type="number" step="0.01" min="0.01" max="10000000" placeholder="0.00" value={amount} required
                onChange={e => setAmount(e.target.value)}
                style={{ ...inp, paddingLeft: symbol.length > 1 ? 32 : 28, fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 600 }}
                onFocus={onFocus} onBlur={onBlur}
              />
            </div>
          </div>

          {/* ── Category grid ── */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.07em', textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
              <Sparkles size={10} /> Category
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {CATEGORIES.map(cat => {
                const m = CAT_META[cat];
                const CatIcon = m.icon;
                const active  = category === cat;
                return (
                  <button key={cat} type="button"
                    onClick={() => { setCategory(cat); setUserOverrode(true); setAiSuggestion(null); }}
                    style={{
                      padding: '10px 6px 8px', borderRadius: 12, cursor: 'pointer',
                      border: `2px solid ${active ? m.color + '60' : '#e5e7eb'}`,
                      background: active ? m.bg : '#f9fafb',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                      transition: 'all 0.15s',
                      boxShadow: active ? `0 4px 12px ${m.color}20` : 'none',
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb'; }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: active ? '#fff' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: active ? `0 2px 8px ${m.color}25` : '0 1px 3px rgba(0,0,0,0.06)' }}>
                      <CatIcon size={16} color={active ? m.color : '#9ca3af'} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' as const, color: active ? m.color : '#6b7280' }}>{cat}</span>
                    {active && <div style={{ width: 4, height: 4, borderRadius: '50%', background: m.color }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Date ── */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.07em', textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
              <CalendarDays size={10} /> Date
            </label>
            <DatePicker value={date} onChange={setDate} max={today} />
          </div>

          {/* ── Notes ── */}
          <div style={{ marginBottom: 22 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.07em', textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
              <AlignLeft size={10} /> Notes <span style={{ textTransform: 'none' as const, fontWeight: 400, letterSpacing: 0 }}>(optional)</span>
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional details…" maxLength={500} rows={2}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.6 } as React.CSSProperties}
              onFocus={onFocus} onBlur={onBlur}
            />
          </div>

          {/* ── Buttons ── */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={saving} style={{
              flex: 1, padding: '13px', background: saving ? '#e5e7eb' : '#4f46e5',
              color: saving ? '#9ca3af' : '#fff', border: 'none', borderRadius: 12,
              fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: saving ? 'none' : '0 4px 14px rgba(79,70,229,0.35)',
              transition: 'all 0.15s', letterSpacing: '-0.01em',
            }}
              onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = '#4338ca'; }}
              onMouseLeave={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = '#4f46e5'; }}
            >
              {saving
                ? <><div style={{ width: 15, height: 15, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> Saving…</>
                : <><Check size={16} strokeWidth={2.5} /> {editingExpense ? 'Update expense' : 'Save expense'}</>
              }
            </button>
            <button type="button" onClick={onCancel} style={{ padding: '13px 18px', background: '#f3f4f6', border: 'none', color: '#374151', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#e5e7eb'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'; }}>
              <X size={15} /> Cancel
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
        @keyframes modalIn  { from{opacity:0;transform:translate(-50%,-50%) scale(0.96)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
        @keyframes spin     { to{transform:rotate(360deg)} }
      `}</style>
    </>
  );
}