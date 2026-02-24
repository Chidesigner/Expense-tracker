import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Login from './Login';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import AIPage from './pages/AI';
import Layout from './components/Layout';
import { CurrencyProvider } from './context/CurrencyContext';

function App() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <div className="loading" style={{ fontFamily: "'DM Sans',sans-serif" }}>
        Loading…
      </div>
    );
  }

  return (
    <CurrencyProvider user={user}>
      <Router>
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          {user ? (
            <Route path="/" element={<Layout user={user} />}>
              <Route index element={<Dashboard />} />
              <Route path="expenses"  element={<Expenses />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="ai"        element={<AIPage />} />
              <Route path="settings"  element={<Settings />} />
            </Route>
          ) : (
            <Route path="*" element={<Navigate to="/login" />} />
          )}
        </Routes>
      </Router>
    </CurrencyProvider>
  );
}

export default App;