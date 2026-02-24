import { useState, useRef } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { COUNTRIES, DEFAULT_COUNTRY } from './context/CurrencyContext';

// ─── GOOGLE PROVIDER ──────────────────────────────────────────────────────────
const googleProvider = new GoogleAuthProvider();

// ─── PASSWORD ANALYSIS ENGINE ─────────────────────────────────────────────────
function analyzePassword(pw) {
  if (!pw) return null;
  const hasLower   = /[a-z]/.test(pw);
  const hasUpper   = /[A-Z]/.test(pw);
  const hasDigit   = /[0-9]/.test(pw);
  const hasSpecial = /[^a-zA-Z0-9]/.test(pw);
  let charset = 0;
  if (hasLower)   charset += 26;
  if (hasUpper)   charset += 26;
  if (hasDigit)   charset += 10;
  if (hasSpecial) charset += 32;
  if (charset === 0) charset = 26;
  const combinations = Math.pow(charset, pw.length);
  const entropy      = Math.log2(combinations);
  const seconds      = combinations / 1e10;
  let crackTime;
  if      (seconds < 0.001)          crackTime = '< 1 ms';
  else if (seconds < 1)              crackTime = `${(seconds * 1000).toFixed(0)} ms`;
  else if (seconds < 60)             crackTime = `${seconds.toFixed(1)}s`;
  else if (seconds < 3600)           crackTime = `${(seconds / 60).toFixed(1)} min`;
  else if (seconds < 86400)          crackTime = `${(seconds / 3600).toFixed(1)} hrs`;
  else if (seconds < 86400 * 365)    crackTime = `${(seconds / 86400).toFixed(0)} days`;
  else if (seconds < 86400 * 365 * 1000) crackTime = `${(seconds / (86400 * 365)).toFixed(0)} yrs`;
  else if (seconds < 86400 * 365 * 1e6) crackTime = `${Math.round(seconds / (86400 * 365 * 1000)).toLocaleString()}k yrs`;
  else crackTime = '∞';
  const criteria = [
    { id: 'len8',    label: '8+ chars',  met: pw.length >= 8 },
    { id: 'len12',   label: '12+ chars', met: pw.length >= 12 },
    { id: 'upper',   label: 'Uppercase', met: hasUpper },
    { id: 'lower',   label: 'Lowercase', met: hasLower },
    { id: 'digit',   label: 'Number',    met: hasDigit },
    { id: 'special', label: 'Special',   met: hasSpecial },
  ];
  const metCount = criteria.filter(c => c.met).length;
  const score    = Math.max(pw.length > 0 ? 1 : 0, metCount);
  const levels   = [
    { label: '—',         color: '#94a3b8' },
    { label: 'Critical',  color: '#e63946' },
    { label: 'Weak',      color: '#f4622a' },
    { label: 'Moderate',  color: '#d97706' },
    { label: 'Strong',    color: '#16a34a' },
    { label: 'Excellent', color: '#0369a1' },
  ];
  const combos = combinations > 1e18 ? `10^${Math.round(Math.log10(combinations))}`
    : combinations > 1e12 ? `${(combinations / 1e12).toFixed(0)}T`
    : combinations > 1e9  ? `${(combinations / 1e9).toFixed(0)}B`
    : combinations > 1e6  ? `${(combinations / 1e6).toFixed(0)}M`
    : combinations.toLocaleString();
  return { score, level: levels[Math.min(score, 5)], entropy: entropy.toFixed(1), charset, combos, crackTime, criteria };
}

