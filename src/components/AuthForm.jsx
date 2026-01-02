import { useState } from 'react';
import { useAuth } from './Auth';

export default function AuthForm() {
  // Get login and register functions from Auth context
  const auth = useAuth();
  const login = auth.login;
  const register = auth.register;

  // State to know whether user is logging in or signing up
  const [isLogin, setIsLogin] = useState(true);

  // State to store email input
  const [email, setEmail] = useState('');

  // State to store password input
  const [password, setPassword] = useState('');

  // State to store error messages
  const [error, setError] = useState('');

  // Function that runs when form is submitted
  async function handleSubmit(event) {
    // Stop page refresh
    event.preventDefault();

    // Clear old errors
    setError('');

    try {
      // If user is logging in
      if (isLogin === true) {
        await login(email, password);
      }

      // If user is creating an account
      if (isLogin === false) {
        await register(email, password);
      }
    } catch (err) {
      // Save error message if something goes wrong
      setError(err.message);
    }
  }

  // Change between Login and Sign Up
  function toggleAuthMode() {
    setIsLogin(!isLogin);
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">

        <h2 className="auth-title">
          {isLogin === true && 'Welcome Back'}
          {isLogin === false && 'Create Account'}
        </h2>

        <p className="auth-subtitle">
          {isLogin === true && 'Login to manage your expenses'}
          {isLogin === false && 'Sign up to start tracking your expenses'}
        </p>

        {error !== '' && <p className="auth-error">{error}</p>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={function (e) {
                setEmail(e.target.value);
              }}
              required
            />
          </div>

          <div className="auth-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={function (e) {
                setPassword(e.target.value);
              }}
              required
            />
          </div>

          <button type="submit" className="auth-btn">
            {isLogin === true && 'Login'}
            {isLogin === false && 'Create Account'}
          </button>
        </form>

        <div className="auth-switch">
          {isLogin === true && 'No account? '}
          {isLogin === false && 'Already have an account? '}

          <button onClick={toggleAuthMode}>
            {isLogin === true && 'Sign up'}
            {isLogin === false && 'Login'}
          </button>
        </div>

      </div>
    </div>
  );
}
