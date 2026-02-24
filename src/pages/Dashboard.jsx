import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import SpendingChart from '../SpendingChart';
import { useCurrency } from '../context/CurrencyContext';
import { useUserProfile } from '../hooks/useUserprofile';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getMonthName(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() - offset);
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function filterByMonthOffset(expenses, offset = 0) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  return expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === target.getMonth() && d.getFullYear() === target.getFullYear();
  });
}

function getDelta(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

const CATEGORY_ICONS = {
  Food: '🛒', Transport: '🚗', Shopping: '🛍️',
  Bills: '📋', Entertainment: '🎬', Other: '📦',
};

const CATEGORY_COLORS = {
  Food:          { bg: '#fef3c7', text: '#92400e' },
  Transport:     { bg: '#dbeafe', text: '#1e40af' },
  Shopping:      { bg: '#fce7f3', text: '#9d174d' },
  Bills:         { bg: '#f3f4f6', text: '#374151' },
  Entertainment: { bg: '#ede9fe', text: '#5b21b6' },
  Other:         { bg: '#f0fdf4', text: '#166534' },
};

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, prefix, delta, deltaLabel, icon, accentColor, loading, fmt }) {
  const isPositive = delta > 0;
  const isNeutral  = delta === 0;

  return (
    <div
      style={{
        background: '#ffffff', border: '1px solid #eeede9', borderRadius: 14,
        padding: '22px 24px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.2s, transform 0.2s', position: 'relative',
        overflow: 'hidden', cursor: 'default',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{ position: 'absolute', top: -24, right: -24, width: 80, height: 80, borderRadius: '50%', background: accentColor || '#eef2ff', opacity: 0.6, pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#78746c' }}>{label}</span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>

      {loading ? (
        <div style={{ height: 32, width: '60%', background: '#f5f5f4', borderRadius: 6 }} />
      ) : (
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 26, fontWeight: 500, color: '#1c1917', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 12 }}>
          {prefix !== undefined ? `${prefix}${value}` : fmt(value)}
        </div>
      )}

      {delta !== undefined && !loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
            background: isNeutral ? '#f5f5f4' : isPositive ? '#fff1f2' : '#f0fdf4',
            color:      isNeutral ? '#78746c' : isPositive ? '#e11d48' : '#15803d',
          }}>
            {!isNeutral && <span>{isPositive ? '↑' : '↓'}</span>}
            {Math.abs(delta).toFixed(1)}%
          </span>
          <span style={{ fontSize: 11, color: '#a8a49d', fontWeight: 500 }}>vs {deltaLabel}</span>
        </div>
      )}
    </div>
  );
}

