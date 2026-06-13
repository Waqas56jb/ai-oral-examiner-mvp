import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiMail, FiLock, FiEye, FiEyeOff, FiAlertCircle, FiCheck } from 'react-icons/fi'
import { FaMicrophoneAlt } from 'react-icons/fa'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui'

const FEATURES = ['Live question management', 'Candidate & exam analytics', 'AI examiner configuration', 'Full platform control']

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email.trim(), password)
    setLoading(false)
    if (error) setError(error)
    else navigate('/')
  }

  return (
    <div className="auth-wrap">
      <aside className="auth-side">
        <div className="auth-side__blob auth-side__blob--1" />
        <div className="auth-side__blob auth-side__blob--2" />
        <div className="auth-side__inner">
          <div className="auth-brand">
            <div className="auth-brand__logo"><FaMicrophoneAlt /></div>
            <div className="auth-brand__text">Pass<span>GP</span></div>
          </div>
          <h2>The control center for your AI oral examiner platform.</h2>
          <p>Manage questions, candidates, exams and analytics — all in one beautifully fast admin console.</p>
        </div>
        <div className="auth-feats">
          {FEATURES.map((f) => (
            <div className="auth-feat" key={f}>
              <span className="auth-feat__tick"><FiCheck /></span>
              {f}
            </div>
          ))}
        </div>
        <div className="auth-foot">© {new Date().getFullYear()} PassGP · Admin Console</div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-card__head">
            <h1>Welcome back</h1>
            <p>Sign in to your admin account to continue.</p>
          </div>

          {error && (
            <div className="alert alert--error" style={{ marginBottom: 18 }}>
              <FiAlertCircle /> {error}
            </div>
          )}

          <form className="auth-form" onSubmit={onSubmit}>
            <div className="field">
              <label>Email address</label>
              <div className="input-icon">
                <FiMail />
                <input className="input" type="email" placeholder="admin@passgp.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              </div>
            </div>

            <div className="field">
              <label>Password</label>
              <div className="input-icon">
                <FiLock />
                <input className="input" type={show ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
                <button type="button" className="input-icon__trail" onClick={() => setShow((s) => !s)} tabIndex={-1}>
                  {show ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <div className="auth-row">
              <label className="auth-check">
                <input type="checkbox" defaultChecked /> Keep me signed in
              </label>
              <Link to="/reset-password" className="auth-link">Forgot password?</Link>
            </div>

            <Button type="submit" loading={loading} className="btn--block" style={{ marginTop: 4 }}>
              {loading ? 'Signing in…' : 'Sign in to dashboard'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}
