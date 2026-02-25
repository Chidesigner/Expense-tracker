import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { signOut, User } from 'firebase/auth';
import { auth } from '../firebase';
import { useUserProfile, getInitials } from '../hooks/useUserprofile';
import FintraxAI from './FintraxAI';
import {
  LayoutDashboard, Wallet, BarChart2, Sparkles,
  Settings, Menu, X, LogOut, ChevronDown,
  MessageSquareText,
} from 'lucide-react';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface UserProfile {
  uid?: string;
  email?: string;
  username?: string;
  displayName?: string;
  photoURL?: string | null;
  provider?: string;
}
interface AvatarProps  { profile: UserProfile | null; size?: number; }
interface DropdownItemProps { to: string; icon: React.ReactNode; label: string; onClick: () => void; }
interface LayoutProps  { user: User; }

// ─── AVATAR ───────────────────────────────────────────────────────────────────
function Avatar({ profile, size = 34 }: AvatarProps) {
  if (profile?.photoURL) {
    return (
      <img src={profile.photoURL} alt={profile.displayName || 'avatar'} referrerPolicy="no-referrer"
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e7e5e0', flexShrink: 0 }}
      />
    );
  }
  const initials = getInitials(profile?.displayName || profile?.username || profile?.email || 'FT');
  const palettes: [string, string][] = [
    ['#4f46e5','#eef2ff'],['#0891b2','#ecfeff'],['#059669','#ecfdf5'],
    ['#d97706','#fffbeb'],['#dc2626','#fef2f2'],['#7c3aed','#f5f3ff'],
  ];
  const [fg, bg] = palettes[(initials.charCodeAt(0) || 0) % palettes.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, flexShrink: 0, letterSpacing: '-0.02em', fontFamily: "'DM Sans',sans-serif" }}>
      {initials}
    </div>
  );
}

// ─── USER DROPDOWN ────────────────────────────────────────────────────────────
function UserDropdown({ profile, onLogout }: { profile: UserProfile | null; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: '1px solid #e7e5e0', borderRadius: 99, padding: '4px 10px 4px 4px', cursor: 'pointer', transition: 'all 0.15s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#d4d2cd'; (e.currentTarget as HTMLButtonElement).style.background = '#fafaf9'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e7e5e0'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
        <Avatar profile={profile} size={26} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1c1917', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {profile?.displayName || profile?.username || 'Account'}
        </span>
        <ChevronDown size={12} color="#78746c" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 224, background: '#fff', border: '1px solid #e7e5e0', borderRadius: 14, boxShadow: '0 12px 32px rgba(0,0,0,0.10)', overflow: 'hidden', animation: 'dropIn 0.15s ease', zIndex: 200 }}>
          {/* User info */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f5f5f4', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar profile={profile} size={38} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.displayName || profile?.username || 'User'}
              </div>
              <div style={{ fontSize: 11, color: '#a8a49d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.email}
              </div>
            </div>
          </div>
          {/* Items */}
          <div style={{ padding: 6 }}>
            <DropdownItem to="/settings" icon={<Settings size={14} />} label="Settings" onClick={() => setOpen(false)} />
            <DropdownItem to="/ai" icon={<MessageSquareText size={14} />} label="Chat history" onClick={() => setOpen(false)} />
            <div style={{ height: 1, background: '#f5f5f4', margin: '4px 0' }} />
            <button onClick={() => { setOpen(false); onLogout(); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', background: 'transparent', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, color: '#e11d48', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff1f2'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      )}
      <style>{`@keyframes dropIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

function DropdownItem({ to, icon, label, onClick }: DropdownItemProps) {
  return (
    <a href={to} onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: '#1c1917', textDecoration: 'none', transition: 'background 0.1s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#f5f5f4'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}>
      <span style={{ color: '#78746c', display: 'flex' }}>{icon}</span>{label}
    </a>
  );
}

// ─── NAV ITEMS ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: '/',          end: true,  icon: LayoutDashboard, label: 'Dashboard'     },
  { to: '/expenses',  end: false, icon: Wallet,          label: 'Expenses'      },
  { to: '/analytics', end: false, icon: BarChart2,       label: 'Analytics'     },
  { to: '/ai',        end: false, icon: Sparkles,        label: 'Fintrax AI',    special: true },
  { to: '/history',   end: false, icon: MessageSquareText, label: 'Chat History' },
  { to: '/settings',  end: false, icon: Settings,        label: 'Settings'      },
];

// ─── LAYOUT ───────────────────────────────────────────────────────────────────
export default function Layout({ user }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile } = useUserProfile(user);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const handleLogout = async () => { await signOut(auth); navigate('/login'); };

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
          <button aria-label="Toggle menu" className="menu-btn" onClick={() => setSidebarOpen(v => !v)}>
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <UserDropdown profile={profile} onLogout={handleLogout} />
        </div>
      </header>

      {/* ── Overlay ── */}
      <div className={sidebarOpen ? 'overlay show' : 'overlay'} onClick={() => setSidebarOpen(false)} />

      {/* ── Sidebar ── */}
      <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Profile block */}
        {profile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px 16px', borderBottom: '1px solid #f5f5f4', marginBottom: 8 }}>
            <Avatar profile={profile} size={34} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.displayName || profile.username || 'User'}
              </div>
              {profile.username && (
                <div style={{ fontSize: 11, color: '#a8a49d', fontFamily: 'DM Mono,monospace' }}>@{profile.username}</div>
              )}
            </div>
          </div>
        )}

        {/* Nav links */}
        {NAV_ITEMS.map(({ to, end, icon: Icon, label, special }) => (
          <NavLink key={to} to={to} end={end} onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
            style={special ? ({ isActive }: { isActive: boolean }) => ({
              background: isActive
                ? 'linear-gradient(135deg,#4f46e5,#7c3aed)'
                : 'linear-gradient(135deg,#eef2ff,#f5f3ff)',
              color: isActive ? 'white' : '#4f46e5',
              borderRadius: 10,
              marginBottom: 2,
            }) : undefined}
          >
            <span className="icon" style={{ display: 'flex', alignItems: 'center' }}>
              <Icon size={17} />
            </span>
            {label}
          </NavLink>
        ))}

        {/* Footer */}
        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #f5f5f4' }}>
          <div style={{ fontSize: 10, color: '#c7c4be', fontWeight: 500, padding: '0 14px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
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