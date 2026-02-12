import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import SpendingChart from '../SpendingChart';

function Dashboard() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExpenses();
  }, []);

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
      console.error('Error loading expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  
  const getCurrentMonthSpending = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    return expenses
      .filter(exp => {
        const expDate = new Date(exp.date);
        return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
      })
      .reduce((sum, exp) => sum + exp.amount, 0);
  };

  const thisMonthTotal = getCurrentMonthSpending();

  // Get recent expenses (last 5)
  const recentExpenses = [...expenses]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="page">
      <h2>Dashboard</h2>
      
      <div className="summary">
        <div className="summary-card">
          <h3>Total Spent</h3>
          <p className="amount">₦{total.toFixed(2)}</p>
        </div>
        
        <div className="summary-card">
          <h3>This Month</h3>
          <p className="amount">₦{thisMonthTotal.toFixed(2)}</p>
        </div>
        
        <div className="summary-card">
          <h3>Transactions</h3>
          <p className="amount">{expenses.length}</p>
        </div>
      </div>

      <SpendingChart expenses={expenses} />

      <div className="recent-section">
        <h3>Recent Transactions</h3>
        {recentExpenses.length === 0 ? (
          <p className="empty">No transactions yet</p>
        ) : (
          <div className="recent-list">
            {recentExpenses.map(exp => (
              <div key={exp.id} className="recent-item">
                <div>
                  <h4>{exp.title}</h4>
                  <span className={`category category-${exp.category.toLowerCase()}`}>
                    {exp.category}
                  </span>
                  <p className="date">{exp.date}</p>
                </div>
                <p className="expense-amount">₦{exp.amount.toFixed(2)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;