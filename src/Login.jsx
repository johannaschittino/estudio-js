import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase.js';
import { T } from './tokens.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const msg = {
        'auth/invalid-credential': 'Mail o contraseña incorrectos.',
        'auth/invalid-email': 'El formato del mail no es válido.',
        'auth/too-many-requests': 'Demasiados intentos. Probá de nuevo en unos minutos.',
      }[err.code] || 'No se pudo iniciar sesión. Probá de nuevo.';
      setError(msg);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,600;1,8..60,400&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        input:focus { outline: 2px solid ${T.dorado}; outline-offset: 1px; }
      `}</style>
      <form onSubmit={handleSubmit} style={styles.card}>
        <div style={styles.brand}>Estudio</div>
        <p style={styles.sub}>Análisis de cobertura — acceso privado</p>

        <label style={styles.label}>Mail</label>
        <input
          type="email"
          autoComplete="username"
          style={styles.input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label style={styles.label}>Contraseña</label>
        <input
          type="password"
          autoComplete="current-password"
          style={styles.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <div style={styles.error}>{error}</div>}

        <button type="submit" style={styles.btn} disabled={cargando}>
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#FBF9F4', fontFamily: "'Inter', sans-serif", padding: 20,
  },
  card: {
    background: '#fff', border: '1px solid rgba(26,46,41,0.12)', borderRadius: 14,
    padding: '36px 32px', width: '100%', maxWidth: 360, boxShadow: '0 8px 30px rgba(26,46,41,0.06)',
  },
  brand: { fontFamily: "'Source Serif 4', serif", fontSize: 26, fontWeight: 600, color: '#1A2E29' },
  sub: { fontSize: 13, color: 'rgba(26,46,41,0.6)', marginTop: 4, marginBottom: 26 },
  label: { display: 'block', fontSize: 11, color: 'rgba(26,46,41,0.5)', marginBottom: 5, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: { width: '100%', border: '1px solid rgba(26,46,41,0.15)', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: "'Inter', sans-serif" },
  error: { color: '#B5483D', fontSize: 12.5, marginTop: 14, background: 'rgba(181,72,61,0.08)', padding: '8px 10px', borderRadius: 7 },
  btn: { width: '100%', marginTop: 22, background: '#1A2E29', color: '#FBF9F4', border: 'none', borderRadius: 9, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
};
