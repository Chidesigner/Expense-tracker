import { useState, useMemo } from 'react';
import { Edit2, Trash2, Search } from 'lucide-react';
import { formatCurrency } from '../currency';

// Component that displays a filterable list of expense transactions
export function TransactionsList({ expenses, onEdit, onDelete }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Filter and search expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      // Filter by category
      const matchesCategory =
        categoryFilter === 'All' || expense.category === categoryFilter;

      // Search by title or category
      const matchesSearch =
        expense.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.category.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [expenses, searchQuery, categoryFilter]);

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get category badge color
  const getCategoryColor = (category) => {
    const colors = {
      Food: '#f59e0b',
      Shopping: '#ec4899',
      Transportation: '#3b82f6',
      Entertainment: '#8b5cf6',
      Bills: '#ef4444',
      Healthcare: '#10b981',
      Other: '#6b7280',
    };
    return colors[category] || '#6b7280';
  };

  return (
    <div className="transactions-section">
      <div className="transactions-header">
        <h2>Transactions</h2>
        <div className="transactions-filters">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="All">All Categories</option>
            <option value="Food">Food</option>
            <option value="Shopping">Shopping</option>
            <option value="Transportation">Transportation</option>
            <option value="Entertainment">Entertainment</option>
            <option value="Bills">Bills</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div className="transactions-list">
        {filteredExpenses.length === 0 ? (
          <div className="empty-state">
            <p>
              {expenses.length === 0
                ? 'No expenses yet. Click "Add Expense" to get started!'
                : 'No transactions match your search criteria.'}
            </p>
          </div>
        ) : (
          filteredExpenses.map((expense) => (
            <div key={expense.id} className="transaction-item">
              <div className="transaction-info">
                <div className="transaction-main">
                  <h4 className="transaction-title">{expense.title}</h4>
                  <span
                    className="transaction-category"
                    style={{
                      backgroundColor: getCategoryColor(expense.category),
                    }}
                  >
                    {expense.category}
                  </span>
                </div>
                <p className="transaction-date">
                  {formatDate(expense.date)}
                </p>
                {expense.notes && (
                  <p className="transaction-notes">{expense.notes}</p>
                )}
              </div>

              <div className="transaction-actions">
                <span className="transaction-amount">
                  {formatCurrency(Number(expense.amount))}
                </span>
                <div className="transaction-buttons">
                  <button
                    className="icon-btn edit-btn"
                    onClick={() => onEdit(expense)}
                    title="Edit expense"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    className="icon-btn delete-btn"
                    onClick={() => {
                      if (
                        window.confirm(
                          'Are you sure you want to delete this expense?'
                        )
                      ) {
                        onDelete(expense.id);
                      }
                    }}
                    title="Delete expense"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
