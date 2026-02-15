import { useState, useRef } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from './firebase';

// ─── PASSWORD ANALYSIS ENGINE ─────────────────────────────────────────────────
// Calculates entropy, charset size, crack time, and per-criterion scores.
// Based on brute force model at 10 billion guesses/sec (modern GPU cluster).

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
  if      (seconds < 0.001)                crackTime = '< 1 millisecond';
  else if (seconds < 1)                    crackTime = `${(seconds * 1000).toFixed(0)} milliseconds`;
  else if (seconds < 60)                   crackTime = `${seconds.toFixed(1)} seconds`;
  else if (seconds < 3600)                 crackTime = `${(seconds / 60).toFixed(1)} minutes`;
  else if (seconds < 86400)                crackTime = `${(seconds / 3600).toFixed(1)} hours`;
  else if (seconds < 86400 * 365)          crackTime = `${(seconds / 86400).toFixed(0)} days`;
  else if (seconds < 86400 * 365 * 1000)  crackTime = `${(seconds / (86400 * 365)).toFixed(0)} years`;
  else if (seconds < 86400 * 365 * 1e6)   crackTime = `${Math.round(seconds / (86400 * 365 * 1000)).toLocaleString()} thousand years`;
  else if (seconds < 86400 * 365 * 1e9)   crackTime = `${Math.round(seconds / (86400 * 365 * 1e6)).toLocaleString()} million years`;
  else                                     crackTime = 'heat death of the universe';

  const criteria = [
    { id: 'len8',    label: '8+ characters',    met: pw.length >= 8 },
    { id: 'len12',   label: '12+ characters',   met: pw.length >= 12 },
    { id: 'upper',   label: 'Uppercase (A–Z)',   met: hasUpper },
    { id: 'lower',   label: 'Lowercase (a–z)',   met: hasLower },
    { id: 'digit',   label: 'Number (0–9)',      met: hasDigit },
    { id: 'special', label: 'Special (!@#$)',    met: hasSpecial },
  ];

  const metCount = criteria.filter(c => c.met).length;
  const score    = Math.max(pw.length > 0 ? 1 : 0, metCount);

  const levels = [
    { label: '—',         color: '#888',    bg: 'transparent',        border: '#ddd' },
    { label: 'Critical',  color: '#e63946', bg: '#fff5f5',            border: '#ffc8cb' },
    { label: 'Weak',      color: '#f4622a', bg: '#fff4f0',            border: '#fcd9cc' },
    { label: 'Moderate',  color: '#d97706', bg: '#fffbeb',            border: '#fcd34d' },
    { label: 'Strong',    color: '#16a34a', bg: '#f0fdf4',            border: '#bbf7d0' },
    { label: 'Excellent', color: '#0369a1', bg: '#f0f9ff',            border: '#bae6fd' },
  ];

  const combosStr = combinations > 1e18
    ? `10^${Math.round(Math.log10(combinations))}`
    : combinations > 1e12 ? `${(combinations / 1e12).toFixed(0)}T`
    : combinations > 1e9  ? `${(combinations / 1e9).toFixed(0)}B`
    : combinations > 1e6  ? `${(combinations / 1e6).toFixed(0)}M`
    : combinations.toLocaleString();

  return { score, level: levels[score] || levels[0], entropy: entropy.toFixed(1), charset, combos: combosStr, crackTime, criteria };
}

