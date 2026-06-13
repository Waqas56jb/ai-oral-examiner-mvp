import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowLeft, FiAlertCircle, FiCheck, FiArrowRight } from 'react-icons/fi'
import { FaMicrophoneAlt } from 'react-icons/fa'
import { apiPost } from '../lib/api'
import { Button } from '../components/ui'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState('email') // email | password | done
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const checkEmail = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { exists } = await apiPost('/api/admin/auth/check-email', { email: email.trim() })
      if (exists) setStep('password')
      else setError('No administrator account found for that email.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const setNewPassword = async (e) => {
    e.preventDefault()
    setError('')
    if (pw.length < 6) return setError('Password must be at least 6 characters.')
    if (pw !== pw2) return setError('Passwords do not match.')
    setLoading(true)
    try {
      await apiPost('/api/admin/auth/reset-password', { email: email.trim(), password: pw })
      setStep('done')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
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
          <h2>Reset your admin password.</h2>
          <p>Confirm your email, then set a new password — no waiting on email links.</p>
        </div>
        <div className="auth-foot">© {new Date().getFullYear()} PassGP · Admin Console</div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          {step === 'done' ? (
            <>
              <div className="auth-card__head">
                <h1>Password updated</h1>
                <p>Your new password for <strong>{email}</strong> is ready.</p>
              </div>
              <div className="alert alert--success" style={{ marginBottom: 20 }}>
                <FiCheck /> You can now sign in with your new password.
              </div>
              <Button className="btn--block" onClick={() => navigate('/login')} icon={<FiArrowRight />}>Go to sign in</Button>
            </>
          ) : step === 'password' ? (
            <>
              <div className="auth-card__head">
                <h1>Set a new password</h1>
                <p>Account verified for <strong>{email}</strong>.</p>
              </div>
              {error && <div className="alert alert--error" style={{ marginBottom: 18 }}><FiAlertCircle /> {error}</div>}
              <form className="auth-form" onSubmit={setNewPassword}>
                <div className="field">
                  <label>New password</label>
                  <div className="input-icon">
                    <FiLock />
                    <input className="input" type={show ? 'text' : 'password'} placeholder="••••••••" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required />
                    <button type="button" className="input-icon__trail" onClick={() => setShow((s) => !s)} tabIndex={-1}>{show ? <FiEyeOff /> : <FiEye />}</button>
                  </div>
                </div>
                <div className="field">
                  <label>Confirm new password</label>
                  <div className="input-icon">
                    <FiLock />
                    <input className="input" type={show ? 'text' : 'password'} placeholder="••••••••" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
                  </div>
                </div>
                <Button type="submit" loading={loading} className="btn--block">{loading ? 'Updating…' : 'Update password'}</Button>
              </form>
            </>
          ) : (
            <>
              <div className="auth-card__head">
                <h1>Forgot password?</h1>
                <p>Enter your admin email to continue.</p>
              </div>
              {error && <div className="alert alert--error" style={{ marginBottom: 18 }}><FiAlertCircle /> {error}</div>}
              <form className="auth-form" onSubmit={checkEmail}>
                <div className="field">
                  <label>Email address</label>
                  <div className="input-icon">
                    <FiMail />
                    <input className="input" type="email" placeholder="admin@passgp.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                  </div>
                </div>
                <Button type="submit" loading={loading} className="btn--block" icon={<FiArrowRight />}>{loading ? 'Checking…' : 'Continue'}</Button>
              </form>
            </>
          )}

          {step !== 'done' && (
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <Link to="/login" className="auth-link"><FiArrowLeft style={{ verticalAlign: '-2px' }} /> Back to sign in</Link>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
