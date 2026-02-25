// pages/ChatHistory.tsx
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { MessageSquareText, Bot, User, Trash2, Search, ArrowRight, Sparkles, Clock } from 'lucide-react';
import { AgentAction } from '../lib/ai';

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
    .replace(/`(.*?)`/g, '<code style="background:#f1f0ee;padding:1px 4px;border-radius:3px;font-size:0.87em">$1</code>')
    .replace(/\n/g, '<br/>');
}

function ActionTag({ type }: { type: string }) {
  if (type === 'NONE' || !type) return null;
  const map: Record<string, { label: string; color: string; bg: string }> = {
    ADD_EXPENSE:    { label: 'Added expense',   color: '#15803d', bg: '#f0fdf4' },
    DELETE_EXPENSE: { label: 'Deleted expense', color: '#e11d48', bg: '#fff1f2' },
    UPDATE_EXPENSE: { label: 'Updated expense', color: '#d97706', bg: '#fffbeb' },
  };
  const m = map[type];
  if (!m) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: m.bg, color: m.color, marginTop: 4 }}>
      {m.label}
    </span>
  );
}

export default function ChatHistory() {
  const [messages, setMessages]   = useState<StoredMessage[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [clearing, setClearing]   = useState(false);
  const navigate = useNavigate();
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'chatHistory', user.uid)).then(snap => {
      if (snap.exists()) setMessages(snap.data().messages || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  const clearHistory = async () => {
    if (!user || !confirm('Clear all chat history? This cannot be undone.')) return;
    setClearing(true);
    await setDoc(doc(db, 'chatHistory', user.uid), { messages: [], updatedAt: new Date() });
    setMessages([]);
    setClearing(false);
  };

  const filtered = messages.filter(m =>
    m.content.toLowerCase().includes(search.toLowerCase())
  );

  // Group messages into conversations by date
  const grouped: Record<string, StoredMessage[]> = {};
  filtered.forEach(m => {
    const d = new Date(m.timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(m);
  });

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '28px 20px', fontFamily: "'DM Sans',sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquareText size={18} color="white" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', letterSpacing: '-0.03em', margin: 0 }}>Chat History</h1>
          </div>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            {messages.length} messages saved · synced across devices
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/ai')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'linear-gradient(135deg,#4f46e5,#6366f1)', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}>
            <Sparkles size={13} /> New chat <ArrowRight size={13} />
          </button>
          {messages.length > 0 && (
            <button onClick={clearHistory} disabled={clearing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Trash2 size={13} /> {clearing ? 'Clearing…' : 'Clear all'}
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      {messages.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search your conversations…"
            style={{ width: '100%', padding: '10px 14px 10px 36px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box', transition: 'all 0.15s' }}
            onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
            onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; e.target.style.boxShadow = 'none'; }}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
          <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 13 }}>Loading history…</div>
        </div>
      )}

      {/* Empty */}
      {!loading && messages.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f9fafb', borderRadius: 16, border: '1px dashed #e5e7eb' }}>
          <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <MessageSquareText size={24} color="#6366f1" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 6 }}>No chat history yet</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 18 }}>Start a conversation with Fintrax AI to see it here.</div>
          <button onClick={() => navigate('/ai')} style={{ padding: '10px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Sparkles size={13} /> Open Fintrax AI
          </button>
        </div>
      )}

      {/* No search results */}
      {!loading && messages.length > 0 && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
          <Search size={28} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.4 }} />
          <div style={{ fontSize: 14 }}>No messages match "{search}"</div>
        </div>
      )}

      {/* Messages grouped by date */}
      {!loading && Object.entries(grouped).map(([dateLabel, msgs]) => (
        <div key={dateLabel} style={{ marginBottom: 28 }}>
          {/* Date divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: '#f3f4f6', borderRadius: 99 }}>
              <Clock size={10} color="#9ca3af" />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>{dateLabel}</span>
            </div>
            <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
          </div>

          {/* Message bubbles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {msgs.map((msg, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 10 }}>
                {/* Avatar */}
                <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: msg.role === 'assistant' ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                  {msg.role === 'assistant'
                    ? <Bot size={14} color="white" />
                    : <User size={14} color="#6b7280" />
                  }
                </div>

                {/* Bubble */}
                <div style={{ maxWidth: '78%' }}>
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: msg.role === 'user' ? 'linear-gradient(135deg,#4f46e5,#6366f1)' : '#f3f4f6',
                    color: msg.role === 'user' ? 'white' : '#111827',
                    fontSize: 13, lineHeight: 1.6,
                    boxShadow: msg.role === 'user' ? '0 2px 8px rgba(99,102,241,0.25)' : '0 1px 3px rgba(0,0,0,0.05)',
                  }}>
                    {msg.role === 'assistant'
                      ? <div dangerouslySetInnerHTML={{ __html: renderMessage(msg.content) }} />
                      : msg.content
                    }
                  </div>
                  {msg.actionType && msg.actionType !== 'NONE' && <ActionTag type={msg.actionType} />}
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                    {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <style>{`@keyframes spin { to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}