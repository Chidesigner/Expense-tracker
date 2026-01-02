import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '../currency';

// Colors for each expense category
const COLORS = {
  Food: '#f59e0b',
  Shopping: '#ec4899',
  Transportation: '#3b82f6',
  Entertainment: '#8b5cf6',
  Bills: '#ef4444',
  Healthcare: '#10b981',
  Other: '#6b7280',
};

// Tooltip for line chart
function CustomLineTooltip(props) {
  const active = props.active;
  const payload = props.payload;

  if (active === true && payload && payload.length > 0) {
    const data = payload[0];

    return (
      <div className="chart-tooltip">
        <p className="tooltip-label">{data.payload.label}</p>
        <p className="tooltip-value">
          {formatCurrency(Number(data.value))}
        </p>
      </div>
    );
  }

  return null;
}

// Tooltip for pie chart
function CustomPieTooltip(props) {
  const active = props.active;
  const payload = props.payload;

  if (active === true && payload && payload.length > 0) {
    const data = payload[0];

    return (
      <div className="chart-tooltip">
        <p className="tooltip-label">{data.name}</p>
        <p className="tooltip-value">
          {formatCurrency(Number(data.value))}
        </p>
      </div>
    );
  }

  return null;
}

// Main charts component
export function Charts({ expenses }) {
  // Get total expenses for each of the last 7 days
  function getWeeklyData() {
    const days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      const dateString = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

      let dayTotal = 0;

      for (let j = 0; j < expenses.length; j++) {
        if (expenses[j].date === dateString) {
          dayTotal = dayTotal + Number(expenses[j].amount);
        }
      }

      days.push({
        date: dateString,
        amount: dayTotal,
        label: dayName,
      });
    }

    return days;
  }

  // Get total amount spent per category
  function getCategoryData() {
    const totals = {};

    for (let i = 0; i < expenses.length; i++) {
      const category = expenses[i].category;
      const amount = Number(expenses[i].amount);

      if (totals[category] === undefined) {
        totals[category] = amount;
      } else {
        totals[category] = totals[category] + amount;
      }
    }

    const result = [];

    for (const key in totals) {
      result.push({
        name: key,
        value: totals[key],
      });
    }

    return result;
  }

  const weeklyData = getWeeklyData();
  const categoryData = getCategoryData();

  return (
    <div className="charts-container">
      <div className="chart-card">
        <h3 className="chart-title">Weekly Spending</h3>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip content={<CustomLineTooltip />} />

            <Line
              type="monotone"
              dataKey="amount"
              stroke="#667eea"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3 className="chart-title">Category Distribution</h3>

        {categoryData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="value"
              >
                {categoryData.map(function (item) {
                  return (
                    <Cell
                      key={item.name}
                      fill={COLORS[item.name] || '#6b7280'}
                    />
                  );
                })}
              </Pie>

              <Tooltip content={<CustomPieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-chart">
            <p>No data to display</p>
          </div>
        )}
      </div>
    </div>
  );
}