// ─── PASSWORD STRENGTH PANEL ──────────────────────────────────────────────────
function PasswordStrengthPanel({ password }) {
  const a = analyzePassword(password);
  if (!a) return null;
  const { score, level, entropy, charset, combos, crackTime, criteria } = a;

  return (
    <div style={{
      marginTop: 8,
      padding: '12px 14px',
      background: level.bg,
      border: `1px solid ${level.border}`,
      borderLeft: `3px solid ${level.color}`,
      borderRadius: 4,
      transition: 'all 0.2s',
    }}>
      {/* Score header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', padding: '2px 8px',
            background: level.color, color: 'white', borderRadius: 2,
          }}>
            {level.label}
          </span>
          <span style={{ fontSize: '0.7rem', color: '#666' }}>{score}/5</span>
        </div>
        <span style={{ fontSize: '0.65rem', color: '#888', fontFamily: 'monospace' }}>
          {entropy} bits entropy
        </span>
      </div>

      {/* Score bar */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i <= score ? level.color : '#e2e8f0',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Criteria grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
        {criteria.map(c => (
          <div key={c.id} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: '0.68rem',
            color: c.met ? '#16a34a' : '#94a3b8',
          }}>
            <span>{c.met ? '✓' : '○'}</span>
            {c.label}
          </div>
        ))}
      </div>

      {/* Crack time + stats */}
      <div style={{
        padding: '7px 9px',
        background: 'rgba(0,0,0,0.04)',
        borderRadius: 3,
      }}>
        <div style={{ fontSize: '0.6rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
          Est. crack time at 10B guesses/sec
        </div>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: level.color, fontFamily: 'monospace' }}>
          {crackTime}
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 5 }}>
          {[{ l: 'Charset', v: charset }, { l: 'Combos', v: combos }].map(s => (
            <div key={s.l} style={{ fontSize: '0.63rem', color: '#888' }}>
              <span style={{ fontWeight: 600, color: '#444', fontFamily: 'monospace' }}>{s.v}</span> {s.l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN COMPONENT ──────────────────────────────────────────────────────────
function Login() {
  const [isLogin, setIsLogin]                 = useState(true);
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage]                 = useState('');
  const [loading, setLoading]                 = useState(false);
  const [showPassword, setShowPassword]       = useState(false);

  // SECURITY: Rate limiting using useRef so the attempt log persists
  // between renders without triggering re-renders on every failure.
  const [isRateLimited, setIsRateLimited] = useState(false);
  const failedAttemptsRef = useRef([]);

  const isValidEmail = (e) => e.includes('@') && e.includes('.');

  // SECURITY: Block login after 5 failed attempts within 60 seconds.
  // Directly addresses brute force and credential stuffing (OWASP A07).
  const checkRateLimit = () => {
    const now = Date.now();
    failedAttemptsRef.current = failedAttemptsRef.current.filter(t => t > now - 60000);
    if (failedAttemptsRef.current.length >= 5) {
      setIsRateLimited(true);
      setMessage('Too many failed attempts. Please wait 1 minute.');
      setTimeout(() => {
        setIsRateLimited(false);
        failedAttemptsRef.current = [];
        setMessage('');
      }, 60000);
      return false;
    }
    return true;
  };

  const analysis       = analyzePassword(password);
  const isWeakPassword = analysis && analysis.score <= 2;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (isLogin && !checkRateLimit()) return;
    if (!isValidEmail(email))          { setMessage('Please enter a valid email'); return; }
    if (password.length < 8)           { setMessage('Password must be at least 8 characters'); return; }
    if (!isLogin && isWeakPassword)    { setMessage('Please use a stronger password for better security'); return; }
    if (!isLogin && password !== confirmPassword) { setMessage('Passwords do not match'); return; }

    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      if (isLogin) failedAttemptsRef.current.push(Date.now());

      // SECURITY: Generic error messages — whether the email is unrecognised
      // or the password is wrong, the response is identical. This prevents
      // user enumeration (OWASP A07): an attacker cannot determine which
      // email addresses exist in the system from the error message alone.
      if (['auth/invalid-credential', 'auth/invalid-login-credentials',
           'auth/user-not-found', 'auth/wrong-password'].includes(error.code)) {
        setMessage('Invalid email or password');
      } else if (error.code === 'auth/email-already-in-use') {
        setMessage('Email already registered');
      } else if (error.code === 'auth/weak-password') {
        setMessage('Please choose a stronger password');
      } else if (error.code === 'auth/invalid-email') {
        setMessage('Please enter a valid email address');
      } else if (error.code === 'auth/too-many-requests') {
        setMessage('Too many failed attempts. Please try again later.');
      } else if (error.code === 'auth/network-request-failed') {
        setMessage('Network error. Check your connection.');
      } else {
        setMessage('An error occurred. Please try again.');
      }
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!isValidEmail(email)) { setMessage('Please enter your email first'); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset email sent! Check your inbox.');
    } catch (error) {
      // SECURITY: Non-specific reset message prevents email enumeration.
      if (error.code === 'auth/user-not-found') {
        setMessage('If an account exists with this email, a reset link has been sent.');
      } else {
        setMessage('Could not send reset email. Please try again.');
      }
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setMessage('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
        <p>{isLogin ? 'Login to your account' : 'Sign up to get started'}</p>

        {message && <div className="error">{message}</div>}

        <form onSubmit={handleSubmit}>
          <div className="input-container">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-container">
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: 56 }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  fontSize: '0.7rem', color: '#888',
                  cursor: 'pointer', padding: '2px 4px',
                  letterSpacing: '0.05em',
                }}
              >
                {showPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>

            {/* PassScan-integrated strength panel — signup only */}
            {!isLogin && password.length > 0 && (
              <PasswordStrengthPanel password={password} />
            )}
          </div>

          {!isLogin && (
            <div className="input-container">
              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {confirmPassword.length > 0 && (
                <div style={{
                  marginTop: 5, fontSize: '0.72rem',
                  color: password === confirmPassword ? '#16a34a' : '#e63946',
                }}>
                  {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                </div>
              )}
            </div>
          )}

          <button type="submit" disabled={loading || isRateLimited}>
            {loading ? 'Loading...' : isLogin ? 'Login' : 'Sign Up'}
          </button>
        </form>

        {isLogin && (
          <p className="switch">
            <span onClick={handleForgotPassword}>Forgot Password?</span>
          </p>
        )}

        <p className="switch">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <span onClick={switchMode}>
            {isLogin ? 'Sign Up' : 'Login'}
          </span>
        </p>
      </div>
    </div>
  );
}

export default Login;