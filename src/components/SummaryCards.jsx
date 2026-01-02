import { TrendingUp, Receipt, Wallet, ArrowUpCircle } from 'lucide-react';
import { formatCurrency } from '../currency';

// Component that displays summary statistics in card format
export function SummaryCards({ expenses }) {
  // Calculate total spent this month
  const getTotalThisMonth = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return expenses
      .filter(expense => {
        const expenseDate = new Date(expense.date);
        return (
          expenseDate.getMonth() === currentMonth &&
          expenseDate.getFullYear() === currentYear
        );
      })
      .reduce((sum, expense) => sum + Number(expense.amount), 0);
  };

  // Get total number of transactions
  const getTotalTransactions = () => expenses.length;

  // Calculate average expense amount
  const getAverageExpense = () => {
    if (expenses.length === 0) return 0;
    const total = expenses.reduce(
      (sum, expense) => sum + Number(expense.amount),
      0
    );
    return total / expenses.length;
  };

  // Find the highest single expense
  const getHighestExpense = () => {
    if (expenses.length === 0) return 0;
    return Math.max(...expenses.map(expense => Number(expense.amount)));
  };

  // Summary card data with icons and colors
  const summaryData = [
    {
      title: 'Total Spent',
      subtitle: 'This Month',
      value: formatCurrency(getTotalThisMonth()),
      icon: Wallet,
      color: '#667eea',
    },
    {
      title: 'Total Transactions',
      subtitle: 'All Time',
      value: getTotalTransactions().toString(),
      icon: Receipt,
      color: '#f59e0b',
    },
    {
      title: 'Average Expense',
      subtitle: 'Per Transaction',
      value: formatCurrency(getAverageExpense()),
      icon: TrendingUp,
      color: '#10b981',
    },
    {
      title: 'Highest Expense',
      subtitle: 'Single Transaction',
      value: formatCurrency(getHighestExpense()),
      icon: ArrowUpCircle,
      color: '#ef4444',
    },
  ];

  return (
    <div className="summary-cards">
      {summaryData.map((card, index) => {
        const Icon = card.icon;
        return (
          <div key={index} className="summary-card">
            <div className="summary-card-header">
              <div
                className="summary-card-icon"
                style={{ backgroundColor: card.color }}
              >
                <Icon size={24} color="white" />
              </div>
              <div className="summary-card-info">
                <h3 className="summary-card-title">{card.title}</h3>
                <p className="summary-card-subtitle">{card.subtitle}</p>
              </div>
            </div>
            <div className="summary-card-value">{card.value}</div>
          </div>
        );
      })}
    </div>
  );
}
