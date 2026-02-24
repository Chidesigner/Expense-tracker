// pages/AI.tsx
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import FintraxAI from '../components/FintraxAI';
import { useCurrency } from '../context/CurrencyContext';
import { useUserProfile } from '../hooks/useUserprofile';
import { generateWeeklyInsights, detectAnomalies, buildFinancialContext, Expense } from '../lib/ai';

function WeeklyInsightsCard({
  expenses,
  symbol,
}: {
  expenses: Expense[];
  symbol: string;
}) {
  const user              = auth.currentUser;
  const { profile }       = useUserProfile(user);
  const [insight, setInsight]   = useState<string>('');
  const [loading, setLoading]   = useState(false);
  const [generated, setGenerated] = useState(false);

  const generate = async () => {
    if (loading || !expenses.length) return;
    setLoading(true);
    try {
      const text = await generateWeeklyInsights(expenses, profile, symbol);
      setInsight(text);
      setGenerated(true);
    } catch {
      setInsight('Could not generate insights right now. Try again later.');
      setGenerated(true);
    }
    setLoading(false);
  };

  return (
    <div style={{
      background: '#fff', border: '1px solid #eeede9', borderRadius: 14,
      overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid #f5f5f4',
        background: 'linear-gradient(135deg,#fdf4ff,#ede9fe)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>📊</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1917' }}>Weekly Insights</div>
          <div style={{ fontSize: 11, color: '#78746c' }}>AI-generated from your data</div>
        </div>
      </div>
      <div style={{ padding: '16px 18px' }}>
        {!generated ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: '#a8a49d', marginBottom: 12 }}>
              Get a personalised financial summary based on your spending patterns.
            </p>
            <button
              onClick={generate}
              disabled={loading || !expenses.length}
              style={{
                padding: '9px 18px', background: loading ? '#e7e5e0' : '#7c3aed',
                color: loading ? '#a8a49d' : 'white', border: 'none', borderRadius: 8,
                fontSize: 12, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto',
              }}
            >
              {loading && <span style={{ width: 11, height: 11, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />}
              {loading ? 'Analysing…' : '✦ Generate insights'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, lineHeight: 1.65, color: '#57534e', whiteSpace: 'pre-wrap' }}>{insight}</div>
            <button
              onClick={() => { setGenerated(false); setInsight(''); }}
              style={{ marginTop: 12, padding: '5px 12px', background: 'transparent', border: '1px solid #e7e5e0', color: '#78746c', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Regenerate
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function CapabilityCard({ icon, title, examples }: { icon: string; title: string; examples: string[] }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #eeede9', borderRadius: 12,
      padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1c1917' }}>{title}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {examples.map((ex, i) => (
          <div key={i} style={{
            fontSize: 11, color: '#78746c', padding: '4px 8px',
            background: '#fafaf9', borderRadius: 6,
            fontStyle: 'italic', lineHeight: 1.4,
          }}>
            "{ex}"
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AIPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const { symbol }              = useCurrency();
  const user                    = auth.currentUser;
  const anomalies               = detectAnomalies(expenses, symbol);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'expenses'), where('userId', '==', user.uid));
    getDocs(q).then(snap => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense)));
    });
  }, [user]);

  const capabilities = [
    {
      icon: '💬',
      title: 'Ask questions',
      examples: ['How much on food last month?', 'What\'s my biggest category?', 'Compare this month vs last'],
    },
    {
      icon: '⚡',
      title: 'Take actions',
      examples: ['Add ₦5,000 transport today', 'Delete the Netflix expense', 'Update my grocery amount'],
    },
    {
      icon: '🧠',
      title: 'Get smart advice',
      examples: ['How can I cut spending?', 'Am I on track this month?', 'Where\'s my money going?'],
    },
    {
      icon: '🌐',
      title: 'General assistant',
      examples: ['Help me make a budget', 'Explain compound interest', 'What\'s the 50/30/20 rule?'],
    },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 300px',
      gap: 0,
      height: 'calc(100vh - 60px)',
      fontFamily: "'DM Sans',sans-serif",
    }}>
      {/* ── Main chat area ── */}
      <div style={{ borderRight: '1px solid #eeede9', overflow: 'hidden' }}>
        <FintraxAI mode="page" initialOpen={true} />
      </div>

      {/* ── Right sidebar ── */}
      <div style={{
        overflowY: 'auto', padding: '24px 20px',
        background: '#fafaf9', display: 'flex', flexDirection: 'column', gap: 16,
      }}>

        {/* Anomaly alerts */}
        {anomalies.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #eeede9', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f5f5f4', fontSize: 12, fontWeight: 700, color: '#1c1917' }}>
              ⚠️ Spending Alerts
            </div>
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {anomalies.map((a, i) => (
                <div key={i} style={{
                  padding: '8px 10px',
                  background: a.severity === 'warning' ? '#fffbeb' : '#eff6ff',
                  borderRadius: 8, fontSize: 11, lineHeight: 1.5,
                  color: a.severity === 'warning' ? '#92400e' : '#1e40af',
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{a.title}</div>
                  {a.detail}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weekly insights */}
        <WeeklyInsightsCard expenses={expenses} symbol={symbol} />

        {/* Capabilities */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#a8a49d', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            What I can do
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {capabilities.map((c, i) => (
              <CapabilityCard key={i} {...c} />
            ))}
          </div>
        </div>

        {/* Data summary */}
        <div style={{ background: '#fff', border: '1px solid #eeede9', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#a8a49d', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Data loaded
          </div>
          {[
            ['Transactions', expenses.length.toString()],
            ['Categories', [...new Set(expenses.map(e => e.category))].length.toString()],
            ['Date range', expenses.length > 0 ? (() => {
              const dates = expenses.map(e => new Date(e.date)).sort((a, b) => a.getTime() - b.getTime());
              return `${dates[0].toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} – now`;
            })() : 'No data'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #f5f5f4' }}>
              <span style={{ fontSize: 12, color: '#78746c' }}>{k}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1c1917', fontFamily: 'DM Mono,monospace' }}>{v}</span>
            </div>
          ))}
          <div style={{ fontSize: 10, color: '#c7c4be', marginTop: 4, lineHeight: 1.4 }}>
            All data stays in your Firestore. The AI sees it per-request only.
          </div>
        </div>
      </div>
    </div>
  );
}