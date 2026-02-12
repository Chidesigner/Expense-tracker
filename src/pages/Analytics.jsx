import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import SpendingChart from '../SpendingChart';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function Analytics() {
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

  // Monthly spending trend
  const getMonthlyTrend = () => {
    const monthlyData = {};
    
    expenses.forEach(exp => {
      const date = new Date(exp.date);
      const monthYear = date.toLocaleString('en-US', { year: 'numeric', month: 'short' });
      
      if (monthlyData[monthYear]) {
        monthlyData[monthYear] += exp.amount;
      } else {
        monthlyData[monthYear] = exp.amount;
      }
    });

    return Object.keys(monthlyData)
      .sort((a, b) => new Date(a) - new Date(b))
      .map(month => ({
        month,
        amount: parseFloat(monthlyData[month].toFixed(2))
      }));
  };

  // Category breakdown for pie chart
  const getCategoryBreakdown = () => {
    const categoryTotals = {};
    
    expenses.forEach(exp => {
      if (categoryTotals[exp.category]) {
        categoryTotals[exp.category] += exp.amount;
      } else {
        categoryTotals[exp.category] = exp.amount;
      }
    });

    return Object.keys(categoryTotals).map(category => ({
      name: category,
      value: parseFloat(categoryTotals[category].toFixed(2))
    }));
  };

  // Calculate insights
  const getInsights = () => {
    if (expenses.length === 0) return null;

    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const average = total / expenses.length;
    
    const sortedByAmount = [...expenses].sort((a, b) => b.amount - a.amount);
    const largest = sortedByAmount[0];
    
    const categoryTotals = {};
    expenses.forEach(exp => {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    });
    
    const topCategory = Object.keys(categoryTotals).reduce((a, b) => 
      categoryTotals[a] > categoryTotals[b] ? a : b
    );

    return {
      total,
      average,
      largest,
      topCategory,
      topCategoryAmount: categoryTotals[topCategory]
    };
  };

  const monthlyTrend = getMonthlyTrend();
  const categoryBreakdown = getCategoryBreakdown();
  const insights = getInsights();

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (expenses.length === 0) {
    return (
      <div className="page">
        <h2>Analytics</h2>
        <p className="empty">No data to analyze yet. Add some expenses to see insights!</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h2>Analytics</h2>

      {insights && (
        <div className="insights-grid">
          <div className="insight-card">
            <h3>Average Transaction</h3>
            <p className="amount">₦{insights.average.toFixed(2)}</p>
          </div>
          
          <div className="insight-card">
            <h3>Largest Expense</h3>
            <p className="amount">₦{insights.largest.amount.toFixed(2)}</p>
            <p className="insight-detail">{insights.largest.title}</p>
          </div>
          
          <div className="insight-card">
            <h3>Top Category</h3>
            <p className="amount">{insights.topCategory}</p>
            <p className="insight-detail">₦{insights.topCategoryAmount.toFixed(2)}</p>
          </div>
        </div>
      )}

      <SpendingChart expenses={expenses} />

      <div className="chart-container">
        <h3>Monthly Spending Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyTrend} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fill: '#666' }} />
            <YAxis tick={{ fill: '#666' }} tickFormatter={(value) => `₦${value}`} />
            <Tooltip formatter={(value) => `₦${value}`} />
            <Line type="monotone" dataKey="amount" stroke="#4F46E5" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-container">
        <h3>Category Distribution</h3>
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={categoryBreakdown}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {categoryBreakdown.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `₦${value.toFixed(2)}`} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default Analytics;