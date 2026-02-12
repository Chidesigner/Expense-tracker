import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function SpendingChart({ expenses }) {
  // Don't show chart if there are no expenses
  if (expenses.length === 0) {
    return null;
  }

  // STEP 1: Calculate total spending for each category
  const categoryTotals = {};
  
  expenses.forEach(expense => {
    if (categoryTotals[expense.category]) {
      // Category already exists, add to it
      categoryTotals[expense.category] += expense.amount;
    } else {
      // New category, create it
      categoryTotals[expense.category] = expense.amount;
    }
  });

  // STEP 2: Convert to array format that the chart can understand
  // From: { Food: 5000, Transport: 2000 }
  // To: [{ category: 'Food', amount: 5000 }, { category: 'Transport', amount: 2000 }]
  const chartData = Object.keys(categoryTotals).map(category => ({
    category: category,
    amount: parseFloat(categoryTotals[category].toFixed(2))
  }));

  // STEP 3: Sort by amount (highest spending first)
  chartData.sort((a, b) => b.amount - a.amount);

  // Custom tooltip to show nice formatting when hovering over bars
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'white',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '5px'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{payload[0].payload.category}</p>
          <p style={{ margin: 0, color: '#4F46E5' }}>₦{payload[0].value.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-container">
      <h3>Spending by Category</h3>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          {/* Background grid lines */}
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          
          {/* X-axis shows category names */}
          <XAxis 
            dataKey="category" 
            tick={{ fill: '#666' }}
            axisLine={{ stroke: '#ddd' }}
          />
          
          {/* Y-axis shows amounts */}
          <YAxis 
            tick={{ fill: '#666' }}
            axisLine={{ stroke: '#ddd' }}
            tickFormatter={(value) => `₦${value}`}
          />
          
          {/* Tooltip when hovering */}
          <Tooltip content={<CustomTooltip />} />
          
          {/* The actual bars */}
          <Bar 
            dataKey="amount" 
            fill="#4F46E5" 
            radius={[8, 8, 0, 0]}
            maxBarSize={100}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default SpendingChart;