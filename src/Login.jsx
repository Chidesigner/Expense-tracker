import { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from './firebase';

function Login() {
  // Just the essentials
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState(''); // One message for both error and success
  const [loading, setLoading] = useState(false);

  // SECURITY: Calculate password strength
  const getPasswordStrength = (pwd) => {
    if (pwd.length === 0) return { strength: '', color: '', text: '' };
    
    let score = 0;
    
    // Length check
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    
    // Has uppercase and lowercase
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    
    // Has numbers
    if (/\d/.test(pwd)) score++;
    
    // Has special characters
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    
    if (score <= 2) return { strength: 'weak', color: '#ff4444', text: 'Weak' };
    if (score <= 3) return { strength: 'medium', color: '#ffaa00', text: 'Medium' };
    return { strength: 'strong', color: '#00C851', text: 'Strong' };
  };

  const passwordStrength = getPasswordStrength(password);

  // Simple email check
  const isValidEmail = (email) => {
    return email.includes('@') && email.includes('.');
  };

  // Handle Login or Signup
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    // Basic checks
    if (!isValidEmail(email)) {
      setMessage('Please enter a valid email');
      return;
    }

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters');
      return;
    }

    // SECURITY: Encourage strong passwords on signup
    if (!isLogin && passwordStrength.strength === 'weak') {
      setMessage('Please use a stronger password for better security');
      return;
    }

    // Only check confirm password when signing up
    if (!isLogin && password !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        // Login
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Signup
        await createUserWithEmailAndPassword(auth, email, password);
      }
      // If successful, Firebase automatically redirects (handled in App.jsx)
    } catch (error) {
      // Show user-friendly error messages
      // Handle both new and legacy Firebase error codes
      if (error.code === 'auth/invalid-credential' || 
          error.code === 'auth/invalid-login-credentials' ||
          error.code === 'auth/user-not-found' || 
          error.code === 'auth/wrong-password') {
        // SECURITY: Use generic message to prevent user enumeration
        setMessage('Invalid email or password');
        
      } else if (error.code === 'auth/email-already-in-use') {
        setMessage('Email already registered');
        
      } else if (error.code === 'auth/weak-password') {
        setMessage('Password should be at least 6 characters');
        
      } else if (error.code === 'auth/invalid-email') {
        setMessage('Please enter a valid email address');
        
      } else if (error.code === 'auth/too-many-requests') {
        setMessage('Too many failed attempts. Please try again later.');
        
      } else if (error.code === 'auth/network-request-failed') {
        setMessage('Network error. Check your internet connection.');
        
      } else {
        setMessage('An error occurred. Please try again.');
      }
    }

    setLoading(false);
  };

  // Handle forgot password
  const handleForgotPassword = async () => {
    if (!isValidEmail(email)) {
      setMessage('Please enter your email first');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset email sent! Check your inbox.');
    } catch (error) {
      // SECURITY: Don't reveal if email exists or not
      if (error.code === 'auth/user-not-found') {
        setMessage('If an account exists with this email, a reset link has been sent.');
      } else if (error.code === 'auth/invalid-email') {
        setMessage('Please enter a valid email address');
      } else if (error.code === 'auth/too-many-requests') {
        setMessage('Too many requests. Please try again later.');
      } else {
        setMessage('Could not send reset email. Please try again.');
      }
    }
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
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {/* Show password strength indicator when signing up and user is typing */}
            {!isLogin && password.length > 0 && (
              <>
                <div className="password-strength">
                  <div 
                    className="strength-bar" 
                    style={{ 
                      width: password.length < 6 ? '33%' : 
                             passwordStrength.strength === 'weak' ? '33%' : 
                             passwordStrength.strength === 'medium' ? '66%' : '100%',
                      backgroundColor: passwordStrength.color 
                    }}
                  />
                  <span style={{ color: passwordStrength.color }}>
                    {passwordStrength.text}
                  </span>
                </div>
                <div className="password-hints">
                  <span className={password.length >= 8 ? 'hint-met' : 'hint-unmet'}>
                    {password.length >= 8 ? '✓' : '○'} 8+ characters
                  </span>
                  <span className={/[A-Z]/.test(password) ? 'hint-met' : 'hint-unmet'}>
                    {/[A-Z]/.test(password) ? '✓' : '○'} Uppercase
                  </span>
                  <span className={/[0-9]/.test(password) ? 'hint-met' : 'hint-unmet'}>
                    {/[0-9]/.test(password) ? '✓' : '○'} Number
                  </span>
                  <span className={/[^A-Za-z0-9]/.test(password) ? 'hint-met' : 'hint-unmet'}>
                    {/[^A-Za-z0-9]/.test(password) ? '✓' : '○'} Special (!@#$)
                  </span>
                </div>
              </>
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
            </div>
          )}

          <button type="submit" disabled={loading}>
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
          <span onClick={() => {
            setIsLogin(!isLogin);
            setMessage('');
            setPassword('');
            setConfirmPassword('');
          }}>
            {isLogin ? 'Sign Up' : 'Login'}
          </span>
        </p>
      </div>
    </div>
  );
}

export default Login;