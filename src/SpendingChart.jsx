import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useCurrency } from './context/CurrencyContext';

const CAT_COLORS = {
  Food:          '#f59e0b',
  Transport:     '#3b82f6',
  Shopping:      '#ec4899',
  Bills:         '#6b7280',
  Entertainment: '#8b5cf6',
  Other:         '#22c55e',
};

function SpendingChart({ expenses }) {
  const { fmt, symbol } = useCurrency();

  if (!expenses || expenses.length === 0) return null;

  const categoryTotals = {};
  expenses.forEach(expense => {
    categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
  });

  const chartData = Object.keys(categoryTotals)
    .map(category => ({
      category,
      amount: parseFloat(categoryTotals[category].toFixed(2)),
    }))
    .sort((a, b) => b.amount - a.amount);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const cat = payload[0].payload.category;
    return (
      <div style={{ background: 'white', padding: '10px 14px', border: '1px solid #e7e5e0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#57534e', marginBottom: 3 }}>{cat}</p>
        <p style={{ fontSize: 15, fontWeight: 700, color: CAT_COLORS[cat] || '#4F46E5', fontFamily: 'DM Mono,monospace' }}>
          {fmt(payload[0].value)}
        </p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
        <XAxis
          dataKey="category"
          tick={{ fill: '#a8a49d', fontSize: 12, fontFamily: 'DM Sans,sans-serif' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#a8a49d', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `${symbol}${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
        <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={80}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={CAT_COLORS[entry.category] || '#4F46E5'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default SpendingChart;