import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import {
  collection, addDoc, getDocs, deleteDoc,
  updateDoc, doc, query, where
} from 'firebase/firestore';

function sanitizeInput(raw) {
  if (!raw || typeof raw !== 'string') return { value: '', threats: [], blocked: false };

  const threats = [];
  let val     = raw;
  let blocked = false;

  const tagMatches = val.match(/<[^>]*>/g) || [];
  tagMatches.forEach(tag => {
    threats.push({ layer: 1, type: 'sanitized', label: 'HTML Tag Stripped', detail: `Removed: ${tag}` });
  });
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
    if (count > 0) {
      anyEncoded = true;
      threats.push({ layer: 2, type: 'sanitized', label: 'Character Encoded', detail: `${name} → ${entity} (×${count})` });
    }
  });
  if (anyEncoded) {
    val = val
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/\//g, '&#x2F;');
  }
  const scriptPatterns = [
    { re: /javascript:/gi, name: 'javascript: URI' },
    { re: /data:/gi,       name: 'data: URI' },
    { re: /vbscript:/gi,   name: 'vbscript: URI' },
    { re: /on\w+\s*=/gi,   name: 'Inline event handler' },
  ];
  scriptPatterns.forEach(({ re, name }) => {
    if (re.test(raw)) {
      blocked = true;
      threats.push({ layer: 3, type: 'blocked', label: 'Script Pattern Blocked', detail: `${name} — OWASP A03 XSS` });
    }
  });

  const sqlPatterns = [
    { re: /\bSELECT\b/i, name: 'SELECT' },
    { re: /\bDROP\b/i,   name: 'DROP' },
    { re: /\bINSERT\b/i, name: 'INSERT' },
    { re: /\bDELETE\b/i, name: 'DELETE' },
    { re: /\bUNION\b/i,  name: 'UNION' },
    { re: /--/,          name: 'SQL comment (--)' },
  ];
  sqlPatterns.forEach(({ re, name }) => {
    if (re.test(raw)) {
      blocked = true;
      threats.push({ layer: 4, type: 'blocked', label: 'SQL Injection Blocked', detail: `Keyword: ${name} — OWASP A03` });
    }
  });

  return { value: blocked ? '' : val, threats, blocked };
}

