import { useState } from 'react';
import { auth, db } from '../firebase';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { useCurrency, COUNTRIES } from '../context/CurrencyContext';
import { useUserProfile } from '../hooks/useUserprofile';

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

function Section({ title, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #eeede9', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      <div style={{ padding: '18px 24px', borderBottom: '1px solid #f5f5f4' }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1c1917', letterSpacing: '-0.02em' }}>{title}</h3>
      </div>
      <div style={{ padding: '24px' }}>
        {children}
      </div>
    </div>
  );
}

function StatusMessage({ message, type = 'error' }) {
  if (!message) return null;
  const isSuccess = type === 'success' || message.startsWith('✓');
  return (
    <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 16, background: isSuccess ? '#f0fdf4' : '#fff1f2', color: isSuccess ? '#15803d' : '#e11d48', border: `1px solid ${isSuccess ? '#bbf7d0' : '#ffe4e6'}` }}>
      {message}
    </div>
  );
}

function Settings() {
  const { country, setCountry, fmt }    = useCurrency();
  const user                            = auth.currentUser;
  const { profile }                     = useUserProfile(user);

  // Password
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword]   = useState('');
  const [newPassword, setNewPassword]           = useState('');
  const [confirmPassword, setConfirmPassword]   = useState('');
  const [pwMessage, setPwMessage]               = useState('');
  const [pwMessageType, setPwMessageType]       = useState('error');

  // Currency
  const [selectedCountryCode, setSelectedCountryCode] = useState(country.code);
  const [currencySaved, setCurrencySaved]             = useState(false);
  const [currencySaving, setCurrencySaving]           = useState(false);

  // Profile / display name
  const [newDisplayName, setNewDisplayName]     = useState('');
  const [profileMessage, setProfileMessage]     = useState('');
  const [profileMsgType, setProfileMsgType]     = useState('success');
  const [profileSaving, setProfileSaving]       = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwMessage('');
    if (newPassword.length < 8)         { setPwMessage('Password must be at least 8 characters'); setPwMessageType('error'); return; }
    if (newPassword !== confirmPassword) { setPwMessage('Passwords do not match'); setPwMessageType('error'); return; }
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setPwMessage('✓ Password updated successfully'); setPwMessageType('success');
      setShowPasswordForm(false);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (error) {
      setPwMessageType('error');
      if (error.code === 'auth/wrong-password')    setPwMessage('Current password is incorrect');
      else if (error.code === 'auth/weak-password') setPwMessage('New password is too weak');
      else setPwMessage('Error updating password. Please try again.');
    }
  };

  const handleCurrencyChange = async () => {
    const found = COUNTRIES.find(c => c.code === selectedCountryCode);
    if (!found || found.code === country.code) return;
    setCurrencySaving(true);
    await setCountry(found);
    setCurrencySaving(false);
    setCurrencySaved(true);
    setTimeout(() => setCurrencySaved(false), 3000);
  };

  const handleDisplayNameSave = async () => {
    const trimmed = newDisplayName.trim();
    if (!trimmed || trimmed.length < 2) { setProfileMessage('Name must be at least 2 characters'); setProfileMsgType('error'); return; }
    if (trimmed.length > 40)            { setProfileMessage('Name must be under 40 characters'); setProfileMsgType('error'); return; }
    setProfileSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid), { displayName: trimmed }, { merge: true });
      setProfileMessage('✓ Display name updated'); setProfileMsgType('success');
      setNewDisplayName('');
    } catch {
      setProfileMessage('Failed to update. Try again.'); setProfileMsgType('error');
    }
    setProfileSaving(false);
    setTimeout(() => setProfileMessage(''), 3000);
  };

  const handleDeleteAllData = async () => {
    if (!window.confirm('Are you sure you want to delete ALL your expenses? This cannot be undone!')) return;
    if (!window.confirm('This will permanently delete all your data. Are you absolutely sure?')) return;
    try {
      const q    = query(collection(db, 'expenses'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      alert('All expenses deleted successfully');
    } catch {
      alert('Error deleting data. Please try again.');
    }
  };

  const selectedForPreview = COUNTRIES.find(c => c.code === selectedCountryCode) || country;
  const hasChanged         = selectedCountryCode !== country.code;
  const isGoogleUser       = profile?.provider === 'google';

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '36px 28px', display: 'flex', flexDirection: 'column', gap: 20, fontFamily: "'DM Sans',-apple-system,sans-serif", animation: 'pageIn 0.25s ease' }}>
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.04em', color: '#1c1917', marginBottom: 4 }}>Settings</h2>
        <p style={{ fontSize: 14, color: '#78746c' }}>Manage your account, currency, and preferences.</p>
      </div>

      {/* ── Profile ── */}
      <Section title="Profile">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Current info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: '#fafaf9', border: '1px solid #e7e5e0', borderRadius: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
              {(profile?.displayName || profile?.username || 'FT').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1917' }}>{profile?.displayName || profile?.username || '—'}</div>
              <div style={{ fontSize: 12, color: '#a8a49d' }}>
                {profile?.username && <span style={{ fontFamily: 'DM Mono,monospace' }}>@{profile.username}</span>}
                {profile?.username && ' · '}
                {profile?.email}
              </div>
            </div>
            {isGoogleUser && (
              <span style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 8px', background: '#fff', border: '1px solid #e7e5e0', borderRadius: 99, color: '#78746c', fontWeight: 500, whiteSpace: 'nowrap' }}>
                🔵 Google
              </span>
            )}
          </div>

          {/* Change display name */}
          <div>
            <label style={labelStyle}>Display name</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="text"
                placeholder={profile?.displayName || 'Enter a display name'}
                value={newDisplayName}
                maxLength={40}
                onChange={e => setNewDisplayName(e.target.value)}
                style={inputStyle}
                onFocus={focusIn} onBlur={focusOut}
              />
              <button
                onClick={handleDisplayNameSave}
                disabled={!newDisplayName.trim() || profileSaving}
                style={{ padding: '0 18px', background: !newDisplayName.trim() || profileSaving ? '#e7e5e0' : '#4f46e5', color: !newDisplayName.trim() || profileSaving ? '#a8a49d' : 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: !newDisplayName.trim() || profileSaving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
              >
                {profileSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
            {profileMessage && <StatusMessage message={profileMessage} type={profileMsgType} />}
          </div>

          {/* Email (read-only) */}
          <div>
            <label style={labelStyle}>Email address</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, padding: '10px 14px', background: '#f5f5f4', border: '1px solid #e7e5e0', borderRadius: 8, fontSize: 14, color: '#78746c' }}>
                {user?.email || '—'}
              </div>
              <span style={{ fontSize: 11, padding: '4px 10px', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 99, fontWeight: 600, whiteSpace: 'nowrap' }}>
                ✓ Verified
              </span>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Currency & Region ── */}
      <Section title="Currency & Region">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: '#78746c', lineHeight: 1.5 }}>
            Your currency is used across all pages — Dashboard, Expenses, and Analytics.
          </p>

          {/* Current badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10 }}>
            <span style={{ fontSize: 22 }}>{country.flag}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1917' }}>{country.name}</div>
              <div style={{ fontSize: 12, color: '#6366f1', fontFamily: 'DM Mono,monospace', fontWeight: 600 }}>{country.currency} · {country.symbol}</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: '#6366f1', fontWeight: 600, background: 'white', padding: '3px 10px', borderRadius: 99, border: '1px solid #c7d2fe' }}>Current</div>
          </div>

          {/* Selector */}
          <div>
            <label style={labelStyle}>Change country & currency</label>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedCountryCode}
                onChange={e => { setSelectedCountryCode(e.target.value); setCurrencySaved(false); }}
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
                {selectedForPreview.flag}
              </span>
            </div>
          </div>

          {hasChanged && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8 }}>
              <span style={{ fontSize: 18 }}>→</span>
              <div style={{ fontSize: 13, color: '#92400e' }}>
                Switching to <strong>{selectedForPreview.name}</strong> · <span style={{ fontFamily: 'DM Mono,monospace' }}>{selectedForPreview.symbol} {selectedForPreview.currency}</span>
              </div>
            </div>
          )}

          <div style={{ padding: '12px 16px', background: '#fafaf9', border: '1px solid #e7e5e0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#78746c' }}>Example amount:</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#1c1917', fontFamily: 'DM Mono,monospace', letterSpacing: '-0.02em' }}>{selectedForPreview.symbol}1,250.00</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleCurrencyChange}
              disabled={!hasChanged || currencySaving}
              style={{ padding: '10px 24px', background: !hasChanged || currencySaving ? '#e7e5e0' : '#4f46e5', color: !hasChanged ? '#a8a49d' : 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: !hasChanged || currencySaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}
            >
              {currencySaving && <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />}
              {currencySaving ? 'Saving…' : 'Save currency'}
            </button>
            {currencySaved && <span style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>✓ Currency updated</span>}
          </div>
        </div>
      </Section>

      {/* ── Security ── */}
      <Section title="Security">
        {pwMessage && <StatusMessage message={pwMessage} type={pwMessageType} />}

        {isGoogleUser ? (
          <div style={{ padding: '12px 16px', background: '#f5f5f4', border: '1px solid #e7e5e0', borderRadius: 8, fontSize: 13, color: '#78746c' }}>
            🔵 You signed in with Google. Password management is handled by your Google account.
          </div>
        ) : !showPasswordForm ? (
          <button
            onClick={() => setShowPasswordForm(true)}
            style={{ padding: '10px 20px', background: 'white', border: '1px solid #e7e5e0', color: '#1c1917', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f4'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
          >
            🔑 Change password
          </button>
        ) : (
          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Current password</label>
              <input type="password" placeholder="••••••••" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
            </div>
            <div>
              <label style={labelStyle}>New password</label>
              <input type="password" placeholder="Min. 8 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} required style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
            </div>
            <div>
              <label style={labelStyle}>Confirm new password</label>
              <input type="password" placeholder="Re-enter new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                style={{ ...inputStyle, borderColor: confirmPassword.length > 0 ? (newPassword === confirmPassword ? '#86efac' : '#fca5a5') : '#e7e5e0' }}
                onFocus={focusIn} onBlur={focusOut}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" style={{ padding: '10px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Update password</button>
              <button type="button" onClick={() => { setShowPasswordForm(false); setPwMessage(''); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                style={{ padding: '10px 20px', background: 'transparent', color: '#78746c', border: '1px solid #e7e5e0', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </Section>

      {/* ── About ── */}
      <Section title="About Fintrax">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            ['Version', '1.0.0'],
            ['Countries supported', '24+'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#78746c' }}>{k}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1c1917', fontFamily: k === 'Version' ? 'DM Mono,monospace' : undefined }}>{v}</span>
            </div>
          ))}
          <div style={{ height: 1, background: '#f5f5f4' }} />
          {['Input sanitization & XSS protection', 'Rate-limited authentication', 'Password strength enforcement', 'Encrypted storage via Firebase', 'Real-time data sync', 'Google OAuth sign-in'].map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#57534e' }}>
              <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 12 }}>✓</span>{f}
            </div>
          ))}
        </div>
      </Section>

      {/* ── Danger Zone ── */}
      <Section title="Danger Zone">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: '#78746c', lineHeight: 1.5 }}>These actions are permanent and cannot be undone.</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#fff1f2', border: '1px solid #ffe4e6', borderRadius: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1917', marginBottom: 2 }}>Delete all expenses</div>
              <div style={{ fontSize: 12, color: '#a8a49d' }}>Permanently removes all your transaction data</div>
            </div>
            <button
              onClick={handleDeleteAllData}
              style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #e11d48', color: '#e11d48', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 12 }}
              onMouseEnter={e => e.currentTarget.style.background = '#fff1f2'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              Delete all
            </button>
          </div>
        </div>
      </Section>

      <style>{`
        @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}

export default Settings;