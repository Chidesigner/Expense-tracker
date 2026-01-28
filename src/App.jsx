import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import Login from './Login';

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
  const [editingId, setEditingId] = useState(null); // Track which expense we're editing

  const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Other'];

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
    const q = query(collection(db, 'expenses'), where('userId', '==', user.uid));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setExpenses(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title || !amount || !date) {
      alert('Please fill all fields');
      return;
    }

    const expenseData = {
      title,
      amount: parseFloat(amount),
      category,
      date
    };

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
    setEditingId(null);
    setShowForm(false);
    
    loadExpenses();
  };

  const startEdit = (expense) => {
    setTitle(expense.title);
    setAmount(expense.amount.toString());
    setCategory(expense.category);
    setDate(expense.date);
    setEditingId(expense.id);
    setShowForm(true);
  };

  const cancelEdit = () => {
    setTitle('');
    setAmount('');
    setCategory('Food');
    setDate('');
    setEditingId(null);
    setShowForm(false);
  };

  const deleteExpense = async (id) => {
    if (window.confirm('Delete this expense?')) {
      await deleteDoc(doc(db, 'expenses', id));
      loadExpenses();
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setExpenses([]);
  };

  // Calculate total
  const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);

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
          <h1>Expense Tracker</h1>
          <p>Track your spending smartly</p>
        </div>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
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

        <button onClick={() => setShowForm(!showForm)} className="add-btn">
          {showForm ? 'Cancel' : '+ Add Expense'}
        </button>

        {showForm && (
          <form onSubmit={handleSubmit} className="expense-form">
            <h3>{editingId ? 'Edit Expense' : 'Add New Expense'}</h3>
            <input
              type="text"
              placeholder="So what did you spend on?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              type="number"
              placeholder="How much again?"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <div className="form-buttons">
              <button type="submit">{editingId ? 'Update' : 'Save'} Expense</button>
              {editingId && (
                <button type="button" onClick={cancelEdit} className="cancel-btn">
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        )}

        <div className="expenses-list">
          <h2>All Expenses</h2>
          {expenses.length === 0 ? (
            <p className="empty">No expenses yet. Add one to get started!</p>
          ) : (
            expenses.map(exp => (
              <div key={exp.id} className="expense-item">
                <div className="expense-info">
                  <h4>{exp.title}</h4>
                  <span className="category">{exp.category}</span>
                  <p className="date">{exp.date}</p>
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