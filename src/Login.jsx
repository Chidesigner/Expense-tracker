import { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from './firebase';

function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  
  // Rate limiting state
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockTimer, setBlockTimer] = useState(0);

  // Rate limiting - Check if user is blocked
  useEffect(() => {
    const blockData = localStorage.getItem('loginBlock');
    if (blockData) {
      const { blockedUntil, attempts } = JSON.parse(blockData);
      const now = Date.now();
      
      if (now < blockedUntil) {
        setIsBlocked(true);
        setLoginAttempts(attempts);
        setBlockTimer(Math.ceil((blockedUntil - now) / 1000));
      } else {
        // Block expired, clear it
        localStorage.removeItem('loginBlock');
      }
    }
  }, []);

  // Countdown timer for blocked state
  useEffect(() => {
    if (isBlocked && blockTimer > 0) {
      const timer = setTimeout(() => {
        setBlockTimer(blockTimer - 1);
      }, 1000);
      
      return () => clearTimeout(timer);
    } else if (isBlocked && blockTimer === 0) {
      setIsBlocked(false);
      setLoginAttempts(0);
      localStorage.removeItem('loginBlock');
    }
  }, [isBlocked, blockTimer]);

  // Input validation function to prevent XSS
  const sanitizeInput = (input) => {
    // Remove any HTML tags and script content
    return input.replace(/<[^>]*>/g, '').trim();
  };

  // Email validation
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Password strength validation
  const validatePassword = (password) => {
    // At least 6 characters (Firebase minimum)
    if (password.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    
    // Recommend stronger password
    if (password.length < 8) {
      return 'Consider using a password with at least 8 characters for better security';
    }
    
    return null;
  };

  // Handle rate limiting on failed login
  const handleFailedLogin = () => {
    const newAttempts = loginAttempts + 1;
    setLoginAttempts(newAttempts);

    if (newAttempts >= 5) {
      // Block for 15 minutes after 5 failed attempts
      const blockedUntil = Date.now() + (15 * 60 * 1000);
      localStorage.setItem('loginBlock', JSON.stringify({
        blockedUntil,
        attempts: newAttempts
      }));
      setIsBlocked(true);
      setBlockTimer(15 * 60);
      setError('Too many failed attempts. Please try again in 15 minutes.');
    } else {
      setError(`Invalid credentials. ${5 - newAttempts} attempts remaining.`);
    }
  };

  // Reset login attempts on successful login
  const resetLoginAttempts = () => {
    setLoginAttempts(0);
    localStorage.removeItem('loginBlock');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Check if blocked
    if (isBlocked) {
      setError(`Too many attempts. Please wait ${blockTimer} seconds.`);
      return;
    }

    // Sanitize inputs to prevent XSS
    const cleanEmail = sanitizeInput(email);
    const cleanPassword = password; // Don't sanitize password as it might contain special chars

    // Validate email format
    if (!validateEmail(cleanEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate password for signup
    if (!isLogin) {
      const passwordError = validatePassword(cleanPassword);
      if (passwordError) {
        setError(passwordError);
        return;
      }

      // Check if passwords match
      if (cleanPassword !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
        resetLoginAttempts(); // Clear failed attempts on success
        setSuccess('Login successful!');
      } else {
        await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
        setSuccess('Account created successfully!');
      }
    } catch (err) {
      // Handle specific Firebase errors
      if (isLogin) {
        handleFailedLogin();
      } else {
        if (err.code === 'auth/email-already-in-use') {
          setError('This email is already registered');
        } else if (err.code === 'auth/weak-password') {
          setError('Password is too weak. Use at least 6 characters.');
        } else {
          setError(err.message);
        }
      }
    }
    
    setLoading(false);
  };

  // Password reset functionality
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const cleanEmail = sanitizeInput(email);

    if (!validateEmail(cleanEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setSuccess('Password reset email sent! Check your inbox.');
      setShowPasswordReset(false);
      setEmail('');
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email');
      } else {
        setError('Error sending reset email. Please try again.');
      }
    }

    setLoading(false);
  };

  // Password reset modal
  if (showPasswordReset) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>Reset Password</h1>
          <p>Enter your email to receive a password reset link</p>

          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}

          <form onSubmit={handlePasswordReset}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <p className="switch">
            <span onClick={() => setShowPasswordReset(false)}>
              Back to Login
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
        <p>{isLogin ? 'Login to your account' : 'Sign up to get started'}</p>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}
        
        {isBlocked && (
          <div className="warning">
            Account temporarily locked. Try again in {Math.floor(blockTimer / 60)}:{(blockTimer % 60).toString().padStart(2, '0')}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isBlocked}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isBlocked}
          />
          {!isLogin && (
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          )}
          <button type="submit" disabled={loading || isBlocked}>
            {loading ? 'Loading...' : isLogin ? 'Login' : 'Sign Up'}
          </button>
        </form>

        {isLogin && (
          <p className="switch">
            <span onClick={() => setShowPasswordReset(true)}>
              Forgot Password?
            </span>
          </p>
        )}

        <p className="switch">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <span onClick={() => {
            setIsLogin(!isLogin);
            setError('');
            setSuccess('');
            setConfirmPassword('');
          }}>
            {isLogin ? 'Sign Up' : 'Login'}
          </span>
        </p>

        {loginAttempts > 0 && !isBlocked && (
          <p className="attempts-warning">
            Failed attempts: {loginAttempts}/5
          </p>
        )}
      </div>
    </div>
  );
}

export default Login;