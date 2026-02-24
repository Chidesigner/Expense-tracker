// components/FintraxAI.tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { auth, db } from '../firebase';
import {
  collection, query, where, onSnapshot,
  addDoc, deleteDoc, updateDoc, doc,
} from 'firebase/firestore';
import {
  callClaude, buildSystemPrompt, buildFinancialContext,
  parseAgentResponse, detectAnomalies,
  ChatMessage, Expense, AgentAction,
} from '../lib/ai';
import { useCurrency } from '../context/CurrencyContext';
import { useUserProfile } from '../hooks/useUserprofile';

// ─── MARKDOWN-LITE RENDERER ───────────────────────────────────────────────────
function renderMessage(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:#f1f0ee;padding:1px 5px;border-radius:3px;font-family:DM Mono,monospace;font-size:0.88em">$1</code>')
    .replace(/\n\n/g, '</p><p style="margin:8px 0 0">')
    .replace(/\n/g, '<br/>');
}

// ─── TYPING INDICATOR ─────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '10px 14px' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%', background: '#818cf8',
          animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── ACTION CONFIRMATION BADGE ────────────────────────────────────────────────
function ActionBadge({ action }: { action: AgentAction }) {
  if (action.type === 'NONE') return null;
  const labels: Record<string, { icon: string; text: string; color: string; bg: string }> = {
    ADD_EXPENSE:    { icon: '✚', text: 'Expense added',   color: '#15803d', bg: '#f0fdf4' },
    DELETE_EXPENSE: { icon: '✕', text: 'Expense deleted', color: '#e11d48', bg: '#fff1f2' },
    UPDATE_EXPENSE: { icon: '✎', text: 'Expense updated', color: '#d97706', bg: '#fffbeb' },
  };
  const meta = labels[action.type];
  if (!meta) return null;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      marginTop: 8, padding: '3px 10px',
      background: meta.bg, color: meta.color,
      borderRadius: 99, fontSize: 11, fontWeight: 600,
      border: `1px solid ${meta.color}22`,
    }}>
      <span>{meta.icon}</span> {meta.text}
    </div>
  );
}

// ─── QUICK PROMPT CHIPS ───────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  'How much did I spend this month?',
  'What\'s my top spending category?',
  'Am I spending more than last month?',
  'Give me a savings tip based on my data',
  'Show me my biggest expenses',
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
interface FintraxAIProps {
  mode?: 'floating' | 'page';
  initialOpen?: boolean;
}