// ─── CATEGORY BREAKDOWN BAR ───────────────────────────────────────────────────
function CategoryBar({ expenses, fmt }) {
  if (!expenses.length) return null;

  const totals = {};
  expenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });

  const total  = Object.values(totals).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ background: '#fff', border: '1px solid #eeede9', borderRadius: 14, padding: '22px 24px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1c1917', letterSpacing: '-0.02em' }}>This Month by Category</h3>
        <span style={{ fontSize: 12, color: '#a8a49d', fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>{fmt(total)}</span>
      </div>

      {/* Stacked bar */}
      <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', marginBottom: 18, background: '#f5f5f4' }}>
        {sorted.map(([cat, amt]) => {
          const pct = (amt / total) * 100;
          const barColors = { Food: '#f59e0b', Transport: '#3b82f6', Shopping: '#ec4899', Bills: '#6b7280', Entertainment: '#8b5cf6', Other: '#22c55e' };
          return <div key={cat} style={{ width: `${pct}%`, background: barColors[cat] || '#6366f1', transition: 'width 0.6s ease' }} title={`${cat}: ${pct.toFixed(1)}%`} />;
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map(([cat, amt]) => {
          const pct = ((amt / total) * 100).toFixed(1);
          const c   = CATEGORY_COLORS[cat] || { bg: '#f5f5f4', text: '#374151' };
          return (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 28, height: 28, borderRadius: 8, background: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                {CATEGORY_ICONS[cat] || '📦'}
              </span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#292524' }}>{cat}</span>
              <span style={{ fontSize: 12, color: '#a8a49d', fontFamily: "'DM Mono', monospace" }}>{pct}%</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1c1917', fontFamily: "'DM Mono', monospace", minWidth: 80, textAlign: 'right' }}>
                {fmt(amt)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── RECENT TRANSACTIONS ──────────────────────────────────────────────────────
function RecentTransactions({ expenses, fmt }) {
  const recent = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);

  return (
    <div style={{ background: '#fff', border: '1px solid #eeede9', borderRadius: 14, padding: '22px 24px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1c1917', letterSpacing: '-0.02em' }}>Recent Transactions</h3>
        <a href="/expenses" style={{ fontSize: 12, fontWeight: 600, color: '#6366f1', textDecoration: 'none', padding: '4px 10px', border: '1px solid #e0e7ff', borderRadius: 6, background: '#eef2ff', transition: 'all 0.15s' }}>
          View all →
        </a>
      </div>

      {recent.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#a8a49d', fontSize: 13 }}>
          No transactions yet. Add your first expense!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {recent.map((exp, i) => {
            const c = CATEGORY_COLORS[exp.category] || { bg: '#f5f5f4', text: '#374151' };
            return (
              <div
                key={exp.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 10px', borderRadius: 10, transition: 'background 0.15s', borderTop: i > 0 ? '1px solid #fafaf9' : 'none' }}
                onMouseEnter={e => e.currentTarget.style.background = '#fafaf9'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>
                  {CATEGORY_ICONS[exp.category] || '📦'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1c1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{exp.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: c.bg, color: c.text }}>{exp.category}</span>
                    <span style={{ fontSize: 11, color: '#a8a49d' }}>{exp.date}</span>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1917', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                  {fmt(exp.amount)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading]   = useState(true);
  const { fmt }                 = useCurrency();
  const user                    = auth.currentUser;
  const { profile }             = useUserProfile(user);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'expenses'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, snapshot => {
      setExpenses(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user]);

  // Derive display name: prefer profile displayName, then username, then email prefix
  const firstName = (() => {
    if (profile?.displayName) {
      const parts = profile.displayName.trim().split(' ');
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
    if (profile?.username) return profile.username;
    const local = (user?.email || '').split('@')[0];
    return local.charAt(0).toUpperCase() + local.slice(1).split(/[._-]/)[0];
  })();

  const thisMonth      = filterByMonthOffset(expenses, 0);
  const lastMonth      = filterByMonthOffset(expenses, 1);
  const thisMonthTotal = thisMonth.reduce((s, e) => s + e.amount, 0);
  const lastMonthTotal = lastMonth.reduce((s, e) => s + e.amount, 0);
  const totalAll       = expenses.reduce((s, e) => s + e.amount, 0);
  const avgTransaction = expenses.length ? totalAll / expenses.length : 0;
  const delta          = getDelta(thisMonthTotal, lastMonthTotal);

  const topExpense = thisMonth.length
    ? thisMonth.reduce((a, b) => a.amount > b.amount ? a : b)
    : null;

  const now      = new Date();
  const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div style={{
      maxWidth: 1040, margin: '0 auto', padding: '36px 28px',
      display: 'flex', flexDirection: 'column', gap: 24,
      fontFamily: "'DM Sans', -apple-system, sans-serif",
      animation: 'pageIn 0.25s ease',
    }}>
      {/* ── Greeting ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 12, color: '#a8a49d', fontWeight: 500, marginBottom: 4 }}>{todayStr}</p>
          <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.04em', color: '#1c1917', lineHeight: 1.2 }}>
            {getGreeting()}, {firstName} 👋
          </h2>
          <p style={{ fontSize: 13, color: '#78746c', marginTop: 4 }}>
            {loading ? 'Loading your data…' : expenses.length === 0
              ? 'Add your first expense to get started.'
              : `You have ${expenses.length} transaction${expenses.length !== 1 ? 's' : ''} tracked.`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: '#eef2ff', border: '1px solid #c7d2fe' }}>
          <span style={{ fontSize: 13 }}>📅</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#4338ca' }}>{getMonthName()}</span>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
        <KpiCard label="This Month"     value={thisMonthTotal} delta={delta} deltaLabel={getMonthName(1)} icon="📅" accentColor="#eef2ff" loading={loading} fmt={fmt} />
        <KpiCard label="All Time Spent" value={totalAll}       icon="💰" accentColor="#f0fdf4"  loading={loading} fmt={fmt} />
        <KpiCard label="Avg Transaction" value={avgTransaction} icon="📊" accentColor="#fff7ed" loading={loading} fmt={fmt} />
        <KpiCard label="Transactions"   value={expenses.length} prefix="" icon="🧾" accentColor="#fdf4ff" loading={loading} fmt={fmt} />
      </div>

      {/* ── Top expense callout ── */}
      {topExpense && !loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#fff', border: '1px solid #eeede9', borderRadius: 14, padding: '16px 22px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏆</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a49d', marginBottom: 2 }}>Biggest expense this month</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1c1917' }}>{topExpense.title}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#1c1917', fontFamily: "'DM Mono', monospace", letterSpacing: '-0.03em' }}>{fmt(topExpense.amount)}</p>
            <p style={{ fontSize: 11, color: '#a8a49d' }}>{topExpense.date}</p>
          </div>
        </div>
      )}

      {/* ── Chart ── */}
      {!loading && expenses.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #eeede9', borderRadius: 14, padding: '22px 24px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1c1917', letterSpacing: '-0.02em', marginBottom: 18 }}>Spending by Category</h3>
          <SpendingChart expenses={expenses} />
        </div>
      )}

      {/* ── Two-column: Category breakdown + Recent ── */}
      {!loading && expenses.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          <CategoryBar expenses={thisMonth} fmt={fmt} />
          <RecentTransactions expenses={expenses} fmt={fmt} />
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && expenses.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: '#fff', border: '1px dashed #e7e5e0', borderRadius: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>💸</div>
          <h3 style={{ fontSize: 17, fontWeight: 600, color: '#1c1917', marginBottom: 8 }}>No expenses yet</h3>
          <p style={{ fontSize: 13, color: '#a8a49d', maxWidth: 280, margin: '0 auto 20px' }}>
            Head over to the Expenses tab and log your first transaction to see your dashboard come alive.
          </p>
          <a href="/expenses" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#4f46e5', color: 'white', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none', boxShadow: '0 1px 3px rgba(99,102,241,0.4)' }}>
            + Add first expense
          </a>
        </div>
      )}

      <style>{`
        @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}

export default Dashboard;