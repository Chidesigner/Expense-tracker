import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc, query, where } from 'firebase/firestore';

function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterMonth, setFilterMonth] = useState('All');

  const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Other'];

  useEffect(() => {
    loadExpenses();
  }, []);

  const sanitizeInput = (text) => {
    let cleaned = text.replace(/<[^>]*>/g, '');
    const sqlPatterns = /(\bSELECT\b|\bINSERT\b|\bDELETE\b|\bDROP\b|\bUPDATE\b|\bUNION\b)/gi;
    cleaned = cleaned.replace(sqlPatterns, '');
    cleaned = cleaned
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
    return cleaned.trim();
  };

  const loadExpenses = async () => {
    try {
      const user = auth.currentUser;
      const q = query(collection(db, 'expenses'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setExpenses(data);
    } catch (error) {
      alert('Error loading expenses. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cleanTitle = sanitizeInput(title);
    const cleanNotes = sanitizeInput(notes);
    const numAmount = parseFloat(amount);

    if (!cleanTitle || !amount || !date) {
      alert('Please fill all required fields');
      return;
    }

    if (numAmount <= 0) {
      alert('Amount must be greater than zero');
      return;
    }

    const expenseData = {
      title: cleanTitle,
      amount: numAmount,
      category: category,
      date: date,
      notes: cleanNotes
    };

    try {
      const user = auth.currentUser;
      if (editingId) {
        await updateDoc(doc(db, 'expenses', editingId), expenseData);
      } else {
        await addDoc(collection(db, 'expenses'), {
          ...expenseData,
          userId: user.uid,
          createdAt: new Date()
        });
      }

      setTitle('');
      setAmount('');
      setCategory('Food');
      setDate('');
      setNotes('');
      setEditingId(null);
      setShowForm(false);
      loadExpenses();
    } catch (error) {
      alert('Error saving expense. Please try again.');
    }
  };

  const startEdit = (expense) => {
    setTitle(expense.title);
    setAmount(expense.amount.toString());
    setCategory(expense.category);
    setDate(expense.date);
    setNotes(expense.notes || '');
    setEditingId(expense.id);
    setShowForm(true);
  };

  const cancelEdit = () => {
    setTitle('');
    setAmount('');
    setCategory('Food');
    setDate('');
    setNotes('');
    setEditingId(null);
    setShowForm(false);
  };

  const deleteExpense = async (id) => {
    if (window.confirm('Delete this expense?')) {
      try {
        await deleteDoc(doc(db, 'expenses', id));
        loadExpenses();
      } catch (error) {
        alert('Error deleting expense. Please try again.');
      }
    }
  };

  const getAvailableMonths = () => {
    const months = expenses.map(exp => {
      const date = new Date(exp.date);
      return date.toLocaleString('en-US', { year: 'numeric', month: 'short' });
    });
    return [...new Set(months)].sort().reverse();
  };

  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = exp.title.toLowerCase().includes(searchText.toLowerCase());
    const matchesCategory = filterCategory === 'All' || exp.category === filterCategory;
    
    let matchesMonth = true;
    if (filterMonth !== 'All') {
      const expDate = new Date(exp.date);
      const expMonthYear = expDate.toLocaleString('en-US', { year: 'numeric', month: 'short' });
      matchesMonth = expMonthYear === filterMonth;
    }
    
    return matchesSearch && matchesCategory && matchesMonth;
  });

  return (
    <div className="page">
      <div className="page-header">
        <h2>Expenses</h2>
        <button onClick={() => setShowForm(!showForm)} className="add-btn">
          {showForm ? 'Cancel' : '+ Add Expense'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="expense-form">
          <h3>{editingId ? 'Edit Expense' : 'Add New Expense'}</h3>
          
          <input
            type="text"
            placeholder="What did you spend on?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            required
          />
          
          <input
            type="number"
            step="0.01"
            placeholder="How much?"
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

          <textarea
            placeholder="Add a note (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            rows={3}
          />

          <div className="form-buttons">
            <button type="submit">
              {editingId ? 'Update' : 'Save'} Expense
            </button>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="cancel-btn">
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
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select 
              className="filter-select"
              value={filterMonth} 
              onChange={(e) => setFilterMonth(e.target.value)}
            >
              <option value="All">All Months</option>
              {getAvailableMonths().map(month => (
                <option key={month} value={month}>{month}</option>
              ))}
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
                <button onClick={() => startEdit(exp)} className="edit-btn">
                  Edit
                </button>
                <button onClick={() => deleteExpense(exp.id)} className="delete-btn">
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Expenses;