export default function FintraxAI({ mode = 'floating', initialOpen = false }: FintraxAIProps) {
  const [open, setOpen]           = useState(initialOpen);
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [expenses, setExpenses]   = useState<Expense[]>([]);
  const [anomalies, setAnomalies] = useState<ReturnType<typeof detectAnomalies>>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const { fmt, symbol } = useCurrency();
  const user            = auth.currentUser;
  const { profile }     = useUserProfile(user);

  // ── Load expenses from Firestore ──
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'expenses'), where('userId', '==', user.uid));
    return onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
      setExpenses(data);
      setAnomalies(detectAnomalies(data, symbol));
    });
  }, [user, symbol]);

  // ── Auto-scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Focus input when opening ──
  useEffect(() => {
    if (open && mode === 'floating') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, mode]);

  // ── Welcome message ──
  useEffect(() => {
    if (messages.length === 0) {
      const name = profile?.displayName || profile?.username || 'there';
      setMessages([{
        role:      'assistant',
        content:   `Hey ${name}! 👋 I'm your Fintrax AI — I know every transaction in your account and I can answer questions, run the numbers, or take actions like adding or deleting expenses.\n\nWhat can I help you with?`,
        timestamp: new Date(),
        action:    { type: 'NONE' },
      }]);
    }
  }, [profile]);

  // ── Execute agent action against Firestore ──
  const executeAction = useCallback(async (action: AgentAction) => {
    if (!user || action.type === 'NONE') return;
    try {
      if (action.type === 'ADD_EXPENSE' && action.payload) {
        await addDoc(collection(db, 'expenses'), {
          ...action.payload,
          userId:    user.uid,
          createdAt: new Date(),
        });
      } else if (action.type === 'DELETE_EXPENSE' && action.payload?.id) {
        await deleteDoc(doc(db, 'expenses', action.payload.id));
      } else if (action.type === 'UPDATE_EXPENSE' && action.payload?.id) {
        const { id, ...rest } = action.payload;
        await updateDoc(doc(db, 'expenses', id), rest);
      }
    } catch (err) {
      console.error('Action execution error:', err);
    }
  }, [user]);

  // ── Send message ──
  const sendMessage = useCallback(async (text?: string) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;

    setInput('');
    const userMsg: ChatMessage = { role: 'user', content: userText, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Add typing indicator
    const typingMsg: ChatMessage = { role: 'assistant', content: '', timestamp: new Date(), isTyping: true };
    setMessages(prev => [...prev, typingMsg]);

    try {
      const financialContext = buildFinancialContext(expenses, profile, symbol);
      const systemPrompt     = buildSystemPrompt(financialContext);

      // Build conversation history (exclude typing indicator, limit to last 10 for context window)
      const history = messages
        .filter(m => !m.isTyping)
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      const rawResponse = await callClaude(
        [...history, { role: 'user', content: userText }],
        systemPrompt,
      );

      const { message, action } = parseAgentResponse(rawResponse);

      // Execute Firestore action if needed
      if (action.type !== 'NONE') await executeAction(action);

      // Replace typing indicator with real response
      setMessages(prev => [
        ...prev.filter(m => !m.isTyping),
        { role: 'assistant', content: message, timestamp: new Date(), action },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev.filter(m => !m.isTyping),
        {
          role:      'assistant',
          content:   'Sorry, I hit a snag connecting to the AI. Check your internet and try again.',
          timestamp: new Date(),
          action:    { type: 'NONE' },
        },
      ]);
    }

    setLoading(false);
  }, [input, loading, messages, expenses, profile, symbol, executeAction]);

  // ── Keyboard handler ──
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Shared chat UI ──
  const chatContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Anomaly banners */}
      {anomalies.length > 0 && messages.length <= 1 && (
        <div style={{ padding: '8px 14px', borderBottom: '1px solid #f5f5f4' }}>
          {anomalies.map((a, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '8px 10px', marginBottom: i < anomalies.length - 1 ? 4 : 0,
              background: a.severity === 'warning' ? '#fffbeb' : '#eff6ff',
              border: `1px solid ${a.severity === 'warning' ? '#fcd34d' : '#bfdbfe'}`,
              borderRadius: 8, fontSize: 12,
            }}>
              <span style={{ fontSize: 14 }}>{a.severity === 'warning' ? '⚠️' : '💡'}</span>
              <div>
                <div style={{ fontWeight: 600, color: '#1c1917', marginBottom: 1 }}>{a.title}</div>
                <div style={{ color: '#78746c', lineHeight: 1.4 }}>{a.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 14px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-start', gap: 8,
            animation: 'msgIn 0.2s ease',
          }}>
            {/* Avatar */}
            {msg.role === 'assistant' && (
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: 'white', marginTop: 2,
              }}>✦</div>
            )}

            {/* Bubble */}
            <div style={{ maxWidth: '82%' }}>
              {msg.isTyping ? (
                <div style={{ background: '#f5f5f4', borderRadius: '18px 18px 18px 4px', display: 'inline-block' }}>
                  <TypingDots />
                </div>
              ) : (
                <>
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: msg.role === 'user'
                      ? '18px 18px 4px 18px'
                      : '18px 18px 18px 4px',
                    background: msg.role === 'user'
                      ? 'linear-gradient(135deg,#4f46e5,#6366f1)'
                      : '#f5f5f4',
                    color:    msg.role === 'user' ? 'white' : '#1c1917',
                    fontSize: 13, lineHeight: 1.55,
                    boxShadow: msg.role === 'user'
                      ? '0 2px 8px rgba(99,102,241,0.3)'
                      : '0 1px 3px rgba(0,0,0,0.06)',
                  }}>
                    {msg.role === 'assistant' ? (
                      <div dangerouslySetInnerHTML={{ __html: `<p style="margin:0">${renderMessage(msg.content)}</p>` }} />
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.action && <ActionBadge action={msg.action} />}
                  <div style={{
                    fontSize: 10, color: '#a8a49d', marginTop: 4,
                    textAlign: msg.role === 'user' ? 'right' : 'left',
                  }}>
                    {msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts — show only when just welcome message */}
      {messages.length === 1 && (
        <div style={{ padding: '0 14px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {QUICK_PROMPTS.map((p, i) => (
            <button key={i} onClick={() => sendMessage(p)} style={{
              padding: '5px 10px', background: 'white', border: '1px solid #e7e5e0',
              borderRadius: 99, fontSize: 11, fontWeight: 500, color: '#57534e',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#818cf8'; (e.currentTarget as HTMLButtonElement).style.color = '#4f46e5'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e7e5e0'; (e.currentTarget as HTMLButtonElement).style.color = '#57534e'; }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={{
        borderTop: '1px solid #f5f5f4', padding: '12px 14px',
        display: 'flex', gap: 8, alignItems: 'flex-end',
        background: '#fff',
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything or give a command…"
          rows={1}
          disabled={loading}
          style={{
            flex: 1, resize: 'none', border: '1px solid #e7e5e0',
            borderRadius: 12, padding: '9px 12px', fontSize: 13,
            fontFamily: "'DM Sans',sans-serif", color: '#1c1917',
            background: loading ? '#fafaf9' : '#fff',
            outline: 'none', lineHeight: 1.5, maxHeight: 100,
            transition: 'border-color 0.15s, box-shadow 0.15s',
            overflowY: 'auto',
          }}
          onFocus={e => { e.target.style.borderColor = '#818cf8'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
          onBlur={e => { e.target.style.borderColor = '#e7e5e0'; e.target.style.boxShadow = 'none'; }}
          onInput={e => {
            const t = e.target as HTMLTextAreaElement;
            t.style.height = 'auto';
            t.style.height = `${Math.min(t.scrollHeight, 100)}px`;
          }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          style={{
            width: 36, height: 36, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: !input.trim() || loading
              ? '#e7e5e0'
              : 'linear-gradient(135deg,#4f46e5,#6366f1)',
            color: !input.trim() || loading ? '#a8a49d' : 'white',
            cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
            boxShadow: !input.trim() || loading ? 'none' : '0 2px 8px rgba(99,102,241,0.35)',
          }}
        >
          {loading ? (
            <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );

  // ─── PAGE MODE ────────────────────────────────────────────────────────────
  if (mode === 'page') {
    return (
      <div style={{
        maxWidth: 760, margin: '0 auto', height: 'calc(100vh - 60px)',
        display: 'flex', flexDirection: 'column',
        fontFamily: "'DM Sans',sans-serif",
        animation: 'pageIn 0.25s ease',
      }}>
        {/* Page header */}
        <div style={{
          padding: '24px 28px 16px', borderBottom: '1px solid #eeede9',
          display: 'flex', alignItems: 'center', gap: 14, background: '#fff',
          flexShrink: 0,
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
          }}>✦</div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c1917', letterSpacing: '-0.03em', marginBottom: 2 }}>
              Fintrax AI
            </h2>
            <p style={{ fontSize: 12, color: '#a8a49d', fontWeight: 500 }}>
              Your personal finance assistant · {expenses.length} transactions loaded
            </p>
          </div>
          <div style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0',
            borderRadius: 99,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s ease infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#15803d' }}>Online</span>
          </div>
        </div>

        {/* Chat */}
        <div style={{ flex: 1, background: '#fafaf9', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {chatContent}
        </div>

        <style>{`
          @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
          @keyframes msgIn  { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
          @keyframes spin   { to{transform:rotate(360deg)} }
          @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        `}</style>
      </div>
    );
  }

  // ─── FLOATING MODE ────────────────────────────────────────────────────────
  return (
    <>
      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 88, right: 24,
          width: 380, height: 560,
          background: '#fff', borderRadius: 20,
          border: '1px solid #e7e5e0',
          boxShadow: '0 24px 64px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', zIndex: 1000,
          animation: 'panelIn 0.25s cubic-bezier(0.16,1,0.3,1)',
          fontFamily: "'DM Sans',sans-serif",
        }}>
          {/* Panel header */}
          <div style={{
            padding: '14px 16px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'white', fontWeight: 700 }}>✦</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'white', letterSpacing: '-0.02em' }}>Fintrax AI</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80' }} />
                {expenses.length} transactions · ready
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <a href="/ai" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.15)',
                color: 'white', fontSize: 12, textDecoration: 'none',
                transition: 'background 0.15s',
              }}
                title="Open full page"
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.25)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.15)'; }}
              >
                ⤢
              </a>
              <button onClick={() => setOpen(false)} style={{
                width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.15)',
                border: 'none', color: 'white', fontSize: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.25)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)'; }}
              >×</button>
            </div>
          </div>

          {/* Chat area */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fafaf9' }}>
            {chatContent}
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          position: 'fixed', bottom: 24, right: 24,
          width: 56, height: 56, borderRadius: '50%',
          background: open ? '#1c1917' : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
          border: 'none', cursor: 'pointer', zIndex: 1001,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(99,102,241,0.45)',
          transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
          transform: open ? 'scale(0.9)' : 'scale(1)',
        }}
        title={open ? 'Close AI' : 'Open Fintrax AI'}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = open ? 'scale(0.85)' : 'scale(1.08)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = open ? 'scale(0.9)' : 'scale(1)'; }}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2l12 12M14 2L2 14" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <span style={{ fontSize: 22, color: 'white', lineHeight: 1 }}>✦</span>
        )}
        {/* Unread dot — shows when panel is closed and there are anomalies */}
        {!open && anomalies.length > 0 && (
          <div style={{
            position: 'absolute', top: 4, right: 4,
            width: 12, height: 12, borderRadius: '50%',
            background: '#f59e0b', border: '2px solid white',
            animation: 'pulse 2s ease infinite',
          }} />
        )}
      </button>

      <style>{`
        @keyframes panelIn { from{opacity:0;transform:translateY(16px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes msgIn   { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </>
  );
}