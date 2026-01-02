import { useState } from 'react';
import { Plus, LogOut } from 'lucide-react';

import { useAuth } from './components/Auth';
import { useExpenses } from './context/ExpenseContext';

import AuthForm from './components/AuthForm';
import { SummaryCards } from './components/SummaryCards';
import { ExpenseModal } from './components/ExpenseModal';
import { Charts } from './components/Charts';
import { TransactionsList } from './components/TransactionList';

function App() {
  const { user, logout } = useAuth();
  const { expenses, loading, addExpense, updateExpense, deleteExpense } =
    useExpenses();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  // 🔐 NOT LOGGED IN → SHOW AUTH PAGE
  if (!user) {
    return <AuthForm />;
  }

  const handleAddExpense = async (expense) => {
    if (editingExpense) {
      await updateExpense(editingExpense.id, expense);
      setEditingExpense(null);
    } else {
      await addExpense(expense);
    }
    setIsModalOpen(false);
  };

  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
    setIsModalOpen(true);
  };

  const handleDeleteExpense = async (id) => {
    await deleteExpense(id);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Loading expenses...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div>
            <h1 className="app-title">Expense Tracker</h1>
            <p className="app-subtitle">Manage your finances with ease</p>
          </div>

          <div className="header-actions">
            <button
              className="btn btn-primary add-btn"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus size={20} />
              Add Expense
            </button>

            <button
              className="btn btn-secondary logout-btn"
              onClick={logout}
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <SummaryCards expenses={expenses} />
        <Charts expenses={expenses} />
        <TransactionsList
          expenses={expenses}
          onEdit={handleEditExpense}
          onDelete={handleDeleteExpense}
        />
      </main>

      <ExpenseModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleAddExpense}
        editingExpense={editingExpense}
      />
    </div>
  );
}

export default App;
