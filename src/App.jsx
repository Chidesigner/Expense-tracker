import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import Login from './Login';
import SpendingChart from './SpendingChart';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState(null);

  // Search and filter states
  const [searchText, setSearchText] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Other'];

  // Remove dangerous HTML tags from user input
  const cleanInput = (text) => {
    return text.replace(/<[^>]*>/g, '').trim();
  };

  // Check if user is logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Load expenses when user logs in
  useEffect(() => {
    if (user) {
      loadExpenses();
    }
  }, [user]);

  const loadExpenses = async () => {
    try {
      // Get only this user's expenses
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

    // Clean inputs to prevent XSS
    const cleanTitle = cleanInput(title);
    const cleanNotes = cleanInput(notes);
    const numAmount = parseFloat(amount);

    // Basic validation
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
      if (editingId) {
        // Update existing expense
        await updateDoc(doc(db, 'expenses', editingId), expenseData);
      } else {
        // Add new expense
        await addDoc(collection(db, 'expenses'), {
          ...expenseData,
          userId: user.uid,
          createdAt: new Date()
        });
      }

      // Reset form
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

  const handleLogout = () => {
    signOut(auth);
    setExpenses([]);
  };

  // Calculate total
  const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  // Filter expenses based on search and category
  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = exp.title.toLowerCase().includes(searchText.toLowerCase());
    const matchesCategory = filterCategory === 'All' || exp.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app">
      <header>
        <div>
          <h1>Fintrax</h1>
          <p>Secure. Simple. Smart.</p>
        </div>
        <div className="header-actions">
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </header>

      <div className="container">
        <div className="summary">
          <div className="summary-card">
            <h3>Total Spent</h3>
            <p className="amount">₦{total.toFixed(2)}</p>
          </div>
          <div className="summary-card">
            <h3>Transactions</h3>
            <p className="amount">{expenses.length}</p>
          </div>
        </div>

        {/* Add the chart here */}
        <SpendingChart expenses={expenses} />

        <button onClick={() => setShowForm(!showForm)} className="add-btn">
          {showForm ? 'Cancel' : '+ Add Expense'}
        </button>

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
          <h2>All Expenses</h2>
          
          {/* Search and Filter Controls */}
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
            </div>
          )}

          {expenses.length === 0 ? (
            <p className="empty">No expenses yet. Add one to get started!</p>
          ) : filteredExpenses.length === 0 ? (
            <p className="empty">No expenses match your search.</p>
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
    </div>
  );
}

export default App;