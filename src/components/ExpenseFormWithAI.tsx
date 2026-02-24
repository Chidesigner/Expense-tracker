// components/ExpenseFormWithAI.tsx
// Drop-in replacement for the ExpenseForm inside Expenses.jsx
// Adds: live AI category suggestion as user types title

import { useState, useEffect, useRef } from 'react';
import { suggestCategory } from '../lib/ai';

type Category = 'Food' | 'Transport' | 'Shopping' | 'Bills' | 'Entertainment' | 'Other';
const CATEGORIES: Category[] = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Other'];

const CAT_META: Record<Category, { icon: string; bg: string; text: string }> = {
  Food:          { icon: '🛒', bg: '#fef3c7', text: '#92400e' },
  Transport:     { icon: '🚗', bg: '#dbeafe', text: '#1e40af' },
  Shopping:      { icon: '🛍️', bg: '#fce7f3', text: '#9d174d' },
  Bills:         { icon: '📋', bg: '#f3f4f6', text: '#374151' },
  Entertainment: { icon: '🎬', bg: '#ede9fe', text: '#5b21b6' },
  Other:         { icon: '📦', bg: '#f0fdf4', text: '#166534' },
};

interface ExpenseData {
  title: string;
  amount: number;
  category: string;
  date: string;
  notes: string;
}

interface Props {
  editingExpense?: ExpenseData & { id?: string } | null;
  onSave: (data: ExpenseData) => Promise<void>;
  onCancel: () => void;
  symbol: string;
}

// ─── SANITIZATION (same as original) ─────────────────────────────────────────
function sanitizeInput(raw: string) {
  if (!raw || typeof raw !== 'string') return { value: '', threats: [] as { layer: number; type: string; label: string; detail: string }[], blocked: false };
  const threats: { layer: number; type: string; label: string; detail: string }[] = [];
  let val = raw, blocked = false;

  const tagMatches = val.match(/<[^>]*>/g) || [];
  tagMatches.forEach(tag => threats.push({ layer: 1, type: 'sanitized', label: 'HTML tag removed', detail: tag }));
  val = val.replace(/<[^>]*>/g, '');

  const scriptPatterns = [
    { re: /javascript:/gi, name: 'javascript: URI' },
    { re: /data:/gi,       name: 'data: URI' },
    { re: /on\w+\s*=/gi,  name: 'Inline event handler' },
  ];
  scriptPatterns.forEach(({ re, name }) => {
    if (re.test(raw)) { blocked = true; threats.push({ layer: 3, type: 'blocked', label: 'Script pattern blocked', detail: name }); }
  });

  const sqlPatterns = [
    { re: /\bDROP\b/i,   name: 'DROP' },
    { re: /\bDELETE\b/i, name: 'DELETE' },
    { re: /\bUNION\b/i,  name: 'UNION'  },
  ];
  sqlPatterns.forEach(({ re, name }) => {
    if (re.test(raw)) { blocked = true; threats.push({ layer: 4, type: 'blocked', label: 'SQL injection blocked', detail: name }); }
  });

  return { value: blocked ? '' : val, threats, blocked };
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: '#fafaf9',
  border: '1px solid #e7e5e0', borderRadius: 8, fontSize: 14,
  fontFamily: "'DM Sans',sans-serif", color: '#1c1917', outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s', WebkitAppearance: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: '#78746c',
  marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase',
};
const focusIn  = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  (e.target as HTMLElement).style.borderColor = '#818cf8';
  (e.target as HTMLElement).style.boxShadow   = '0 0 0 3px rgba(99,102,241,0.12)';
};
const focusOut = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  (e.target as HTMLElement).style.borderColor = '#e7e5e0';
  (e.target as HTMLElement).style.boxShadow   = 'none';
};