function ThreatWarning({ result }) {
  if (!result || result.threats.length === 0) return null;

  const isBlocked = result.blocked;
  const accentColor = isBlocked ? '#e63946' : '#d97706';
  const bgColor     = isBlocked ? '#fff5f5' : '#fffbeb';
  const borderColor = isBlocked ? '#ffc8cb' : '#fcd34d';

  return (
    <div style={{
      marginTop: 5,
      padding: '9px 11px',
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderLeft: `3px solid ${accentColor}`,
      borderRadius: 4,
      fontSize: '0.72rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{
          fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', padding: '1px 6px',
          background: accentColor, color: 'white', borderRadius: 2,
        }}>
          {isBlocked ? '↯ blocked' : '⟳ sanitized'}
        </span>
        <span style={{ color: '#666', fontSize: '0.68rem' }}>
          {result.threats.length} issue{result.threats.length !== 1 ? 's' : ''} detected
        </span>
      </div>

      {result.threats.map((t, i) => (
        <div key={i} style={{
          display: 'flex', gap: 7, alignItems: 'flex-start',
          paddingTop: i > 0 ? 4 : 0,
          borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none',
        }}>
          <span style={{
            fontFamily: 'monospace', fontSize: '0.58rem',
            padding: '1px 4px',
            background: t.type === 'blocked' ? '#e63946' : '#d97706',
            color: 'white', borderRadius: 2, flexShrink: 0, marginTop: 1,
          }}>
            L{t.layer}
          </span>
          <div style={{ color: '#555', lineHeight: 1.4 }}>
            <span style={{ fontWeight: 600, color: isBlocked ? '#e63946' : '#b45309', marginRight: 5 }}>
              {t.label}.
            </span>
            {t.detail}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 7, fontSize: '0.67rem', color: isBlocked ? '#e63946' : '#b45309', fontStyle: 'italic' }}>
        {isBlocked
          ? 'This input was rejected. Please remove the flagged patterns.'
          : 'Special characters were encoded before saving. Your data is stored safely.'}
      </div>
    </div>
  );
}

function Expenses() {
  const [expenses, setExpenses]           = useState([]);
  const [showForm, setShowForm]           = useState(false);
  const [title, setTitle]                 = useState('');
  const [amount, setAmount]               = useState('');
  const [category, setCategory]           = useState('Food');
  const [date, setDate]                   = useState('');
  const [notes, setNotes]                 = useState('');
  const [editingId, setEditingId]         = useState(null);
  const [searchText, setSearchText]       = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterMonth, setFilterMonth]     = useState('All');

  const [titleSanitized, setTitleSanitized] = useState(null);
  const [notesSanitized, setNotesSanitized] = useState(null);

  const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Other'];

  useEffect(() => { loadExpenses(); }, []);

  const loadExpenses = async () => {
    try {
      const user = auth.currentUser;
      const q    = query(collection(db, 'expenses'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      alert('Error loading expenses. Please try again.');
    }
  };

  const handleTitleChange = (e) => {
    const raw    = e.target.value;
    const result = sanitizeInput(raw);
    setTitle(raw);
    setTitleSanitized(result.threats.length > 0 ? result : null);
  };

  const handleNotesChange = (e) => {
    const raw    = e.target.value;
    const result = sanitizeInput(raw);
    setNotes(raw);
    setNotesSanitized(result.threats.length > 0 ? result : null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const titleResult = sanitizeInput(title);
    const notesResult = sanitizeInput(notes);

    if (titleResult.blocked) {
      alert('Title contains disallowed content. Please remove the flagged input.');
      return;
    }
    if (notesResult.blocked) {
      alert('Notes contain disallowed content. Please remove the flagged input.');
      return;
    }

    const cleanTitle = titleResult.value;
    const cleanNotes = notesResult.value;
    const numAmount  = parseFloat(amount);

    if (!cleanTitle || !amount || !date) {
      alert('Please fill all required fields');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Amount must be a positive number');
      return;
    }
    if (numAmount > 10000000) {
      alert('Amount cannot exceed ₦10,000,000');
      return;
    }

    if (!categories.includes(category)) {
      alert('Invalid category selected');
      return;
    }

    const expenseData = {
      title: cleanTitle,
      amount: numAmount,
      category,
      date,
      notes: cleanNotes,
    };

    try {
      const user = auth.currentUser;
      if (editingId) {
        await updateDoc(doc(db, 'expenses', editingId), expenseData);
      } else {
        await addDoc(collection(db, 'expenses'), {
          ...expenseData,
          userId: user.uid,
          createdAt: new Date(),
        });
      }
      resetForm();
      loadExpenses();
    } catch {
      alert('Error saving expense. Please try again.');
    }
  };

  const resetForm = () => {
    setTitle(''); setAmount(''); setCategory('Food');
    setDate(''); setNotes(''); setEditingId(null);
    setShowForm(false); setTitleSanitized(null); setNotesSanitized(null);
  };

  const startEdit = (expense) => {
    setTitle(expense.title);
    setAmount(expense.amount.toString());
    setCategory(expense.category);
    setDate(expense.date);
    setNotes(expense.notes || '');
    setEditingId(expense.id);
    setShowForm(true);
    setTitleSanitized(null);
    setNotesSanitized(null);
  };

  const deleteExpense = async (id) => {
    if (window.confirm('Delete this expense?')) {
      try {
        await deleteDoc(doc(db, 'expenses', id));
        loadExpenses();
      } catch {
        alert('Error deleting expense. Please try again.');
      }
    }
  };

  const getAvailableMonths = () => {
    const months = expenses.map(exp => {
      const d = new Date(exp.date);
      return d.toLocaleString('en-US', { year: 'numeric', month: 'short' });
    });
    return [...new Set(months)].sort().reverse();
  };

  const filteredExpenses = expenses.filter(exp => {
    const matchSearch   = exp.title.toLowerCase().includes(searchText.toLowerCase());
    const matchCategory = filterCategory === 'All' || exp.category === filterCategory;
    let   matchMonth    = true;
    if (filterMonth !== 'All') {
      const expMonthYear = new Date(exp.date).toLocaleString('en-US', { year: 'numeric', month: 'short' });
      matchMonth = expMonthYear === filterMonth;
    }
    return matchSearch && matchCategory && matchMonth;
  });

  return (
    <div className="page">
      <div className="page-header">
        <h2>Expenses</h2>
        <button onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }} className="add-btn">
          {showForm ? 'Cancel' : '+ Add Expense'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="expense-form">
          <h3>{editingId ? 'Edit Expense' : 'Add New Expense'}</h3>

          <div>
            <input
              type="text"
              placeholder="What did you spend on?"
              value={title}
              onChange={handleTitleChange}
              maxLength={100}
              required
              style={titleSanitized?.blocked ? { borderColor: '#e63946' } : {}}
            />
            <ThreatWarning result={titleSanitized} />
          </div>

          <input
            type="number"
            step="0.01"
            min="0.01"
            max="10000000"
            placeholder="How much? (₦)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            required
          />

          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <div>
            <textarea
              placeholder="Add a note (optional)"
              value={notes}
              onChange={handleNotesChange}
              maxLength={500}
              rows={3}
              style={notesSanitized?.blocked ? { borderColor: '#e63946' } : {}}
            />
            <ThreatWarning result={notesSanitized} />
          </div>

          <div className="form-buttons">
            <button type="submit" disabled={titleSanitized?.blocked || notesSanitized?.blocked}>
              {editingId ? 'Update' : 'Save'} Expense
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="cancel-btn">
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      <div className="expenses-list">
        {expenses.length > 0 && (
          <div className="search-filter">
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Search expenses..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <select
              className="filter-select"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="All">All Categories</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <select
              className="filter-select"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            >
              <option value="All">All Months</option>
              {getAvailableMonths().map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}

        {expenses.length === 0 ? (
          <p className="empty">No expenses yet. Add one to get started!</p>
        ) : filteredExpenses.length === 0 ? (
          <p className="empty">No expenses match your filters.</p>
        ) : (
          filteredExpenses.map(exp => (
            <div key={exp.id} className="expense-item">
              <div className="expense-info">
                <h4>{exp.title}</h4>
                <span className={`category category-${exp.category.toLowerCase()}`}>
                  {exp.category}
                </span>
                <p className="date">{exp.date}</p>
                {exp.notes && <p className="notes">{exp.notes}</p>}
              </div>
              <div className="expense-actions">
                <p className="expense-amount">₦{exp.amount.toFixed(2)}</p>
                <button onClick={() => startEdit(exp)} className="edit-btn">Edit</button>
                <button onClick={() => deleteExpense(exp.id)} className="delete-btn">Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Expenses;