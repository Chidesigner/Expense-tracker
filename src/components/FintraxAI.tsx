// components/FintraxAI.tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { auth, db } from '../firebase';
import {
  collection, query, where, onSnapshot,
  addDoc, deleteDoc, updateDoc, doc,
  setDoc, getDoc,
} from 'firebase/firestore';
import {
  callClaude, buildSystemPrompt, buildFinancialContext,
  parseAgentResponse, detectAnomalies,
  ChatMessage, Expense, AgentAction,
} from '../lib/ai';
import { useCurrency } from '../context/CurrencyContext';
import { useUserProfile } from '../hooks/useUserprofile';
import {
  Sparkles, X, Maximize2, Send, Bot,
  PlusCircle, Trash2, PenLine, Loader2,
  AlertTriangle, Lightbulb, RotateCcw,
  Mic, MicOff, Volume2, VolumeX,
} from 'lucide-react';

// ─── MARKDOWN RENDERER ────────────────────────────────────────────────────────
function renderMessage(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:#f1f0ee;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:0.88em">$1</code>')
    .replace(/\n\n/g, '</p><p style="margin:8px 0 0">')
    .replace(/\n/g, '<br/>');
}

// ─── TYPING DOTS ──────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '10px 14px' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#818cf8', animation: `typingBounce 1.2s ease-in-out ${i*0.2}s infinite` }} />
      ))}
      <style>{`@keyframes typingBounce{0%,60%,100%{transform:translateY(0);opacity:0.4}30%{transform:translateY(-6px);opacity:1}}`}</style>
    </div>
  );
}

// ─── ACTION BADGE ─────────────────────────────────────────────────────────────
function ActionBadge({ action }: { action: AgentAction }) {
  if (action.type === 'NONE') return null;
  const map: Record<string, { icon: React.ReactNode; text: string; color: string; bg: string }> = {
    ADD_EXPENSE:    { icon: <PlusCircle size={11} />, text: 'Expense added',   color: '#15803d', bg: '#f0fdf4' },
    DELETE_EXPENSE: { icon: <Trash2 size={11} />,     text: 'Expense deleted', color: '#e11d48', bg: '#fff1f2' },
    UPDATE_EXPENSE: { icon: <PenLine size={11} />,    text: 'Expense updated', color: '#d97706', bg: '#fffbeb' },
  };
  const m = map[action.type];
  if (!m) return null;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, padding: '3px 10px', background: m.bg, color: m.color, borderRadius: 99, fontSize: 11, fontWeight: 600, border: `1px solid ${m.color}22` }}>
      {m.icon} {m.text}
    </div>
  );
}

// ─── QUICK PROMPTS ────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  'How much did I spend this month?',
  "What's my top spending category?",
  'Am I spending more than last month?',
  'Give me a savings tip',
  'Show my biggest expenses',
];

// ─── CHAT HISTORY ─────────────────────────────────────────────────────────────
interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actionType?: string;
}

async function loadChatHistory(userId: string): Promise<ChatMessage[]> {
  try {
    const snap = await getDoc(doc(db, 'chatHistory', userId));
    if (!snap.exists()) return [];
    const stored: StoredMessage[] = snap.data().messages || [];
    return stored.map(m => ({
      role:      m.role,
      content:   m.content,
      timestamp: new Date(m.timestamp),
      action:    m.actionType ? { type: m.actionType as AgentAction['type'] } : undefined,
    }));
  } catch { return []; }
}

async function saveChatHistory(userId: string, messages: ChatMessage[]) {
  try {
    const stored: StoredMessage[] = messages
      .filter(m => !m.isTyping)
      .slice(-50)
      .map(m => ({
        role:       m.role,
        content:    m.content,
        timestamp:  m.timestamp.toISOString(),
        actionType: m.action?.type,
      }));
    await setDoc(doc(db, 'chatHistory', userId), { messages: stored, updatedAt: new Date() });
  } catch { /* silent */ }
}

