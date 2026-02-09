import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import Login from './Login';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState(null);

  const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Other'];

  // Input validation function to prevent XSS attacks
  const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    // Remove HTML tags and potentially malicious scripts
    return input.replace(/<[^>]*>/g, '').trim();
  };

  // Validate amount to prevent SQL injection-like attacks (though Firebase uses NoSQL)
  const validateAmount = (amount) => {
    const numAmount = parseFloat(amount);
    
    // Check if it's a valid number
    if (isNaN(numAmount)) {
      return { valid: false, error: 'Please enter a valid number' };
    }
    
    // Check if it's positive
    if (numAmount <= 0) {
      return { valid: false, error: 'Amount must be greater than zero' };
    }
    
    // Check if it's reasonable (prevent extremely large numbers)
    if (numAmount > 10000000) {
      return { valid: false, error: 'Amount seems too large. Please verify.' };
    }
    
    return { valid: true, value: numAmount };
  };

  // Validate date
  const validateDate = (dateString) => {
    const selectedDate = new Date(dateString);
    const today = new Date();
    const hundredYearsAgo = new Date();
    hundredYearsAgo.setFullYear(today.getFullYear() - 100);
    
    if (selectedDate > today) {
      return { valid: false, error: 'Date cannot be in the future' };
    }
    
    if (selectedDate < hundredYearsAgo) {
      return { valid: false, error: 'Date seems too old. Please verify.' };
    }
    
    return { valid: true };
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
      // Query only expenses that belong to the current user (access control)
      const q = query(collection(db, 'expenses'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setExpenses(data);
    } catch (error) {
      console.error('Error loading expenses:', error);
      alert('Error loading expenses. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Sanitize all text inputs to prevent XSS
    const cleanTitle = sanitizeInput(title);
    const cleanNotes = sanitizeInput(notes);
    
    // Validate required fields
    if (!cleanTitle || !amount || !date) {
      alert('Please fill all required fields');
      return;
    }

    // Validate title length
    if (cleanTitle.length > 100) {
      alert('Title is too long. Please keep it under 100 characters.');
      return;
    }

    // Validate amount
    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      alert(amountValidation.error);
      return;
    }

    // Validate date
    const dateValidation = validateDate(date);
    if (!dateValidation.valid) {
      alert(dateValidation.error);
      return;
    }

    // Validate notes length
    if (cleanNotes.length > 500) {
      alert('Notes are too long. Please keep them under 500 characters.');
      return;
    }

    const expenseData = {
      title: cleanTitle,
      amount: amountValidation.value,
      category: category, // Category is from dropdown, already safe
      date: date,
      notes: cleanNotes
    };

    try {
      if (editingId) {
        // Update existing expense
        // Security: Verify the expense belongs to current user before updating
        const expenseToUpdate = expenses.find(exp => exp.id === editingId);
        if (!expenseToUpdate || expenseToUpdate.userId !== user.uid) {
          alert('Unauthorized: You can only edit your own expenses');
          return;
        }
        await updateDoc(doc(db, 'expenses', editingId), expenseData);
      } else {
        // Add new expense with userId for access control
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
      console.error('Error saving expense:', error);
      alert('Error saving expense. Please try again.');
    }
  };

  const startEdit = (expense) => {
    // Security: Verify ownership before allowing edit
    if (expense.userId !== user.uid) {
      alert('Unauthorized: You can only edit your own expenses');
      return;
    }

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
    // Security: Verify ownership before allowing delete
    const expenseToDelete = expenses.find(exp => exp.id === id);
    if (!expenseToDelete || expenseToDelete.userId !== user.uid) {
      alert('Unauthorized: You can only delete your own expenses');
      return;
    }

    if (window.confirm('Delete this expense?')) {
      try {
        await deleteDoc(doc(db, 'expenses', id));
        loadExpenses();
      } catch (error) {
        console.error('Error deleting expense:', error);
        alert('Error deleting expense. Please try again.');
      }
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setExpenses([]);
  };

  // Handle account deletion
  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setDeleteError('');
    setDeleteLoading(true);

    if (!deletePassword) {
      setDeleteError('Please enter your password to confirm deletion');
      setDeleteLoading(false);
      return;
    }

    try {
      // Re-authenticate user before deletion (security requirement)
      const credential = EmailAuthProvider.credential(
        user.email,
        deletePassword
      );
      await reauthenticateWithCredential(user, credential);

      // Delete all user's expenses from Firestore
      const q = query(collection(db, 'expenses'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // Delete the user account
      await deleteUser(user);
      
      // Account deleted successfully - user will be automatically logged out
      setShowDeleteAccount(false);
    } catch (err) {
      if (err.code === 'auth/wrong-password') {
        setDeleteError('Incorrect password. Please try again.');
      } else if (err.code === 'auth/too-many-requests') {
        setDeleteError('Too many attempts. Please try again later.');
      } else {
        setDeleteError('Error deleting account. Please try again.');
      }
      console.error('Delete account error:', err);
    }

    setDeleteLoading(false);
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
          <h1>Fintrax</h1>
          <p>Track it. Control it.</p>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowDeleteAccount(true)} className="delete-account-btn">
            Delete Account
          </button>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </header>

      {/* Delete Account Modal */}
      {showDeleteAccount && (
        <div className="modal-overlay" onClick={() => {
          setShowDeleteAccount(false);
          setDeletePassword('');
          setDeleteError('');
        }}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <h2>⚠️ Delete Account</h2>
            <p className="warning-text">
              This action <strong>cannot be undone</strong>. All your expenses and data will be permanently deleted.
            </p>
            
            {deleteError && <div className="error">{deleteError}</div>}
            
            <form onSubmit={handleDeleteAccount}>
              <p className="user-email">Logged in as: <strong>{user?.email}</strong></p>
              <input
                type="password"
                placeholder="Enter your password to confirm"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                required
                autoFocus
              />
              <div className="modal-buttons">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowDeleteAccount(false);
                    setDeletePassword('');
                    setDeleteError('');
                  }} 
                  className="cancel-modal-btn"
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="confirm-delete-btn"
                  disabled={deleteLoading}
                >
                  {deleteLoading ? 'Deleting...' : 'Yes, Delete My Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              maxLength={100}
              required
            />
            <input
              type="number"
              step="0.01"
              placeholder="How much again?"
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
                  <span className={`category category-${exp.category.toLowerCase()}`}>{exp.category}</span>
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