function PasswordStrengthPanel({ password }) {
  const a = analyzePassword(password);
  if (!a) return null;
  const { score, level, entropy, charset, combos, crackTime, criteria } = a;
  return (
    <div style={{ marginTop: 8, padding: '12px 14px', background: '#fafaf9', border: '1px solid #e7e5e0', borderLeft: `3px solid ${level.color}`, borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 8px', background: level.color, color: 'white', borderRadius: 3 }}>{level.label}</span>
          <span style={{ fontSize: '0.7rem', color: '#78746c' }}>{score}/5</span>
        </div>
        <span style={{ fontSize: '0.65rem', color: '#a8a49d', fontFamily: 'DM Mono,monospace' }}>{entropy} bits</span>
      </div>
      <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= score ? level.color : '#e7e5e0', transition: 'background 0.3s' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px', marginBottom: 10 }}>
        {criteria.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', color: c.met ? '#16a34a' : '#a8a49d' }}>
            <span style={{ fontSize: '0.6rem' }}>{c.met ? '✓' : '○'}</span>{c.label}
          </div>
        ))}
      </div>
      <div style={{ padding: '7px 10px', background: 'rgba(0,0,0,0.03)', borderRadius: 5 }}>
        <div style={{ fontSize: '0.58rem', color: '#a8a49d', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Crack time · 10B/sec</div>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: level.color, fontFamily: 'DM Mono,monospace' }}>{crackTime}</div>
        <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
          {[{ l: 'Charset', v: charset }, { l: 'Combos', v: combos }].map(s => (
            <div key={s.l} style={{ fontSize: '0.62rem', color: '#a8a49d' }}>
              <span style={{ fontWeight: 600, color: '#57534e', fontFamily: 'DM Mono,monospace' }}>{s.v}</span> {s.l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── BRAND PANEL ──────────────────────────────────────────────────────────────
function BrandPanel() {
  const cards = [
    { title: 'Grocery run',  category: 'Food',      amount: '$48.20', flag: '🇺🇸', delay: '0s' },
    { title: 'Uber to work', category: 'Transport', amount: '£12.50', flag: '🇬🇧', delay: '0.15s' },
    { title: 'Netflix',      category: 'Bills',     amount: '₦4,990', flag: '🇳🇬', delay: '0.3s' },
    { title: 'New sneakers', category: 'Shopping',  amount: 'R 820',  flag: '🇿🇦', delay: '0.45s' },
    { title: 'Dinner out',   category: 'Food',      amount: '€34.00', flag: '🇪🇺', delay: '0.6s' },
  ];
  const catColors = { Food: '#fef3c7', Transport: '#dbeafe', Bills: '#f3f4f6', Shopping: '#fce7f3' };
  const catIcons  = { Food: '🛒', Transport: '🚗', Bills: '📺', Shopping: '👟' };

  return (
    <div style={{ flex: 1, background: 'linear-gradient(145deg,#1e1b4b 0%,#312e81 50%,#4338ca 100%)', padding: '48px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden', minHeight: '100vh' }}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(129,140,248,0.15) 0%,transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '-10%', left: '-10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.12) 0%,transparent 70%)' }} />
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04 }}>
          <defs><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.5" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      <div style={{ marginBottom: 36, position: 'relative', animation: 'fadeUp 0.5s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#4338ca' }}>FT</div>
          <span style={{ color: 'white', fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em' }}>Fintrax</span>
        </div>
        <h2 style={{ color: 'white', fontSize: 28, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.25, marginBottom: 10 }}>
          Track expenses<br />in any currency.
        </h2>
        <p style={{ color: 'rgba(199,210,254,0.75)', fontSize: 14, lineHeight: 1.6, maxWidth: 320 }}>
          Whether you're in Lagos, London, or Los Angeles — Fintrax works in your currency, your language, your life.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24, animation: 'fadeUp 0.5s 0.1s ease both' }}>
        {['🇳🇬 ₦', '🇺🇸 $', '🇬🇧 £', '🇪🇺 €', '🇬🇭 GH₵', '🇰🇪 KSh', '🇿🇦 R'].map((c, i) => (
          <span key={i} style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 99, fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{c}</span>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, animation: 'fadeUp 0.5s 0.2s ease both' }}>
        <div style={{ fontSize: 11, color: 'rgba(199,210,254,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Live Transactions</div>
        {cards.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', animation: `fadeUp 0.4s ${c.delay} ease both` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: catColors[c.category] || '#f5f5f4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                {catIcons[c.category] || '📦'}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>{c.title}</div>
                <div style={{ fontSize: 11, color: 'rgba(199,210,254,0.5)' }}>{c.flag} {c.category}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'white', fontFamily: 'DM Mono,monospace' }}>{c.amount}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 28, animation: 'fadeUp 0.5s 0.4s ease both' }}>
        <span style={{ fontSize: 12, color: 'rgba(199,210,254,0.6)' }}>
          🌍 Used in <strong style={{ color: 'rgba(199,210,254,0.9)' }}>24+</strong> countries
        </span>
      </div>
      <style>{`@keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  );
}

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%', padding: '10px 14px', background: '#fafaf9',
  border: '1px solid #e7e5e0', borderRadius: 8, fontSize: 14,
  fontFamily: "'DM Sans',sans-serif", color: '#1c1917', outline: 'none',
  transition: 'border-color 0.15s,box-shadow 0.15s', WebkitAppearance: 'none',
};
const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#44403c',
  marginBottom: 6, letterSpacing: '0.02em', textTransform: 'uppercase',
};
const focusIn  = e => { e.target.style.borderColor = '#818cf8'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; };
const focusOut = e => { e.target.style.borderColor = '#e7e5e0'; e.target.style.boxShadow = 'none'; };

// ─── GOOGLE BUTTON ────────────────────────────────────────────────────────────
function GoogleButton({ onClick, loading, label = 'Continue with Google' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        padding: '10px 20px', background: '#fff', border: '1px solid #e7e5e0',
        borderRadius: 8, fontSize: 14, fontWeight: 500, color: '#1c1917',
        fontFamily: "'DM Sans',sans-serif", cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.6 : 1,
        transition: 'all 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
      onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#d4d2cd'; }}}
      onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e7e5e0'; }}
    >
      {/* Google icon SVG */}
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
        <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z" fill="#FBBC05" />
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
      </svg>
      {label}
    </button>
  );
}

// ─── USERNAME VALIDATOR ───────────────────────────────────────────────────────
function validateUsername(u) {
  if (!u) return 'Username is required';
  if (u.length < 3) return 'At least 3 characters';
  if (u.length > 24) return 'Max 24 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(u)) return 'Only letters, numbers, underscores';
  return null;
}

// ─── LOGIN COMPONENT ──────────────────────────────────────────────────────────
function Login() {
  const [isLogin, setIsLogin]                 = useState(true);
  const [email, setEmail]                     = useState('');
  const [username, setUsername]               = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY);
  const [message, setMessage]                 = useState('');
  const [messageType, setMessageType]         = useState('error');
  const [loading, setLoading]                 = useState(false);
  const [googleLoading, setGoogleLoading]     = useState(false);
  const [showPassword, setShowPassword]       = useState(false);
  const [isRateLimited, setIsRateLimited]     = useState(false);
  const failedAttemptsRef                     = useRef([]);

  const isValidEmail = e => e.includes('@') && e.includes('.');
  const analysis     = analyzePassword(password);
  const isWeak       = analysis && analysis.score <= 2;
  const usernameError = !isLogin ? validateUsername(username) : null;

  const setMsg = (text, type = 'error') => { setMessage(text); setMessageType(type); };

  const checkRateLimit = () => {
    const now = Date.now();
    failedAttemptsRef.current = failedAttemptsRef.current.filter(t => t > now - 60000);
    if (failedAttemptsRef.current.length >= 5) {
      setIsRateLimited(true);
      setMsg('Too many failed attempts. Please wait 60 seconds.');
      setTimeout(() => { setIsRateLimited(false); failedAttemptsRef.current = []; setMessage(''); }, 60000);
      return false;
    }
    return true;
  };

  // ── Google Sign-In ──
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setMessage('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user   = result.user;
      // Check if user doc already exists; if not, create one
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (!snap.exists()) {
        const derivedUsername = user.displayName
          ? user.displayName.replace(/\s+/g, '').toLowerCase().slice(0, 20)
          : user.email.split('@')[0].slice(0, 20);
        await setDoc(doc(db, 'users', user.uid), {
          email:       user.email,
          username:    derivedUsername,
          displayName: user.displayName || derivedUsername,
          photoURL:    user.photoURL || null,
          countryCode: DEFAULT_COUNTRY.code,
          country:     DEFAULT_COUNTRY.name,
          currency:    DEFAULT_COUNTRY.currency,
          symbol:      DEFAULT_COUNTRY.symbol,
          provider:    'google',
          createdAt:   new Date(),
        });
      }
    } catch (error) {
      const map = {
        'auth/popup-closed-by-user':    'Sign-in was cancelled.',
        'auth/popup-blocked':           'Popup was blocked. Please allow popups and try again.',
        'auth/account-exists-with-different-credential': 'An account already exists with this email.',
        'auth/network-request-failed':  'Network error. Check your connection.',
      };
      setMsg(map[error.code] || 'Google sign-in failed. Please try again.');
    }
    setGoogleLoading(false);
  };

  // ── Email Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (isLogin && !checkRateLimit()) return;
    if (!isValidEmail(email)) { setMsg('Please enter a valid email'); return; }
    if (password.length < 8)  { setMsg('Password must be at least 8 characters'); return; }
    if (!isLogin) {
      const uErr = validateUsername(username);
      if (uErr) { setMsg(uErr); return; }
      if (isWeak)                      { setMsg('Please use a stronger password'); return; }
      if (password !== confirmPassword) { setMsg('Passwords do not match'); return; }
    }
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', cred.user.uid), {
          email,
          username:    username.toLowerCase(),
          displayName: username,
          photoURL:    null,
          countryCode: selectedCountry.code,
          country:     selectedCountry.name,
          currency:    selectedCountry.currency,
          symbol:      selectedCountry.symbol,
          provider:    'email',
          createdAt:   new Date(),
        });
      }
    } catch (error) {
      if (isLogin) failedAttemptsRef.current.push(Date.now());
      const map = {
        'auth/invalid-credential':        'Invalid email or password',
        'auth/invalid-login-credentials': 'Invalid email or password',
        'auth/user-not-found':            'Invalid email or password',
        'auth/wrong-password':            'Invalid email or password',
        'auth/email-already-in-use':      'Email already registered',
        'auth/weak-password':             'Please choose a stronger password',
        'auth/invalid-email':             'Please enter a valid email address',
        'auth/too-many-requests':         'Too many attempts. Please try again later.',
        'auth/network-request-failed':    'Network error. Check your connection.',
      };
      setMsg(map[error.code] || 'An error occurred. Please try again.');
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!isValidEmail(email)) { setMsg('Enter your email address above first'); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setMsg('✓ Reset link sent — check your inbox', 'success');
    } catch (error) {
      setMsg(error.code === 'auth/user-not-found'
        ? 'If an account exists, a reset link has been sent.'
        : 'Could not send reset email. Please try again.');
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin); setMessage('');
    setPassword(''); setConfirmPassword(''); setUsername('');
  };

  const isSuccess = messageType === 'success' || message.startsWith('✓');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'DM Sans',-apple-system,sans-serif" }}>
      {/* Brand panel — desktop only */}
      <div style={{ flex: 1, display: 'none' }} className="brand-panel-wrap">
        <BrandPanel />
      </div>

      {/* Auth panel */}
      <div style={{ width: '100%', maxWidth: 500, minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 44px', background: '#ffffff', position: 'relative', overflowY: 'auto' }}>
        {/* Mobile logo */}
        <div style={{ position: 'absolute', top: 24, left: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white' }}>FT</div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1c1917', letterSpacing: '-0.03em' }}>Fintrax</span>
        </div>

        <div style={{ animation: 'authIn 0.4s cubic-bezier(0.16,1,0.3,1) both', paddingTop: 32 }}>
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 99, background: '#eef2ff', marginBottom: 14 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#4338ca' }}>
                {isLogin ? 'Welcome back' : 'Get started free'}
              </span>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.04em', color: '#1c1917', lineHeight: 1.2, marginBottom: 6 }}>
              {isLogin ? 'Sign in to Fintrax' : 'Create your account'}
            </h1>
            <p style={{ fontSize: 14, color: '#78746c' }}>
              {isLogin ? 'Enter your credentials to continue.' : 'Start tracking your finances in seconds.'}
            </p>
          </div>

          {/* Message */}
          {message && (
            <div style={{ padding: '12px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 16, background: isSuccess ? '#f0fdf4' : '#fff1f2', color: isSuccess ? '#15803d' : '#e11d48', border: `1px solid ${isSuccess ? '#bbf7d0' : '#ffe4e6'}` }}>
              {message}
            </div>
          )}

          {/* Google OAuth */}
          <div style={{ marginBottom: 20 }}>
            <GoogleButton onClick={handleGoogleSignIn} loading={googleLoading} label={isLogin ? 'Sign in with Google' : 'Sign up with Google'} />
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: '#e7e5e0' }} />
            <span style={{ fontSize: 12, color: '#a8a49d', fontWeight: 500 }}>or continue with email</span>
            <div style={{ flex: 1, height: 1, background: '#e7e5e0' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Email */}
            <div>
              <label style={labelStyle}>Email address</label>
              <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
            </div>

            {/* Username — signup only */}
            {!isLogin && (
              <div>
                <label style={labelStyle}>Username</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#a8a49d', fontFamily: 'DM Mono,monospace', pointerEvents: 'none' }}>@</span>
                  <input
                    type="text"
                    placeholder="yourname"
                    value={username}
                    maxLength={24}
                    onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    required
                    style={{
                      ...inputStyle,
                      paddingLeft: 30,
                      borderColor: username.length > 0
                        ? (validateUsername(username) ? '#fca5a5' : '#86efac')
                        : '#e7e5e0',
                    }}
                    onFocus={focusIn}
                    onBlur={focusOut}
                  />
                </div>
                {username.length > 0 && (
                  <div style={{ marginTop: 5, fontSize: 12, color: usernameError ? '#e11d48' : '#16a34a', fontWeight: 500 }}>
                    {usernameError || `✓ @${username.toLowerCase()} looks good`}
                  </div>
                )}
              </div>
            )}

            {/* Country picker — signup only */}
            {!isLogin && (
              <div>
                <label style={labelStyle}>Your country & currency</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={selectedCountry.code}
                    onChange={e => {
                      const found = COUNTRIES.find(c => c.code === e.target.value);
                      if (found) setSelectedCountry(found);
                    }}
                    style={{
                      ...inputStyle,
                      paddingLeft: 42,
                      backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2378746c' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 36, cursor: 'pointer',
                    }}
                    onFocus={focusIn} onBlur={focusOut}
                  >
                    {COUNTRIES.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.name} — {c.currency} ({c.symbol})</option>
                    ))}
                  </select>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, pointerEvents: 'none' }}>
                    {selectedCountry.flag}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 99 }}>
                    <span style={{ fontSize: 13 }}>{selectedCountry.flag}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#4338ca', fontFamily: 'DM Mono,monospace' }}>{selectedCountry.symbol}</span>
                    <span style={{ fontSize: 12, color: '#6366f1', fontWeight: 500 }}>{selectedCountry.currency}</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#a8a49d' }}>Your expenses will use this currency</span>
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isLogin ? '••••••••' : 'Min. 8 characters'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ ...inputStyle, paddingRight: 60 }}
                  onFocus={focusIn} onBlur={focusOut}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#a8a49d', letterSpacing: '0.05em', fontFamily: 'inherit', padding: '2px 4px' }}>
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>
              {!isLogin && password.length > 0 && <PasswordStrengthPanel password={password} />}
            </div>

            {/* Confirm password — signup only */}
            {!isLogin && (
              <div>
                <label style={labelStyle}>Confirm Password</label>
                <input
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  style={{ ...inputStyle, borderColor: confirmPassword.length > 0 ? (password === confirmPassword ? '#86efac' : '#fca5a5') : '#e7e5e0' }}
                  onFocus={focusIn} onBlur={focusOut}
                />
                {confirmPassword.length > 0 && (
                  <div style={{ marginTop: 5, fontSize: 12, fontWeight: 500, color: password === confirmPassword ? '#15803d' : '#e11d48' }}>
                    {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </div>
                )}
              </div>
            )}

            {/* Forgot password — login only */}
            {isLogin && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -4 }}>
                <button type="button" onClick={handleForgotPassword} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#6366f1', fontFamily: 'inherit', padding: 0 }}>
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || isRateLimited}
              style={{ width: '100%', padding: '12px 20px', background: loading || isRateLimited ? '#a8a49d' : '#4f46e5', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: loading || isRateLimited ? 'not-allowed' : 'pointer', boxShadow: loading || isRateLimited ? 'none' : '0 1px 3px rgba(99,102,241,0.45)', transition: 'all 0.15s', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onMouseEnter={e => { if (!loading && !isRateLimited) { e.currentTarget.style.background = '#4338ca'; e.currentTarget.style.transform = 'translateY(-1px)'; }}}
              onMouseLeave={e => { e.currentTarget.style.background = loading || isRateLimited ? '#a8a49d' : '#4f46e5'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {loading && <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />}
              {loading ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {/* Switch mode */}
          <p style={{ textAlign: 'center', fontSize: 13, color: '#78746c', marginTop: 20 }}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={switchMode} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#4f46e5', fontFamily: 'inherit', padding: 0 }}>
              {isLogin ? 'Sign up free' : 'Sign in'}
            </button>
          </p>

          {/* Trust bar */}
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #f5f5f4', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
            {[{ icon: '🔒', text: 'Secure' }, { icon: '🌍', text: '24+ countries' }, { icon: '⚡', text: 'Real-time' }].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#a8a49d', fontWeight: 500 }}>
                <span style={{ fontSize: 13 }}>{item.icon}</span>{item.text}
              </div>
            ))}
          </div>
        </div>

        <style>{`
          @keyframes authIn { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
          @keyframes spin   { to{transform:rotate(360deg)} }
          @media (min-width:900px) { .brand-panel-wrap{display:block!important} }
        `}</style>
      </div>
    </div>
  );
}

export default Login;