// ─── VOICE HOOK ───────────────────────────────────────────────────────────────
function useVoice(onTranscript: (text: string) => void) {
  const [listening,   setListening]   = useState(false);
  const [supported,   setSupported]   = useState(false);
  const [speaking,    setSpeaking]    = useState(false);
  const [ttsEnabled,  setTtsEnabled]  = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous      = false;
      rec.interimResults  = false;
      rec.lang            = 'en-US';
      rec.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        onTranscript(transcript);
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recognitionRef.current = rec;
    }
  }, [onTranscript]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || listening) return;
    // Stop any ongoing TTS before listening
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setListening(true);
    recognitionRef.current.start();
  }, [listening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !listening) return;
    recognitionRef.current.stop();
    setListening(false);
  }, [listening]);

  const speak = useCallback((text: string) => {
    if (!ttsEnabled || !window.speechSynthesis) return;
    // Strip markdown for speech
    const clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/<[^>]*>/g, '')
      .substring(0, 500); // cap at 500 chars for voice

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate   = 1.05;
    utterance.pitch  = 1;
    utterance.volume = 1;

    // Try to use a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Alex')
    );
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend   = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [ttsEnabled]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  return { listening, supported, speaking, ttsEnabled, setTtsEnabled, startListening, stopListening, speak, stopSpeaking };
}

