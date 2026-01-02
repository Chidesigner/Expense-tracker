import { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { useAuth } from '../components/Auth';

const ExpenseContext = createContext(undefined);

export function ExpenseProvider({ children }) {
  const { user } = useAuth(); // ✅ SINGLE source of truth
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ Fetch expenses when user changes
  useEffect(() => {
    if (!user) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    const fetchExpenses = async () => {
      try {
        setLoading(true);

        const q = query(
          collection(db, 'expenses'),
          where('userId', '==', user.uid)
        );

        const snapshot = await getDocs(q);

        const data = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
          }))
          .sort(
            (a, b) =>
              (b.createdAt?.seconds || 0) -
              (a.createdAt?.seconds || 0)
          );

        setExpenses(data);
      } catch (error) {
        console.error('Error fetching expenses:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();
  }, [user]);

  // ✅ Add expense (scoped to user)
  const addExpense = async (expense) => {
    if (!user) throw new Error('Not authenticated');

    const docRef = await addDoc(collection(db, 'expenses'), {
      ...expense,
      userId: user.uid,
      createdAt: serverTimestamp(),
    });

    setExpenses(prev => [
      { id: docRef.id, ...expense, userId: user.uid },
      ...prev,
    ]);
  };

  // ✅ Update expense
  const updateExpense = async (id, updatedExpense) => {
    await updateDoc(doc(db, 'expenses', id), updatedExpense);

    setExpenses(prev =>
      prev.map(exp =>
        exp.id === id ? { ...exp, ...updatedExpense } : exp
      )
    );
  };

  // ✅ Delete expense
  const deleteExpense = async (id) => {
    await deleteDoc(doc(db, 'expenses', id));
    setExpenses(prev => prev.filter(exp => exp.id !== id));
  };

  return (
    <ExpenseContext.Provider
      value={{
        expenses,
        loading,
        addExpense,
        updateExpense,
        deleteExpense,
      }}
    >
      {children}
    </ExpenseContext.Provider>
  );
}

export function useExpenses() {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpenses must be used inside ExpenseProvider');
  }
  return context;
}
