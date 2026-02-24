import { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import {
  collection, addDoc, getDocs, deleteDoc,
  updateDoc, doc, query, where, onSnapshot
} from 'firebase/firestore';
import { useCurrency } from '../context/CurrencyContext';

// ─── SANITIZATION ─────────────────────────────────────────────────────────────
function sanitizeInput(raw) {
  if (!raw || typeof raw !== 'string') return { value: '', threats: [], blocked: false };
  const threats = [];
  let val = raw, blocked = false;

  const tagMatches = val.match(/<[^>]*>/g) || [];
  tagMatches.forEach(tag => threats.push({ layer: 1, type: 'sanitized', label: 'HTML tag removed', detail: tag }));
  val = val.replace(/<[^>]*>/g, '');

  const entityMap = [
    { char: '&', entity: '&amp;',  name: 'Ampersand' },
    { char: '<', entity: '&lt;',   name: 'Less-than' },
    { char: '>', entity: '&gt;',   name: 'Greater-than' },
    { char: '"', entity: '&quot;', name: 'Double quote' },
    { char: "'", entity: '&#x27;', name: 'Single quote' },
    { char: '/', entity: '&#x2F;', name: 'Forward slash' },
  ];
  let anyEncoded = false;
  entityMap.forEach(({ char, entity, name }) => {
    const count = val.split(char).length - 1;
    if (count > 0) { anyEncoded = true; threats.push({ layer: 2, type: 'sanitized', label: 'Character encoded', detail: `${name} → ${entity} (×${count})` }); }
  });
  if (anyEncoded) {
    val = val.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
             .replace(/"/g,'&quot;').replace(/'/g,'&#x27;').replace(/\//g,'&#x2F;');
  }

  const scriptPatterns = [
    { re: /javascript:/gi, name: 'javascript: URI' },
    { re: /data:/gi,       name: 'data: URI' },
    { re: /vbscript:/gi,   name: 'vbscript: URI' },
    { re: /on\w+\s*=/gi,   name: 'Inline event handler' },
  ];
  scriptPatterns.forEach(({ re, name }) => {
    if (re.test(raw)) { blocked = true; threats.push({ layer: 3, type: 'blocked', label: 'Script pattern blocked', detail: name }); }
  });

  const sqlPatterns = [
    { re: /\bSELECT\b/i, name: 'SELECT' }, { re: /\bDROP\b/i, name: 'DROP' },
    { re: /\bINSERT\b/i, name: 'INSERT' }, { re: /\bDELETE\b/i, name: 'DELETE' },
    { re: /\bUNION\b/i,  name: 'UNION'  }, { re: /--/, name: 'SQL comment' },
  ];
  sqlPatterns.forEach(({ re, name }) => {
    if (re.test(raw)) { blocked = true; threats.push({ layer: 4, type: 'blocked', label: 'SQL injection blocked', detail: name }); }
  });

  return { value: blocked ? '' : val, threats, blocked };
}

function ThreatBadge({ result }) {
  if (!result || result.threats.length === 0) return null;
  const isBlocked = result.blocked;
  return (
    <div style={{ marginTop: 5, padding: '8px 12px', background: isBlocked ? '#fff1f2' : '#fffbeb', border: `1px solid ${isBlocked ? '#ffe4e6' : '#fcd34d'}`, borderLeft: `3px solid ${isBlocked ? '#e11d48' : '#d97706'}`, borderRadius: 6, fontSize: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ padding: '1px 6px', background: isBlocked ? '#e11d48' : '#d97706', color: 'white', borderRadius: 3, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em' }}>
          {isBlocked ? 'BLOCKED' : 'SANITIZED'}
        </span>
        <span style={{ color: '#78746c' }}>{result.threats.length} issue{result.threats.length !== 1 ? 's' : ''} detected</span>
      </div>
      {result.threats.map((t, i) => (
        <div key={i} style={{ color: '#57534e', paddingTop: i > 0 ? 3 : 0 }}>
          <span style={{ fontWeight: 600, color: isBlocked ? '#e11d48' : '#d97706' }}>L{t.layer}</span> · {t.label} — <span style={{ fontFamily: 'monospace' }}>{t.detail}</span>
        </div>
      ))}
      <div style={{ marginTop: 5, fontSize: 10, color: isBlocked ? '#e11d48' : '#b45309', fontStyle: 'italic' }}>
        {isBlocked ? 'Input rejected. Remove flagged patterns to continue.' : 'Special characters were safely encoded.'}
      </div>
    </div>
  );
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Other'];

const CAT_META = {
  Food:          { icon: '🛒', bg: '#fef3c7', text: '#92400e', bar: '#f59e0b' },
  Transport:     { icon: '🚗', bg: '#dbeafe', text: '#1e40af', bar: '#3b82f6' },
  Shopping:      { icon: '🛍️', bg: '#fce7f3', text: '#9d174d', bar: '#ec4899' },
  Bills:         { icon: '📋', bg: '#f3f4f6', text: '#374151', bar: '#6b7280' },
  Entertainment: { icon: '🎬', bg: '#ede9fe', text: '#5b21b6', bar: '#8b5cf6' },
  Other:         { icon: '📦', bg: '#f0fdf4', text: '#166534', bar: '#22c55e' },
};

const inputStyle = {
  width: '100%', padding: '10px 14px', background: '#fafaf9',
  border: '1px solid #e7e5e0', borderRadius: 8, fontSize: 14,
  fontFamily: "'DM Sans',sans-serif", color: '#1c1917', outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s', WebkitAppearance: 'none',
};
const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600, color: '#78746c',
  marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase',
};
const focusIn  = e => { e.target.style.borderColor = '#818cf8'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; };
const focusOut = e => { e.target.style.borderColor = '#e7e5e0'; e.target.style.boxShadow = 'none'; };

// ─── EXPENSE FORM ─────────────────────────────────────────────────────────────
function ExpenseForm({ editingExpense, onSave, onCancel, symbol }) {
  const [title,    setTitle]    = useState(editingExpense?.title    || '');
  const [amount,   setAmount]   = useState(editingExpense?.amount?.toString() || '');
  const [category, setCategory] = useState(editingExpense?.category || 'Food');
  const [date,     setDate]     = useState(editingExpense?.date     || new Date().toISOString().split('T')[0]);
  const [notes,    setNotes]    = useState(editingExpense?.notes    || '');
  const [titleResult, setTitleResult] = useState(null);
  const [notesResult, setNotesResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const tr = sanitizeInput(title);
    const nr = sanitizeInput(notes);
    if (tr.blocked) { setTitleResult(tr); return; }
    if (nr.blocked) { setNotesResult(nr); return; }
    const num = parseFloat(amount);
    if (!tr.value.trim()) return;
    if (isNaN(num) || num <= 0) { alert('Amount must be a positive number'); return; }
    if (num > 10_000_000) { alert('Amount cannot exceed 10,000,000'); return; }
    if (!CATEGORIES.includes(category)) return;

    setSaving(true);
    await onSave({ title: tr.value, amount: num, category, date, notes: nr.value });
    setSaving(false);
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e7e5e0', borderRadius: 14, padding: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', animation: 'slideDown 0.2s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em' }}>
          {editingExpense ? '✏️ Edit expense' : '+ New expense'}
        </h3>
        <button onClick={onCancel} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #e7e5e0', background: '#fafaf9', cursor: 'pointer', fontSize: 14, color: '#78746c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Row 1: Title */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>What did you spend on? *</label>
          <input
            type="text" placeholder="e.g. Groceries at Shoprite" value={title} maxLength={100} required
            onChange={e => { setTitle(e.target.value); const r = sanitizeInput(e.target.value); setTitleResult(r.threats.length ? r : null); }}
            style={{ ...inputStyle, borderColor: titleResult?.blocked ? '#e11d48' : '#e7e5e0' }}
            onFocus={focusIn} onBlur={focusOut}
          />
          <ThreatBadge result={titleResult} />
        </div>

        {/* Row 2: Amount + Category */}
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
            <label style={labelStyle}>Category *</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              style={{ ...inputStyle, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2378746c' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 32, cursor: 'pointer' }}
              onFocus={focusIn} onBlur={focusOut}
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{CAT_META[cat].icon} {cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Date */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Date *</label>
          <input type="date" value={date} max={today} required onChange={e => setDate(e.target.value)} style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
        </div>

        {/* Row 4: Notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Notes <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
          <textarea
            placeholder="Any additional details…" value={notes} maxLength={500} rows={2}
            onChange={e => { setNotes(e.target.value); const r = sanitizeInput(e.target.value); setNotesResult(r.threats.length ? r : null); }}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, borderColor: notesResult?.blocked ? '#e11d48' : '#e7e5e0' }}
            onFocus={focusIn} onBlur={focusOut}
          />
          <ThreatBadge result={notesResult} />
        </div>

        {/* Category preview */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: CAT_META[category].bg, borderRadius: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 18 }}>{CAT_META[category].icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: CAT_META[category].text }}>
            {category}
          </span>
          {amount && !isNaN(parseFloat(amount)) && (
            <span style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 700, color: CAT_META[category].text, fontFamily: "'DM Mono',monospace" }}>
              {symbol}{parseFloat(amount).toLocaleString('en', { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" disabled={saving || titleResult?.blocked || notesResult?.blocked}
            style={{ flex: 1, padding: '11px 0', background: saving || titleResult?.blocked || notesResult?.blocked ? '#e7e5e0' : '#4f46e5', color: saving || titleResult?.blocked || notesResult?.blocked ? '#a8a49d' : 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving || titleResult?.blocked || notesResult?.blocked ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s' }}>
            {saving && <span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />}
            {saving ? 'Saving…' : editingExpense ? 'Update expense' : 'Save expense'}
          </button>
          <button type="button" onClick={onCancel} style={{ padding: '11px 18px', background: 'transparent', border: '1px solid #e7e5e0', color: '#78746c', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── EXPENSE ROW ──────────────────────────────────────────────────────────────
function ExpenseRow({ expense, onEdit, onDelete, fmt }) {
  const [deleting, setDeleting] = useState(false);
  const meta = CAT_META[expense.category] || CAT_META.Other;

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${expense.title}"?`)) return;
    setDeleting(true);
    await onDelete(expense.id);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', background: '#fff', border: '1px solid #eeede9', borderRadius: 10, transition: 'all 0.15s', opacity: deleting ? 0.4 : 1 }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#d4d2cd'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateX(2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#eeede9'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateX(0)'; }}
    >
      {/* Icon */}
      <div style={{ width: 38, height: 38, borderRadius: 10, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
        {meta.icon}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#1c1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{expense.title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 99, background: meta.bg, color: meta.text }}>{expense.category}</span>
          <span style={{ fontSize: 11, color: '#a8a49d' }}>{expense.date}</span>
          {expense.notes && <span style={{ fontSize: 11, color: '#a8a49d', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>"{expense.notes}"</span>}
        </div>
      </div>

      {/* Amount */}
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 600, color: '#1c1917', flexShrink: 0, marginRight: 8 }}>
        {fmt(expense.amount)}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button onClick={() => onEdit(expense)} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid #e7e5e0', color: '#78746c', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f4'; e.currentTarget.style.borderColor = '#d4d2cd'; e.currentTarget.style.color = '#1c1917'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#e7e5e0'; e.currentTarget.style.color = '#78746c'; }}
        >Edit</button>
        <button onClick={handleDelete} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid transparent', color: '#a8a49d', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.borderColor = '#ffe4e6'; e.currentTarget.style.color = '#e11d48'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = '#a8a49d'; }}
        >Delete</button>
      </div>
    </div>
  );
}

// ─── EXPENSES PAGE ────────────────────────────────────────────────────────────
function Expenses() {
  const { fmt, symbol } = useCurrency();

  const [expenses,        setExpenses]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [showForm,        setShowForm]        = useState(false);
  const [editingExpense,  setEditingExpense]  = useState(null);
  const [searchText,      setSearchText]      = useState('');
  const [filterCategory,  setFilterCategory]  = useState('All');
  const [filterMonth,     setFilterMonth]     = useState('All');
  const [sortBy,          setSortBy]          = useState('date-desc');
  const formRef = useRef(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, 'expenses'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const handleSave = async (data) => {
    const user = auth.currentUser;
    try {
      if (editingExpense) {
        await updateDoc(doc(db, 'expenses', editingExpense.id), data);
      } else {
        await addDoc(collection(db, 'expenses'), { ...data, userId: user.uid, createdAt: new Date() });
      }
      setShowForm(false);
      setEditingExpense(null);
    } catch {
      alert('Error saving expense. Please try again.');
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'expenses', id));
    } catch {
      alert('Error deleting expense. Please try again.');
    }
  };

  const handleAddNew = () => {
    setEditingExpense(null);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  // ── Filtering + sorting ──
  const getAvailableMonths = () => {
    const months = expenses.map(e => {
      const d = new Date(e.date);
      return d.toLocaleString('en-US', { year: 'numeric', month: 'short' });
    });
    return [...new Set(months)].sort((a, b) => new Date(b) - new Date(a));
  };

  const filtered = expenses
    .filter(e => {
      const matchSearch   = e.title.toLowerCase().includes(searchText.toLowerCase()) || (e.notes || '').toLowerCase().includes(searchText.toLowerCase());
      const matchCategory = filterCategory === 'All' || e.category === filterCategory;
      let matchMonth = true;
      if (filterMonth !== 'All') {
        const em = new Date(e.date).toLocaleString('en-US', { year: 'numeric', month: 'short' });
        matchMonth = em === filterMonth;
      }
      return matchSearch && matchCategory && matchMonth;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':   return new Date(b.date) - new Date(a.date);
        case 'date-asc':    return new Date(a.date) - new Date(b.date);
        case 'amount-desc': return b.amount - a.amount;
        case 'amount-asc':  return a.amount - b.amount;
        case 'title-asc':   return a.title.localeCompare(b.title);
        default:            return 0;
      }
    });

  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0);
  const thisMonthTotal = expenses
    .filter(e => {
      const d = new Date(e.date), n = new Date();
      return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
    })
    .reduce((s, e) => s + e.amount, 0);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#a8a49d', fontSize: 14, gap: 10, fontFamily: "'DM Sans',sans-serif" }}>
        <span style={{ width: 16, height: 16, border: '2px solid #e7e5e0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
        Loading expenses…
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '36px 28px', fontFamily: "'DM Sans',-apple-system,sans-serif", animation: 'pageIn 0.25s ease' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.04em', color: '#1c1917', marginBottom: 4 }}>Expenses</h2>
          <p style={{ fontSize: 14, color: '#78746c' }}>
            {expenses.length} transaction{expenses.length !== 1 ? 's' : ''} · {fmt(thisMonthTotal)} this month
          </p>
        </div>
        <button onClick={handleAddNew}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 3px rgba(99,102,241,0.4)', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#4338ca'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(99,102,241,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#4f46e5'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(99,102,241,0.4)'; }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add expense
        </button>
      </div>

      {/* ── Form ── */}
      {showForm && (
        <div ref={formRef} style={{ marginBottom: 24 }}>
          <ExpenseForm
            editingExpense={editingExpense}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingExpense(null); }}
            symbol={symbol}
          />
        </div>
      )}

      {/* ── Quick stats row ── */}
      {expenses.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total all time', value: fmt(expenses.reduce((s,e) => s+e.amount, 0)) },
            { label: 'This month',     value: fmt(thisMonthTotal) },
            { label: 'Avg transaction',value: fmt(expenses.length ? expenses.reduce((s,e) => s+e.amount,0)/expenses.length : 0) },
            { label: 'Total entries',  value: expenses.length.toString() },
          ].map((s, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #eeede9', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#a8a49d', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#1c1917', fontFamily: "'DM Mono',monospace", letterSpacing: '-0.03em' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      {expenses.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, padding: '14px 16px', background: '#fff', border: '1px solid #eeede9', borderRadius: 10 }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#a8a49d' }}>🔍</span>
            <input
              type="text" placeholder="Search expenses…" value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 34, fontSize: 13 }}
              onFocus={focusIn} onBlur={focusOut}
            />
          </div>

          {/* Category filter */}
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            style={{ ...inputStyle, width: 'auto', minWidth: 140, fontSize: 13, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2378746c' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28, cursor: 'pointer' }}
            onFocus={focusIn} onBlur={focusOut}
          >
            <option value="All">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{CAT_META[c].icon} {c}</option>)}
          </select>

          {/* Month filter */}
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            style={{ ...inputStyle, width: 'auto', minWidth: 130, fontSize: 13, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2378746c' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28, cursor: 'pointer' }}
            onFocus={focusIn} onBlur={focusOut}
          >
            <option value="All">All months</option>
            {getAvailableMonths().map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          {/* Sort */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ ...inputStyle, width: 'auto', minWidth: 140, fontSize: 13, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2378746c' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28, cursor: 'pointer' }}
            onFocus={focusIn} onBlur={focusOut}
          >
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="amount-desc">Highest amount</option>
            <option value="amount-asc">Lowest amount</option>
            <option value="title-asc">A → Z</option>
          </select>

          {/* Clear filters */}
          {(searchText || filterCategory !== 'All' || filterMonth !== 'All') && (
            <button onClick={() => { setSearchText(''); setFilterCategory('All'); setFilterMonth('All'); }}
              style={{ padding: '0 14px', background: '#fff1f2', border: '1px solid #ffe4e6', color: '#e11d48', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              ✕ Clear
            </button>
          )}
        </div>
      )}

      {/* ── Results summary ── */}
      {expenses.length > 0 && (searchText || filterCategory !== 'All' || filterMonth !== 'All') && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '8px 4px' }}>
          <span style={{ fontSize: 13, color: '#78746c' }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1c1917', fontFamily: "'DM Mono',monospace" }}>
            Total: {fmt(filteredTotal)}
          </span>
        </div>
      )}

      {/* ── List ── */}
      {expenses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: '#fff', border: '1px dashed #e7e5e0', borderRadius: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>💸</div>
          <h3 style={{ fontSize: 17, fontWeight: 600, color: '#1c1917', marginBottom: 8 }}>No expenses yet</h3>
          <p style={{ fontSize: 13, color: '#a8a49d', maxWidth: 260, margin: '0 auto 20px' }}>Hit the button above to log your first transaction.</p>
          <button onClick={handleAddNew} style={{ padding: '10px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Add first expense
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: '#fff', border: '1px dashed #e7e5e0', borderRadius: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1c1917', marginBottom: 6 }}>No results</h3>
          <p style={{ fontSize: 13, color: '#a8a49d' }}>Try adjusting your filters or search term.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(exp => (
            <ExpenseRow key={exp.id} expense={exp} onEdit={handleEdit} onDelete={handleDelete} fmt={fmt} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes pageIn   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideDown{ from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin     { to{transform:rotate(360deg)} }
        @media (max-width: 600px) {
          .expense-actions { flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
}

export default Expenses;