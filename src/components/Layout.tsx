import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { signOut, User } from 'firebase/auth';
import { auth } from '../firebase';
import { useUserProfile, getInitials } from '../hooks/useUserprofile';
import FintraxAI from './FintraxAI';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface UserProfile {
  uid?: string;
  email?: string;
  username?: string;
  displayName?: string;
  photoURL?: string | null;
  provider?: string;
}

interface AvatarProps {
  profile: UserProfile | null;
  size?: number;
}

interface UserDropdownProps {
  profile: UserProfile | null;
  onLogout: () => void;
}

interface DropdownItemProps {
  href: string;
  icon: string;
  label: string;
  onClick: () => void;
}

interface LayoutProps {
  user: User;
}

// ─── AVATAR ───────────────────────────────────────────────────────────────────
function Avatar({ profile, size = 34 }: AvatarProps) {
  if (profile?.photoURL) {
    return (
      <img
        src={profile.photoURL}
        alt={profile.displayName || 'avatar'}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', border: '2px solid #e7e5e0',
          flexShrink: 0,
        }}
        referrerPolicy="no-referrer"
      />
    );
  }

  const initials = getInitials(profile?.displayName || profile?.username || profile?.email || 'FT');
  const colors: [string, string][] = [
    ['#4f46e5', '#eef2ff'], ['#0891b2', '#ecfeff'], ['#059669', '#ecfdf5'],
    ['#d97706', '#fffbeb'], ['#dc2626', '#fef2f2'], ['#7c3aed', '#f5f3ff'],
  ];
  const idx = (initials.charCodeAt(0) || 0) % colors.length;
  const [fg, bg] = colors[idx];

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, flexShrink: 0,
      border: `2px solid ${bg}`,
      letterSpacing: '-0.02em',
      fontFamily: "'DM Sans',sans-serif",
    }}>
      {initials}
    </div>
  );
}

// ─── USER DROPDOWN ────────────────────────────────────────────────────────────
function UserDropdown({ profile, onLogout }: UserDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'transparent', border: '1px solid #e7e5e0',
          borderRadius: 99, padding: '4px 10px 4px 4px',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#d4d2cd'; (e.currentTarget as HTMLButtonElement).style.background = '#fafaf9'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e7e5e0'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
      >
        <Avatar profile={profile} size={26} />
        <span style={{
          fontSize: 13, fontWeight: 600, color: '#1c1917',
          maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {profile?.displayName || profile?.username || 'Account'}
        </span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none"
          style={{ flexShrink: 0, opacity: 0.4, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <path d="M1 1l4 4 4-4" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 220, background: '#fff', border: '1px solid #e7e5e0',
          borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
          overflow: 'hidden', animation: 'dropIn 0.15s ease',
          zIndex: 200,
        }}>
          {/* User info header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f5f5f4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar profile={profile} size={36} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile?.displayName || profile?.username || 'User'}
                </div>
                <div style={{ fontSize: 11, color: '#a8a49d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile?.email}
                </div>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div style={{ padding: '6px' }}>
            <DropdownItem href="/settings" icon="⚙️" label="Settings" onClick={() => setOpen(false)} />
            <div style={{ height: 1, background: '#f5f5f4', margin: '4px 0' }} />
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', background: 'transparent', border: 'none',
                borderRadius: 8, fontSize: 13, fontWeight: 500,
                color: '#e11d48', cursor: 'pointer', fontFamily: 'inherit',
                textAlign: 'left',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff1f2'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 15 }}>→</span> Sign out
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes dropIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  );
}

function DropdownItem({ href, icon, label, onClick }: DropdownItemProps) {
  return (
    <a
      href={href}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 10px', borderRadius: 8,
        fontSize: 13, fontWeight: 500, color: '#1c1917',
        textDecoration: 'none', transition: 'background 0.1s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#f5f5f4'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
    >
      <span style={{ fontSize: 15 }}>{icon}</span>{label}
    </a>
  );
}

// ─── LAYOUT ───────────────────────────────────────────────────────────────────
function Layout({ user }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { profile } = useUserProfile(user);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const navItems = [
    { to: '/',          end: true,  icon: '📊', label: 'Dashboard' },
    { to: '/expenses',  end: false, icon: '💰', label: 'Expenses' },
    { to: '/analytics', end: false, icon: '📈', label: 'Analytics' },
    { to: '/ai',        end: false, icon: '✦',  label: 'Fintrax AI' },
    { to: '/settings',  end: false, icon: '⚙️', label: 'Settings' },
  ];

  return (
    <div className="app">
      {/* ── Header ── */}
      <header>
        <div className="brand">
          <div className="logo">FT</div>
          <div>
            <h1 style={{ fontSize: '1.15rem', marginBottom: 2 }}>Fintrax</h1>
            <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>Secure. Simple. Smart.</p>
          </div>
        </div>

        <div className="header-actions">
          <button
            aria-label="Open menu"
            className="menu-btn"
            onClick={() => setOpen(v => !v)}
          >
            {open ? '✕' : '☰'}
          </button>

          <UserDropdown profile={profile} onLogout={handleLogout} />
        </div>
      </header>

      {/* ── Overlay ── */}
      <div className={open ? 'overlay show' : 'overlay'} onClick={() => setOpen(false)} />

      {/* ── Sidebar ── */}
      <nav className={`sidebar ${open ? 'open' : ''}`}>
        {/* Username block at top of sidebar */}
        {profile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px 16px',
            borderBottom: '1px solid #f5f5f4',
            marginBottom: 8,
          }}>
            <Avatar profile={profile} size={32} />
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: '#1c1917',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {profile.displayName || profile.username || 'User'}
              </div>
              {profile.username && (
                <div style={{ fontSize: 11, color: '#a8a49d', fontFamily: 'DM Mono,monospace' }}>
                  @{profile.username}
                </div>
              )}
            </div>
          </div>
        )}

        {navItems.map(({ to, end, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setOpen(false)}
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            <span className="icon">{icon}</span>
            {label}
          </NavLink>
        ))}

        {/* Sidebar footer */}
        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #f5f5f4' }}>
          <div style={{
            fontSize: 10, color: '#c7c4be', fontWeight: 500,
            padding: '0 12px', letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            Fintrax v1.0.0
          </div>
        </div>
      </nav>

      {/* ── Main ── */}
      <main className="main-content">
        <Outlet />
      </main>

      {/* ── Floating AI (hidden on /ai page) ── */}
      {location.pathname !== '/ai' && <FintraxAI mode="floating" />}
    </div>
  );
}

export default Layout;