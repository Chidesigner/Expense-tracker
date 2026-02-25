// pages/ChatHistory.tsx
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquareText, Bot, User as UserIcon, Trash2,
  Search, ArrowRight, Sparkles, Clock, RefreshCw,
} from 'lucide-react';

interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actionType?: string;
}

function renderMessage(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:#f1f0ee;padding:1px 4px;border-radius:3px;font-size:0.87em;font-family:monospace">$1</code>')
    .replace(/\n/g, '<br/>');
}

function ActionTag({ type }: { type: string }) {
  if (!type || type === 'NONE') return null;
  const map: Record<string, { label: string; color: string; bg: string }> = {
    ADD_EXPENSE:    { label: '+ Expense added',   color: '#15803d', bg: '#f0fdf4' },
    DELETE_EXPENSE: { label: '− Expense deleted', color: '#e11d48', bg: '#fff1f2' },
    UPDATE_EXPENSE: { label: '✎ Expense updated', color: '#d97706', bg: '#fffbeb' },
  };
  const m = map[type];
  if (!m) return null;
  return (
    <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: m.bg, color: m.color, marginTop: 5 }}>
      {m.label}
    </span>
  );
}

export default function ChatHistory() {
  const [user, setUser]           = useState<User | null>(null);
  const [messages, setMessages]   = useState<StoredMessage[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [clearing, setClearing]   = useState(false);
  const navigate = useNavigate();

  // Wait for Firebase Auth to resolve
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return unsub;
  }, []);

  // Real-time listener on chatHistory doc
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'chatHistory', user.uid);
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        setMessages(snap.data().messages || []);
      } else {
        setMessages([]);
      }
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user]);

  const clearHistory = async () => {
    if (!user) return;
    if (!window.confirm('Clear all chat history? This cannot be undone.')) return;
    setClearing(true);
    await setDoc(doc(db, 'chatHistory', user.uid), { messages: [], updatedAt: new Date() });
    setClearing(false);
  };

  // Filter
  const filtered = search
    ? messages.filter(m => m.content.toLowerCase().includes(search.toLowerCase()))
    : messages;

  // Group by date
  type GroupMap = Record<string, StoredMessage[]>;
  const grouped: GroupMap = {};
  filtered.forEach(m => {
    const d = new Date(m.timestamp).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(m);
  });

  const dateKeys = Object.keys(grouped).reverse(); // newest first

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 20px', fontFamily: "'DM Sans',sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}>
              <MessageSquareText size={18} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', letterSpacing: '-0.03em', margin: 0 }}>Chat History</h1>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: 0, marginTop: 1 }}>
                {messages.length} messages · synced in real-time
              </p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/ai')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'linear-gradient(135deg,#4f46e5,#6366f1)', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(79,70,229,0.25)', whiteSpace: 'nowrap' }}>
            <Sparkles size={13} /> New chat <ArrowRight size={12} />
          </button>
          {messages.length > 0 && (
            <button onClick={clearHistory} disabled={clearing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: clearing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {clearing ? <RefreshCw size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Trash2 size={13} />}
              {clearing ? 'Clearing…' : 'Clear all'}
            </button>
          )}
        </div>
      </div>

      {/* ── Search ── */}
      {messages.length > 4 && (
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <Search size={14} color="#9ca3af" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your conversations…"
            style={{ width: '100%', padding: '10px 14px 10px 36px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box', transition: 'all 0.15s' }}
            onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
            onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; e.target.style.boxShadow = 'none'; }}
          />
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 13, color: '#9ca3af' }}>Loading your conversations…</div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && messages.length === 0 && (
        <div style={{ textAlign: 'center', padding: '56px 24px', background: 'linear-gradient(135deg,#f9fafb,#f3f4f6)', borderRadius: 20, border: '1px dashed #e5e7eb' }}>
          <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg,#eef2ff,#ede9fe)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 4px 16px rgba(99,102,241,0.15)' }}>
            <MessageSquareText size={26} color="#6366f1" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 6, letterSpacing: '-0.02em' }}>No conversations yet</div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20, lineHeight: 1.5 }}>
            Your chat history with Fintrax AI will appear here.<br />Start a conversation to get going.
          </div>
          <button onClick={() => navigate('/ai')} style={{ padding: '11px 22px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: 'white', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 14px rgba(79,70,229,0.3)' }}>
            <Sparkles size={14} /> Open Fintrax AI
          </button>
        </div>
      )}

      {/* ── No search results ── */}
      {!loading && messages.length > 0 && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
          <Search size={30} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.3 }} />
          <div style={{ fontSize: 14 }}>No messages match "<strong>{search}</strong>"</div>
        </div>
      )}

      {/* ── Conversation groups ── */}
      {!loading && dateKeys.map(dateLabel => (
        <div key={dateLabel} style={{ marginBottom: 32 }}>
          {/* Date divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', background: '#f3f4f6', borderRadius: 99 }}>
              <Clock size={10} color="#9ca3af" />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', whiteSpace: 'nowrap' }}>{dateLabel}</span>
            </div>
            <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
          </div>

          {/* Messages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {grouped[dateLabel].map((msg, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 10 }}>
                {/* Avatar */}
                <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: msg.role === 'assistant' ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, boxShadow: msg.role === 'assistant' ? '0 2px 8px rgba(99,102,241,0.3)' : 'none' }}>
                  {msg.role === 'assistant' ? <Bot size={14} color="white" /> : <UserIcon size={14} color="#6b7280" />}
                </div>
                {/* Bubble */}
                <div style={{ maxWidth: '76%' }}>
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: msg.role === 'user' ? 'linear-gradient(135deg,#4f46e5,#6366f1)' : '#f3f4f6',
                    color: msg.role === 'user' ? 'white' : '#111827',
                    fontSize: 13, lineHeight: 1.6,
                    boxShadow: msg.role === 'user' ? '0 2px 10px rgba(99,102,241,0.25)' : '0 1px 3px rgba(0,0,0,0.05)',
                  }}>
                    {msg.role === 'assistant'
                      ? <div dangerouslySetInnerHTML={{ __html: renderMessage(msg.content) }} />
                      : msg.content
                    }
                  </div>
                  {msg.actionType && <ActionTag type={msg.actionType} />}
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                    {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}