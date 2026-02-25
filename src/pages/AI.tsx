// pages/AI.tsx
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import FintraxAI from '../components/FintraxAI';
import { useCurrency } from '../context/CurrencyContext';
import { useUserProfile } from '../hooks/useUserprofile';
import { generateWeeklyInsights, detectAnomalies, Expense } from '../lib/ai';
import {
  BarChart3, Zap, Brain, Globe,
  TrendingUp, AlertTriangle, Info,
  Sparkles, RotateCcw, Loader2,
  Database, Tag, Calendar, ShieldCheck,
  MessageSquare,
} from 'lucide-react';

// ─── WEEKLY INSIGHTS CARD ─────────────────────────────────────────────────────
function WeeklyInsightsCard({ expenses, symbol }: { expenses: Expense[]; symbol: string }) {
  const user = auth.currentUser;
  const { profile } = useUserProfile(user);
  const [insight,   setInsight]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [generated, setGenerated] = useState(false);

  const generate = async () => {
    if (loading || !expenses.length) return;
    setLoading(true);
    try {
      const text = await generateWeeklyInsights(expenses, profile, symbol);
      setInsight(text);
      setGenerated(true);
    } catch {
      setInsight('Could not generate insights right now. Try again.');
      setGenerated(true);
    }
    setLoading(false);
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '13px 16px', borderBottom: '1px solid #f3f4f6', background: 'linear-gradient(135deg,#fdf4ff,#ede9fe)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BarChart3 size={14} color="#7c3aed" />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1c1917' }}>Weekly Insights</div>
          <div style={{ fontSize: 10, color: '#9ca3af' }}>AI-generated from your data</div>
        </div>
      </div>
      <div style={{ padding: '14px 16px' }}>
        {!generated ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12, lineHeight: 1.5 }}>
              Get a personalised summary of your spending patterns.
            </p>
            <button onClick={generate} disabled={loading || !expenses.length} style={{ padding: '8px 16px', background: loading ? '#e5e7eb' : 'linear-gradient(135deg,#7c3aed,#6366f1)', color: loading ? '#9ca3af' : 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: loading || !expenses.length ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {loading
                ? <><Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} /> Analysing…</>
                : <><Sparkles size={12} /> Generate insights</>
              }
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, lineHeight: 1.7, color: '#374151', whiteSpace: 'pre-wrap' }}>{insight}</div>
            <button onClick={() => { setGenerated(false); setInsight(''); }} style={{ marginTop: 10, padding: '5px 10px', background: 'transparent', border: '1px solid #e5e7eb', color: '#6b7280', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <RotateCcw size={10} /> Regenerate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CAPABILITY CARD ──────────────────────────────────────────────────────────
function CapabilityCard({ icon, title, color, bg, examples }: {
  icon: React.ReactNode; title: string; color: string; bg: string; examples: string[];
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
          {icon}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{title}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {examples.map((ex, i) => (
          <div key={i} style={{ fontSize: 11, color: '#6b7280', padding: '4px 8px', background: '#f9fafb', borderRadius: 6, fontStyle: 'italic', lineHeight: 1.4 }}>
            "{ex}"
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function AIPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const { symbol }              = useCurrency();
  const user                    = auth.currentUser;
  const anomalies               = detectAnomalies(expenses, symbol);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'expenses'), where('userId', '==', user.uid));
    getDocs(q).then(snap => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense))));
  }, [user]);

  const capabilities = [
    { icon: <MessageSquare size={13} />, color: '#2563eb', bg: '#dbeafe', title: 'Ask questions',      examples: ['How much on food last month?', "What's my biggest category?"] },
    { icon: <Zap size={13} />,           color: '#d97706', bg: '#fef3c7', title: 'Take actions',       examples: ['Add ₦5,000 transport today', 'Delete the Netflix expense'] },
    { icon: <Brain size={13} />,         color: '#7c3aed', bg: '#ede9fe', title: 'Smart advice',       examples: ['How can I cut spending?', "Am I on track this month?"] },
    { icon: <Globe size={13} />,         color: '#059669', bg: '#d1fae5', title: 'General assistant',  examples: ['Help me make a budget', "What's the 50/30/20 rule?"] },
  ];

  const categoryBreakdown = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});
  const topCategories = Object.entries(categoryBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const totalSpend = topCategories.reduce((s, [, v]) => s + v, 0);

  const catColors: Record<string, { color: string; bg: string }> = {
    Food:          { color: '#b45309', bg: '#fef3c7' },
    Transport:     { color: '#1d4ed8', bg: '#dbeafe' },
    Shopping:      { color: '#be185d', bg: '#fce7f3' },
    Bills:         { color: '#374151', bg: '#f3f4f6' },
    Entertainment: { color: '#6d28d9', bg: '#ede9fe' },
    Other:         { color: '#065f46', bg: '#d1fae5' },
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 0, height: 'calc(100vh - 60px)', fontFamily: "'DM Sans',sans-serif" }}>

      {/* ── Main chat ── */}
      <div style={{ borderRight: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <FintraxAI mode="page" initialOpen={true} />
      </div>

      {/* ── Sidebar ── */}
      <div style={{ overflowY: 'auto', padding: '20px 16px', background: '#f9fafb', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Spending alerts */}
        {anomalies.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '11px 14px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={13} color="#d97706" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Spending Alerts</span>
            </div>
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {anomalies.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 10px', background: a.severity === 'warning' ? '#fffbeb' : '#eff6ff', borderRadius: 8, fontSize: 11, lineHeight: 1.5 }}>
                  {a.severity === 'warning'
                    ? <AlertTriangle size={12} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
                    : <Info size={12} color="#3b82f6" style={{ flexShrink: 0, marginTop: 1 }} />
                  }
                  <div>
                    <div style={{ fontWeight: 700, color: a.severity === 'warning' ? '#92400e' : '#1e40af', marginBottom: 1 }}>{a.title}</div>
                    <div style={{ color: a.severity === 'warning' ? '#b45309' : '#2563eb' }}>{a.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top spending categories */}
        {topCategories.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '11px 14px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={13} color="#6366f1" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Top Categories</span>
            </div>
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {topCategories.map(([cat, amt]) => {
                const pct  = Math.round((amt / totalSpend) * 100);
                const meta = catColors[cat] || { color: '#6b7280', bg: '#f3f4f6' };
                return (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 20, height: 20, borderRadius: 6, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Tag size={10} color={meta.color} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{cat}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#111827', fontFamily: 'DM Mono,monospace' }}>{symbol}{amt.toLocaleString()}</span>
                        <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}>{pct}%</span>
                      </div>
                    </div>
                    <div style={{ height: 4, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: meta.color, borderRadius: 99, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Weekly insights */}
        <WeeklyInsightsCard expenses={expenses} symbol={symbol} />

        {/* Capabilities */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>What I can do</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {capabilities.map((c, i) => <CapabilityCard key={i} {...c} />)}
          </div>
        </div>

        {/* Data summary */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Database size={10} /> Data loaded
          </div>
          {([
            ['Transactions', expenses.length.toString()],
            ['Categories',   [...new Set(expenses.map(e => e.category))].length.toString()],
            ['Date range',   expenses.length > 0 ? (() => {
              const dates = expenses.map(e => new Date(e.date)).sort((a, b) => a.getTime() - b.getTime());
              return `${dates[0].toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} – now`;
            })() : 'No data'],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 5, marginBottom: 5, borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ fontSize: 11, color: '#6b7280' }}>{k}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#111827', fontFamily: 'DM Mono,monospace' }}>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
            <ShieldCheck size={10} color="#9ca3af" />
            <span style={{ fontSize: 10, color: '#9ca3af', lineHeight: 1.4 }}>Your data stays private in Firestore.</span>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}