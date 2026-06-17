import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowLeft, FiAlertCircle, FiCheck, FiArrowRight } from 'react-icons/fi'
import { FaMicrophoneAlt } from 'react-icons/fa'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui'

/**
 * Secure password reset using Supabase's email recovery flow.
 *  1. 'email'    — admin enters their email → a one-time recovery link is emailed.
 *  2. (email)    — they click the link and return here with a recovery session.
 *  3. 'password' — they set a new password (only possible with that session).
 * There is no path to set a password from just an email — the link to the
 * verified inbox is the proof of identity.
 */
export default function ResetPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState('email') // email | sent | password | done
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // If the admin arrives via the recovery link, Supabase establishes a
  // temporary session and emits PASSWORD_RECOVERY — switch to the reset form.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStep('password')
    })
    // Also handle the case where the event already fired before we subscribed.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && window.location.hash.includes('type=recovery')) setStep('password')
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const sendResetEmail = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setStep('sent')
    } catch (err) {
      setError(err.message || 'Could not send the reset email.')
    } finally {
      setLoading(false)
    }
  }

  const setNewPassword = async (e) => {
    e.preventDefault()
    setError('')
    if (pw.length < 8) return setError('Password must be at least 8 characters.')
    if (pw !== pw2) return setError('Passwords do not match.')
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: pw })
      if (error) throw error
      await supabase.auth.signOut()
      setStep('done')
    } catch (err) {
      setError(err.message || 'Could not update the password.')
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
          <p>We email a secure, one-time link to your admin inbox. Only you can complete the reset.</p>
        </div>
        <div className="auth-foot">© {new Date().getFullYear()} PassGP · Admin Console</div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          {step === 'done' ? (
            <>
              <div className="auth-card__head">
                <h1>Password updated</h1>
                <p>Your new password is ready.</p>
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
                <p>Identity verified via your email link.</p>
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
          ) : step === 'sent' ? (
            <>
              <div className="auth-card__head">
                <h1>Check your email</h1>
                <p>If <strong>{email}</strong> is a registered admin, a secure reset link is on its way.</p>
              </div>
              <div className="alert alert--success" style={{ marginBottom: 20 }}>
                <FiCheck /> Open the link in that email to set a new password. It expires shortly for your security.
              </div>
              <Button variant="ghost" className="btn--block" onClick={() => setStep('email')}>Use a different email</Button>
            </>
          ) : (
            <>
              <div className="auth-card__head">
                <h1>Forgot password?</h1>
                <p>Enter your admin email and we'll send a secure reset link.</p>
              </div>
              {error && <div className="alert alert--error" style={{ marginBottom: 18 }}><FiAlertCircle /> {error}</div>}
              <form className="auth-form" onSubmit={sendResetEmail}>
                <div className="field">
                  <label>Email address</label>
                  <div className="input-icon">
                    <FiMail />
                    <input className="input" type="email" placeholder="admin@passgp.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                  </div>
                </div>
                <Button type="submit" loading={loading} className="btn--block" icon={<FiArrowRight />}>{loading ? 'Sending…' : 'Send reset link'}</Button>
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
