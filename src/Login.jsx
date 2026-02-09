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
      if (error.code === 'auth/user-not-found') {
        setMessage('No account found with this email');
      } else if (error.code === 'auth/wrong-password') {
        setMessage('Incorrect password');
      } else if (error.code === 'auth/email-already-in-use') {
        setMessage('Email already registered');
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
      setMessage('Could not send reset email. Please try again.');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
        <p>{isLogin ? 'Login to your account' : 'Sign up to get started'}</p>

        {message && <div className="error">{message}</div>}

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
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
          }}>
            {isLogin ? 'Sign Up' : 'Login'}
          </span>
        </p>
      </div>
    </div>
  );
}

export default Login;