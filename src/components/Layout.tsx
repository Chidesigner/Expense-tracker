import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

function Layout({ user }: { user: { email: string } }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    signOut(auth);
    navigate('/login');
  };

  // close mobile sidebar on navigation
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="app">
      <header>
        <div className="brand">
          <div className="logo">FT</div>
          <div>
            <h1 style={{ fontSize: '1.2rem', marginBottom: 2 }}>Fintrax</h1>
            <p style={{ fontSize: '0.8rem', opacity: 0.9 }}>Secure. Simple. Smart.</p>
          </div>
        </div>

        <div className="header-actions">
          <button aria-label="Open menu" className="menu-btn" onClick={() => setOpen(v => !v)}>
            {open ? '✕' : '☰'}
          </button>
          <span className="user-email">{user.email}</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </header>

      <div className={open ? 'overlay show' : 'overlay'} onClick={() => setOpen(false)} />

      <nav className={`sidebar ${open ? 'open' : ''}`}>
        <NavLink to="/" end onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <span className="icon">📊</span>
          Dashboard
        </NavLink>
        <NavLink to="/expenses" onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <span className="icon">💰</span>
          Expenses
        </NavLink>
        <NavLink to="/analytics" onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <span className="icon">📈</span>
          Analytics
        </NavLink>
        <NavLink to="/settings" onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <span className="icon">⚙️</span>
          Settings
        </NavLink>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;