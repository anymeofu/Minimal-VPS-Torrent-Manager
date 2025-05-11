import React, { useState } from 'react';

function LoginForm({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false); // State for "Keep me logged in"
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, rememberMe }), // Send rememberMe state
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login failed.');
      }
      onLoginSuccess(data.username);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: '300px', margin: '50px auto', padding: '20px', backgroundColor: '#1e1e1e' }}>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="username">Username:</label><br/>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{width: '95%'}}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="password">Password:</label><br/>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{width: '95%'}}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <input
            type="checkbox"
            id="rememberMe"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            style={{ marginRight: '5px' }}
          />
          <label htmlFor="rememberMe">Keep me logged in</label>
        </div>
        {error && <p style={{ color: '#e74c3c', marginBottom: '10px' }}>{error}</p>}
        <button type="submit">Login</button>
      </form>
      <p style={{fontSize: '0.8em', marginTop: '20px'}}>Default: admin / password123 (Change in src/routes/auth.js or via ENV vars)</p>
    </div>
  );
}

export default LoginForm;