// ─── VOICE WAVEFORM ANIMATION ─────────────────────────────────────────────────
function VoiceWaveform() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 20 }}>
      {[0,1,2,3,4].map(i => (
        <div key={i} style={{
          width: 3, borderRadius: 99,
          background: 'white',
          animation: `wave 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
        }} />
      ))}
      <style>{`
        @keyframes wave {
          0%  { height: 4px;  opacity: 0.4; }
          100%{ height: 16px; opacity: 1;   }
        }
      `}</style>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
interface FintraxAIProps {
  mode?: 'floating' | 'page';
  initialOpen?: boolean;
}

export default function FintraxAI({ mode = 'floating', initialOpen = false }: FintraxAIProps) {
  const [open,          setOpen]          = useState(initialOpen);
  const [messages,      setMessages]      = useState<ChatMessage[]>([]);
  const [input,         setInput]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [expenses,      setExpenses]      = useState<Expense[]>([]);
  const [anomalies,     setAnomalies]     = useState<ReturnType<typeof detectAnomalies>>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const { symbol }     = useCurrency();
  const user           = auth.currentUser;
  const { profile }    = useUserProfile(user);

  // Voice
  const handleTranscript = useCallback((text: string) => {
    setInput(text);
    // Auto-send after voice input
    setTimeout(() => sendMessage(text), 300);
  }, []);

  const voice = useVoice(handleTranscript);

  // Load expenses
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'expenses'), where('userId', '==', user.uid));
    return onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
      setExpenses(data);
      setAnomalies(detectAnomalies(data, symbol));
    });
  }, [user, symbol]);

  // Load chat history
  useEffect(() => {
    if (!user || historyLoaded) return;
    loadChatHistory(user.uid).then(history => {
      if (history.length > 0) {
        setMessages(history);
      } else {
        const name = profile?.displayName || profile?.username || 'there';
        setMessages([{
          role:      'assistant',
          content:   `Hey ${name}! 👋 I'm your Fintrax AI — I know every transaction in your account.\n\nAsk me anything about your spending, or tell me to add/delete expenses. You can also tap the mic to talk to me!`,
          timestamp: new Date(),
          action:    { type: 'NONE' },
        }]);
      }
      setHistoryLoaded(true);
    });
  }, [user, profile, historyLoaded]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus on open
  useEffect(() => {
    if (open && mode === 'floating') setTimeout(() => inputRef.current?.focus(), 100);
  }, [open, mode]);

  // Execute action
  const executeAction = useCallback(async (action: AgentAction) => {
    if (!user || action.type === 'NONE') return;
    try {
      if (action.type === 'ADD_EXPENSE' && action.payload)
        await addDoc(collection(db, 'expenses'), { ...action.payload, userId: user.uid, createdAt: new Date() });
      else if (action.type === 'DELETE_EXPENSE' && action.payload?.id)
        await deleteDoc(doc(db, 'expenses', action.payload.id));
      else if (action.type === 'UPDATE_EXPENSE' && action.payload?.id) {
        const { id, ...rest } = action.payload;
        await updateDoc(doc(db, 'expenses', id), rest);
      }
    } catch (err) { console.error('Action error:', err); }
  }, [user]);

  // Clear history
  const clearHistory = useCallback(async () => {
    if (!user) return;
    const name = profile?.displayName || profile?.username || 'there';
    const welcome: ChatMessage = {
      role: 'assistant',
      content: `Fresh start! What can I help you with, ${name}?`,
      timestamp: new Date(),
      action: { type: 'NONE' },
    };
    setMessages([welcome]);
    await setDoc(doc(db, 'chatHistory', user.uid), { messages: [], updatedAt: new Date() });
  }, [user, profile]);

  // Send message
  const sendMessage = useCallback(async (text?: string) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;
    setInput('');
    voice.stopSpeaking();

    const userMsg: ChatMessage = { role: 'user', content: userText, timestamp: new Date() };
    const base = [...messages.filter(m => !m.isTyping), userMsg];
    setMessages([...base, { role: 'assistant', content: '', timestamp: new Date(), isTyping: true }]);
    setLoading(true);

    try {
      const ctx = buildFinancialContext(expenses, profile, symbol);
      const sys = buildSystemPrompt(ctx);
      const history = base.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const raw = await callClaude([...history, { role: 'user', content: userText }], sys);
      const { message, action } = parseAgentResponse(raw);
      if (action.type !== 'NONE') await executeAction(action);

      const final: ChatMessage[] = [...base, { role: 'assistant', content: message, timestamp: new Date(), action }];
      setMessages(final);
      if (user) saveChatHistory(user.uid, final);

      // Speak the response if TTS enabled
      if (voice.ttsEnabled) voice.speak(message);

    } catch {
      setMessages(prev => [...prev.filter(m => !m.isTyping), {
        role: 'assistant', content: 'Sorry, hit a snag. Try again in a moment.',
        timestamp: new Date(), action: { type: 'NONE' },
      }]);
    }
    setLoading(false);
  }, [input, loading, messages, expenses, profile, symbol, executeAction, user, voice]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Shared chat content ──────────────────────────────────────────────────────
  const chatContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Anomaly banners */}
      {anomalies.length > 0 && messages.length <= 1 && (
        <div style={{ padding: '8px 14px', borderBottom: '1px solid #f5f5f4' }}>
          {anomalies.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', marginBottom: i < anomalies.length-1 ? 4 : 0, background: a.severity === 'warning' ? '#fffbeb' : '#eff6ff', border: `1px solid ${a.severity === 'warning' ? '#fcd34d' : '#bfdbfe'}`, borderRadius: 8, fontSize: 12 }}>
              {a.severity === 'warning'
                ? <AlertTriangle size={13} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
                : <Lightbulb size={13} color="#3b82f6" style={{ flexShrink: 0, marginTop: 1 }} />
              }
              <div>
                <div style={{ fontWeight: 600, color: '#1c1917', marginBottom: 1 }}>{a.title}</div>
                <div style={{ color: '#78746c', lineHeight: 1.4 }}>{a.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 8, animation: 'msgIn 0.2s ease' }}>
            {msg.role === 'assistant' && (
              <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }}>
                <Bot size={13} color="white" />
              </div>
            )}
            <div style={{ maxWidth: '82%' }}>
              {msg.isTyping ? (
                <div style={{ background: '#f5f5f4', borderRadius: '18px 18px 18px 4px', display: 'inline-block' }}><TypingDots /></div>
              ) : (
                <>
                  <div style={{ padding: '10px 14px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: msg.role === 'user' ? 'linear-gradient(135deg,#4f46e5,#6366f1)' : '#f5f5f4', color: msg.role === 'user' ? 'white' : '#1c1917', fontSize: 13, lineHeight: 1.55, boxShadow: msg.role === 'user' ? '0 2px 8px rgba(99,102,241,0.3)' : '0 1px 3px rgba(0,0,0,0.06)' }}>
                    {msg.role === 'assistant'
                      ? <div dangerouslySetInnerHTML={{ __html: `<p style="margin:0">${renderMessage(msg.content)}</p>` }} />
                      : msg.content
                    }
                  </div>
                  {msg.action && <ActionBadge action={msg.action} />}
                  <div style={{ fontSize: 10, color: '#a8a49d', marginTop: 4, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                    {msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts */}
      {messages.length === 1 && (
        <div style={{ padding: '0 14px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {QUICK_PROMPTS.map((p, i) => (
            <button key={i} onClick={() => sendMessage(p)} style={{ padding: '5px 10px', background: 'white', border: '1px solid #e7e5e0', borderRadius: 99, fontSize: 11, fontWeight: 500, color: '#57534e', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#818cf8'; (e.currentTarget as HTMLButtonElement).style.color = '#4f46e5'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e7e5e0'; (e.currentTarget as HTMLButtonElement).style.color = '#57534e'; }}
            >{p}</button>
          ))}
        </div>
      )}

      {/* Voice listening overlay */}
      {voice.listening && (
        <div style={{ margin: '0 14px 8px', padding: '12px 16px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <VoiceWaveform />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'white', flex: 1 }}>Listening… speak now</span>
          <button onClick={voice.stopListening} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: '4px 8px', color: 'white', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Cancel</button>
        </div>
      )}

      {/* Input bar */}
      <div style={{ borderTop: '1px solid #f5f5f4', padding: '10px 12px', display: 'flex', gap: 6, alignItems: 'flex-end', background: '#fff' }}>
        <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
          placeholder={voice.listening ? 'Listening…' : 'Ask anything or give a command…'}
          rows={1} disabled={loading || voice.listening}
          style={{ flex: 1, resize: 'none', border: '1px solid #e7e5e0', borderRadius: 12, padding: '9px 12px', fontSize: 13, fontFamily: "'DM Sans',sans-serif", color: '#1c1917', background: loading || voice.listening ? '#fafaf9' : '#fff', outline: 'none', lineHeight: 1.5, maxHeight: 100, transition: 'all 0.15s', overflowY: 'auto' }}
          onFocus={e => { e.target.style.borderColor = '#818cf8'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
          onBlur={e => { e.target.style.borderColor = '#e7e5e0'; e.target.style.boxShadow = 'none'; }}
          onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = `${Math.min(t.scrollHeight, 100)}px`; }}
        />

        {/* Voice mic button */}
        {voice.supported && (
          <button
            onClick={voice.listening ? voice.stopListening : voice.startListening}
            title={voice.listening ? 'Stop listening' : 'Voice input'}
            style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none', flexShrink: 0,
              background: voice.listening ? '#e11d48' : '#f3f4f6',
              color: voice.listening ? 'white' : '#6b7280',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
              boxShadow: voice.listening ? '0 0 0 4px rgba(225,29,72,0.2)' : 'none',
              animation: voice.listening ? 'micPulse 1.5s ease infinite' : 'none',
            }}>
            {voice.listening ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
        )}

        {/* TTS toggle */}
        {voice.supported && (
          <button
            onClick={() => { voice.setTtsEnabled(v => !v); if (voice.speaking) voice.stopSpeaking(); }}
            title={voice.ttsEnabled ? 'Mute AI voice' : 'Unmute AI voice'}
            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', flexShrink: 0, background: '#f3f4f6', color: voice.ttsEnabled ? '#6366f1' : '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
            {voice.speaking ? <Volume2 size={14} style={{ animation: 'pulse 1s ease infinite' }} /> : voice.ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
        )}

        {/* Send button */}
        <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
          style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', flexShrink: 0, background: !input.trim() || loading ? '#e7e5e0' : 'linear-gradient(135deg,#4f46e5,#6366f1)', color: !input.trim() || loading ? '#a8a49d' : 'white', cursor: !input.trim() || loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', boxShadow: !input.trim() || loading ? 'none' : '0 2px 8px rgba(99,102,241,0.35)' }}>
          {loading ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Send size={13} />}
        </button>
      </div>
    </div>
  );

  // ── PAGE MODE ────────────────────────────────────────────────────────────────
  if (mode === 'page') {
    return (
      <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans',sans-serif" }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #eeede9', display: 'flex', alignItems: 'center', gap: 14, background: '#fff', flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
            <Sparkles size={18} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em', margin: 0 }}>Fintrax AI</h2>
            <p style={{ fontSize: 11, color: '#a8a49d', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 5 }}>
              {expenses.length} transactions loaded
              {voice.supported && <span style={{ padding: '1px 6px', background: '#eef2ff', color: '#6366f1', borderRadius: 99, fontWeight: 600 }}>🎤 Voice on</span>}
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={clearHistory} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'transparent', border: '1px solid #e7e5e0', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#78746c', fontFamily: 'inherit' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#fca5a5'; (e.currentTarget as HTMLButtonElement).style.color = '#e11d48'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e7e5e0'; (e.currentTarget as HTMLButtonElement).style.color = '#78746c'; }}>
              <RotateCcw size={11} /> Clear
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 99 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s ease infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#15803d' }}>Online</span>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, background: '#fafaf9', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {chatContent}
        </div>
        <style>{`
          @keyframes msgIn  { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
          @keyframes spin   { to{transform:rotate(360deg)} }
          @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
          @keyframes micPulse { 0%,100%{box-shadow:0 0 0 4px rgba(225,29,72,0.2)} 50%{box-shadow:0 0 0 8px rgba(225,29,72,0.1)} }
        `}</style>
      </div>
    );
  }

  // ── FLOATING MODE ────────────────────────────────────────────────────────────
  return (
    <>
      {open && (
        <div style={{ position: 'fixed', bottom: 88, right: 24, width: 380, height: 580, background: '#fff', borderRadius: 20, border: '1px solid #e7e5e0', boxShadow: '0 24px 64px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 1000, animation: 'panelIn 0.25s cubic-bezier(0.16,1,0.3,1)', fontFamily: "'DM Sans',sans-serif" }}>
          <div style={{ padding: '13px 15px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={14} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Fintrax AI</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80' }} />
                {expenses.length} transactions
                {voice.supported && <span style={{ marginLeft: 4 }}>· 🎤 voice</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { icon: <RotateCcw size={12} />, action: () => clearHistory(), title: 'Clear' },
                { icon: <Maximize2 size={12} />, href: '/ai', title: 'Expand' },
                { icon: <X size={14} />, action: () => setOpen(false), title: 'Close' },
              ].map((btn, i) => (
                btn.href
                  ? <a key={i} href={btn.href} title={btn.title} style={{ width: 27, height: 27, borderRadius: 7, background: 'rgba(255,255,255,0.15)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.25)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.15)'; }}>
                      {btn.icon}
                    </a>
                  : <button key={i} onClick={btn.action} title={btn.title} style={{ width: 27, height: 27, borderRadius: 7, background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.25)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)'; }}>
                      {btn.icon}
                    </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fafaf9' }}>
            {chatContent}
          </div>
        </div>
      )}

      {/* FAB */}
      <button onClick={() => setOpen(v => !v)} style={{ position: 'fixed', bottom: 24, right: 24, width: 56, height: 56, borderRadius: '50%', background: open ? '#1c1917' : 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none', cursor: 'pointer', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(99,102,241,0.45)', transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}>
        {open ? <X size={18} color="white" /> : <Sparkles size={22} color="white" />}
        {!open && anomalies.length > 0 && <div style={{ position: 'absolute', top: 4, right: 4, width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', border: '2px solid white' }} />}
      </button>

      <style>{`
        @keyframes panelIn { from{opacity:0;transform:translateY(16px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes msgIn   { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes micPulse { 0%,100%{box-shadow:0 0 0 4px rgba(225,29,72,0.2)} 50%{box-shadow:0 0 0 8px rgba(225,29,72,0.1)} }
      `}</style>
    </>
  );
}