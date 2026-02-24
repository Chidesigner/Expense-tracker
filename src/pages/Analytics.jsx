import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useCurrency } from '../context/CurrencyContext';

function Analytics() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading]   = useState(true);
  const { fmt, symbol }         = useCurrency();

  useEffect(() => { loadExpenses(); }, []);

  const loadExpenses = async () => {
    try {
      const user = auth.currentUser;
      const q    = query(collection(db, 'expenses'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      setExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMonthlyTrend = () => {
    const monthlyData = {};
    expenses.forEach(exp => {
      const date      = new Date(exp.date);
      const monthYear = date.toLocaleString('en-US', { year: 'numeric', month: 'short' });
      monthlyData[monthYear] = (monthlyData[monthYear] || 0) + exp.amount;
    });
    return Object.keys(monthlyData)
      .sort((a, b) => new Date(a) - new Date(b))
      .map(month => ({ month, amount: parseFloat(monthlyData[month].toFixed(2)) }));
  };

  const getCategoryBreakdown = () => {
    const categoryTotals = {};
    expenses.forEach(exp => {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    });
    return Object.keys(categoryTotals).map(category => ({
      name:  category,
      value: parseFloat(categoryTotals[category].toFixed(2)),
    }));
  };

  const getInsights = () => {
    if (expenses.length === 0) return null;
    const total    = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const average  = total / expenses.length;
    const largest  = [...expenses].sort((a, b) => b.amount - a.amount)[0];
    const catTotals = {};
    expenses.forEach(exp => { catTotals[exp.category] = (catTotals[exp.category] || 0) + exp.amount; });
    const topCategory = Object.keys(catTotals).reduce((a, b) => catTotals[a] > catTotals[b] ? a : b);
    return { total, average, largest, topCategory, topCategoryAmount: catTotals[topCategory] };
  };

  const monthlyTrend     = getMonthlyTrend();
  const categoryBreakdown = getCategoryBreakdown();
  const insights         = getInsights();

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'white', padding: '10px 14px', border: '1px solid #e7e5e0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        {label && <p style={{ fontSize: 12, color: '#78746c', marginBottom: 4 }}>{label}</p>}
        <p style={{ fontSize: 14, fontWeight: 600, color: '#4F46E5', fontFamily: 'DM Mono,monospace' }}>{fmt(payload[0].value)}</p>
      </div>
    );
  };

  const PieTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'white', padding: '10px 14px', border: '1px solid #e7e5e0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#1c1917', marginBottom: 2 }}>{payload[0].name}</p>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#4F46E5', fontFamily: 'DM Mono,monospace' }}>{fmt(payload[0].value)}</p>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#a8a49d', fontSize: 14, gap: 10 }}>
        <span style={{ width: 16, height: 16, border: '2px solid #e7e5e0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
        Loading analytics…
        <style>{`@keyframes spin { to{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="page">
        <h2>Analytics</h2>
        <div style={{ textAlign: 'center', padding: '64px 24px', background: '#fff', border: '1px dashed #e7e5e0', borderRadius: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>📊</div>
          <h3 style={{ fontSize: 17, fontWeight: 600, color: '#1c1917', marginBottom: 8 }}>No data yet</h3>
          <p style={{ fontSize: 13, color: '#a8a49d', maxWidth: 260, margin: '0 auto' }}>Add some expenses to see insights and trends here.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '36px 28px', display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'DM Sans',-apple-system,sans-serif", animation: 'pageIn 0.25s ease' }}>
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.04em', color: '#1c1917', marginBottom: 4 }}>Analytics</h2>
        <p style={{ fontSize: 14, color: '#78746c' }}>Insights across {expenses.length} transaction{expenses.length !== 1 ? 's' : ''}.</p>
      </div>

      {/* ── Insight cards ── */}
      {insights && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {[
            { label: 'Total Spent',       value: insights.total,               icon: '💰', color: '#eef2ff' },
            { label: 'Average Transaction', value: insights.average,            icon: '📊', color: '#fff7ed' },
            { label: 'Largest Expense',   value: insights.largest.amount,      icon: '🏆', color: '#fdf4ff', sub: insights.largest.title },
            { label: 'Top Category',      value: insights.topCategoryAmount,   icon: '📂', color: '#f0fdf4', sub: insights.topCategory },
          ].map((card, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #eeede9', borderRadius: 14, padding: '20px 22px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', position: 'relative', overflow: 'hidden' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{ position: 'absolute', top: -20, right: -20, width: 70, height: 70, borderRadius: '50%', background: card.color, opacity: 0.7 }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#78746c' }}>{card.label}</span>
                <span style={{ fontSize: 18 }}>{card.icon}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, color: '#1c1917', fontFamily: 'DM Mono,monospace', letterSpacing: '-0.03em', marginBottom: card.sub ? 4 : 0 }}>
                {fmt(card.value)}
              </div>
              {card.sub && <div style={{ fontSize: 12, color: '#a8a49d', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ── Monthly Trend ── */}
      <div style={{ background: '#fff', border: '1px solid #eeede9', borderRadius: 14, padding: '22px 24px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1c1917', letterSpacing: '-0.02em', marginBottom: 20 }}>Monthly Spending Trend</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={monthlyTrend} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fill: '#a8a49d', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#a8a49d', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `${symbol}${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="amount" stroke="#4F46E5" strokeWidth={2.5} dot={{ fill: '#4F46E5', r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: '#4F46E5' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Category Distribution ── */}
      <div style={{ background: '#fff', border: '1px solid #eeede9', borderRadius: 14, padding: '22px 24px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1c1917', letterSpacing: '-0.02em', marginBottom: 20 }}>Category Distribution</h3>
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={categoryBreakdown}
              cx="50%" cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={110}
              dataKey="value"
            >
              {categoryBreakdown.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
            <Legend
              formatter={(value) => <span style={{ fontSize: 13, color: '#57534e', fontWeight: 500 }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <style>{`@keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  );
}

export default Analytics;