export default function ExpenseFormWithAI({ editingExpense, onSave, onCancel, symbol }: Props) {
  const [title,    setTitle]    = useState(editingExpense?.title    || '');
  const [amount,   setAmount]   = useState(editingExpense?.amount?.toString() || '');
  const [category, setCategory] = useState<Category>((editingExpense?.category as Category) || 'Food');
  const [date,     setDate]     = useState(editingExpense?.date     || new Date().toISOString().split('T')[0]);
  const [notes,    setNotes]    = useState(editingExpense?.notes    || '');
  const [saving,   setSaving]   = useState(false);

  // AI categorization state
  const [aiSuggestion, setAiSuggestion]       = useState<Category | null>(null);
  const [aiLoading,    setAiLoading]           = useState(false);
  const [userOverrode, setUserOverrode]        = useState(false);
  const prevTitleRef                           = useRef('');

  const today = new Date().toISOString().split('T')[0];

  // ── Live AI categorization ──
  useEffect(() => {
    if (userOverrode) return;
    if (title === prevTitleRef.current) return;
    prevTitleRef.current = title;

    if (title.length < 3) { setAiSuggestion(null); return; }

    setAiLoading(true);
    suggestCategory(
      title,
      (suggested) => {
        setAiSuggestion(suggested);
        if (!userOverrode) setCategory(suggested);
        setAiLoading(false);
      },
      550
    );

    // timeout fallback
    const t = setTimeout(() => setAiLoading(false), 3000);
    return () => clearTimeout(t);
  }, [title, userOverrode]);

  const handleCategoryChange = (cat: Category) => {
    setCategory(cat);
    setUserOverrode(true);
    setAiSuggestion(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tr = sanitizeInput(title);
    const nr = sanitizeInput(notes);
    if (tr.blocked || nr.blocked) return;
    const num = parseFloat(amount);
    if (!tr.value.trim()) return;
    if (isNaN(num) || num <= 0) { alert('Amount must be a positive number'); return; }
    if (num > 10_000_000)       { alert('Amount cannot exceed 10,000,000'); return; }

    setSaving(true);
    await onSave({ title: tr.value, amount: num, category, date, notes: nr.value });
    setSaving(false);
  };

  const meta = CAT_META[category];

  return (
    <div style={{
      background: '#fff', border: '1px solid #e7e5e0', borderRadius: 14, padding: 24,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)', animation: 'slideDown 0.2s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em' }}>
          {editingExpense ? '✏️ Edit expense' : '+ New expense'}
        </h3>
        <button onClick={onCancel} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #e7e5e0', background: '#fafaf9', cursor: 'pointer', fontSize: 14, color: '#78746c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Title */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>What did you spend on? *</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text" placeholder="e.g. Groceries at Shoprite"
              value={title} maxLength={100} required
              onChange={e => { setTitle(e.target.value); setUserOverrode(false); }}
              style={{ ...inputStyle, paddingRight: aiLoading ? 40 : 14 }}
              onFocus={focusIn} onBlur={focusOut}
            />
            {/* AI loading spinner inside input */}
            {aiLoading && (
              <div style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{ width: 14, height: 14, border: '2px solid #e0e7ff', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
              </div>
            )}
          </div>

          {/* AI suggestion badge */}
          {aiSuggestion && !aiLoading && !userOverrode && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginTop: 6,
              padding: '4px 10px', background: '#eef2ff', border: '1px solid #c7d2fe',
              borderRadius: 99, width: 'fit-content', fontSize: 11,
            }}>
              <span style={{ fontSize: 13 }}>{CAT_META[aiSuggestion].icon}</span>
              <span style={{ fontWeight: 600, color: '#4338ca' }}>AI: {aiSuggestion}</span>
              <button
                type="button"
                onClick={() => setUserOverrode(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#818cf8', fontSize: 10, padding: 0, fontFamily: 'inherit', fontWeight: 600 }}
              >
                change
              </button>
            </div>
          )}
        </div>

        {/* Amount + Category */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Amount ({symbol}) *</label>
            <input
              type="number" step="0.01" min="0.01" max="10000000"
              placeholder="0.00" value={amount} required
              onChange={e => setAmount(e.target.value)}
              style={{ ...inputStyle, fontFamily: "'DM Mono',monospace" }}
              onFocus={focusIn} onBlur={focusOut}
            />
          </div>
          <div>
            <label style={labelStyle}>
              Category *
              {aiLoading && <span style={{ marginLeft: 6, fontSize: 10, color: '#818cf8', fontStyle: 'italic', textTransform: 'none' }}>AI thinking…</span>}
            </label>
            <select
              value={category}
              onChange={e => handleCategoryChange(e.target.value as Category)}
              style={{
                ...inputStyle,
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2378746c' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 32, cursor: 'pointer',
                borderColor: aiSuggestion && !userOverrode ? '#818cf8' : '#e7e5e0',
                boxShadow:   aiSuggestion && !userOverrode ? '0 0 0 3px rgba(99,102,241,0.1)' : 'none',
                transition:  'all 0.3s ease',
              }}
              onFocus={focusIn} onBlur={focusOut}
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{CAT_META[cat].icon} {cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Date */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Date *</label>
          <input type="date" value={date} max={today} required onChange={e => setDate(e.target.value)} style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Notes <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
          <textarea
            placeholder="Any additional details…" value={notes} maxLength={500} rows={2}
            onChange={e => setNotes(e.target.value)}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 } as React.CSSProperties}
            onFocus={focusIn} onBlur={focusOut}
          />
        </div>

        {/* Category preview */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
          background: meta.bg, borderRadius: 8, marginBottom: 16,
          transition: 'background 0.3s ease',
        }}>
          <span style={{ fontSize: 18 }}>{meta.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: meta.text }}>{category}</span>
          {amount && !isNaN(parseFloat(amount)) && (
            <span style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 700, color: meta.text, fontFamily: "'DM Mono',monospace" }}>
              {symbol}{parseFloat(amount).toLocaleString('en', { minimumFractionDigits: 2 })}
            </span>
          )}
          {aiSuggestion && !userOverrode && (
            <span style={{ marginLeft: aiSuggestion && amount ? 8 : 'auto', fontSize: 10, background: '#4f46e5', color: 'white', padding: '1px 7px', borderRadius: 99, fontWeight: 600 }}>
              ✦ AI
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              flex: 1, padding: '11px 0',
              background: saving ? '#e7e5e0' : '#4f46e5',
              color: saving ? '#a8a49d' : 'white',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {saving && <span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />}
            {saving ? 'Saving…' : editingExpense ? 'Update expense' : 'Save expense'}
          </button>
          <button
            type="button" onClick={onCancel}
            style={{ padding: '11px 18px', background: 'transparent', border: '1px solid #e7e5e0', color: '#78746c', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Cancel
          </button>
        </div>
      </form>

      <style>{`
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}