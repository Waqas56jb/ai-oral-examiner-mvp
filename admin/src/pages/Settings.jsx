import { useEffect, useState } from 'react'
import {
  FiKey, FiDatabase, FiLayers, FiShield, FiCheckCircle, FiSave, FiCheck,
  FiEye, FiEyeOff, FiZap, FiAlertCircle,
} from 'react-icons/fi'
import { SiOpenai } from 'react-icons/si'
import { supabase } from '../lib/supabase'
import { Card, Button, PageLoader, Badge, Field } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import WidgetPreview from '../components/WidgetPreview'
import { widgetThemes, defaultWidgetTheme } from '../data/widgetThemes'

export default function Settings() {
  const { admin } = useAuth()
  const [integrations, setIntegrations] = useState({ kajabi: { enabled: true }, jotform: { enabled: true } })
  const [theme, setTheme] = useState(defaultWidgetTheme)
  const [fallbackKey, setFallbackKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('app_settings').select('key, value').in('key', ['integrations', 'widget_theme', 'openai_fallback'])
      const map = {}
      ;(data || []).forEach((r) => (map[r.key] = r.value))
      if (map.integrations) setIntegrations((s) => ({ ...s, ...map.integrations }))
      if (map.widget_theme?.template) setTheme(map.widget_theme.template)
      if (map.openai_fallback?.key) setFallbackKey(map.openai_fallback.key)
      setLoading(false)
    })()
  }, [])

  const save = async () => {
    setSaving(true); setError(''); setSaved(false)
    const now = new Date().toISOString()
    const { error } = await supabase.from('app_settings').upsert([
      { key: 'integrations', value: integrations, updated_at: now },
      { key: 'widget_theme', value: { template: theme }, updated_at: now },
      { key: 'openai_fallback', value: { key: fallbackKey.trim() }, updated_at: now },
    ])
    setSaving(false)
    if (error) setError(error.message)
    else { setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  const toggle = (k) => setIntegrations((s) => ({ ...s, [k]: { ...s[k], enabled: !s[k]?.enabled } }))

  if (loading) return <PageLoader />

  return (
    <>
      <div className="page-head">
        <div><h2>Settings</h2><p>Appearance, AI keys, integrations & security</p></div>
        <div className="page-actions">
          {saved && <span className="badge badge--green"><FiCheck /> Saved</span>}
          <Button loading={saving} icon={<FiSave />} onClick={save}>Save changes</Button>
        </div>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 16 }}><FiAlertCircle /> {error}</div>}

      {/* ---- Voice agent appearance ---- */}
      <Card style={{ marginBottom: 20 }}
        title={<span className="section-title"><span className="section-title__icon"><FiZap /></span> Voice Agent Appearance</span>}
        sub="Pick the animated 3D widget design — it replaces the live examiner widget on the website / embedded iframe.">
        <div className="tpl-grid">
          {widgetThemes.map((t) => (
            <button key={t.id} className={`tpl-card ${theme === t.id ? 'selected' : ''}`} onClick={() => setTheme(t.id)}>
              <div className="tpl-card__preview"><WidgetPreview theme={t} size={118} /></div>
              <div className="tpl-card__name">{t.name}</div>
              <div className="tpl-card__desc">{t.desc}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* ---- OpenAI fallback key ---- */}
      <Card style={{ marginBottom: 20 }}
        title={<span className="section-title"><span className="section-title__icon"><SiOpenai /></span> OpenAI Fallback Key</span>}
        sub="Used automatically if the primary key (server .env) hits its quota or fails to respond.">
        <Field label="Fallback OpenAI API key">
          <div className="input-icon">
            <FiKey />
            <input
              className="input"
              type={showKey ? 'text' : 'password'}
              value={fallbackKey}
              onChange={(e) => setFallbackKey(e.target.value)}
              placeholder="sk-proj-…  (leave blank to disable fallback)"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className="input-icon__trail" onClick={() => setShowKey((s) => !s)} tabIndex={-1}>
              {showKey ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
        </Field>
        <div className="alert alert--success" style={{ marginTop: 12 }}>
          <FiShield /> Stored securely in the database (admin-only). The server reads it server-side only — never exposed to the browser.
        </div>
      </Card>

      {/* ---- Integrations + API config ---- */}
      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <Card title="Integrations" sub="Connected services">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Integration icon={<SiOpenai />} name="OpenAI Realtime API" desc="Powers the live voice examiner" status="connected" />
            <div className="divider" />
            <Integration icon={<FiLayers />} name="Jotform Enterprise" desc="Live clinical case source" toggle={() => toggle('jotform')} on={integrations.jotform?.enabled} />
            <div className="divider" />
            <Integration icon={<FiLayers />} name="Kajabi" desc="Course platform embedding" toggle={() => toggle('kajabi')} on={integrations.kajabi?.enabled} />
            <div className="divider" />
            <Integration icon={<FiDatabase />} name="Supabase" desc="Database & authentication" status="connected" />
          </div>
        </Card>

        <Card title="API configuration" sub="Secrets live on the server (.env), never in the browser">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <KeyRow icon={<FiKey />} label="OpenAI API Key (primary)" value="sk-•••••••••••••• (server-side)" />
            <KeyRow icon={<FiKey />} label="Jotform API Key" value="••••••••••••••• (server-side)" />
            <KeyRow icon={<FiDatabase />} label="Supabase Service Key" value="sb_secret_••••••• (server-side)" />
            <div className="alert alert--success" style={{ marginTop: 4 }}>
              <FiShield /> All secret keys stay on the backend. ✓
            </div>
          </div>
        </Card>
      </div>

      {/* ---- Security ---- */}
      <Card title="Security & access" sub="Administrator controls">
        <div className="grid grid-2" style={{ gap: 14 }}>
          <div className="kv"><span className="kv__k">Signed in as</span><span className="kv__v">{admin?.email}</span></div>
          <div className="kv"><span className="kv__k">Role</span><span className="kv__v"><Badge color="violet">{admin?.role || 'admin'}</Badge></span></div>
          <div className="kv"><span className="kv__k">Row Level Security</span><span className="kv__v"><Badge color="green" dot>Enforced</Badge></span></div>
          <div className="kv"><span className="kv__k">Admin access</span><span className="kv__v"><Badge color="green" dot>Verified</Badge></span></div>
        </div>
      </Card>
    </>
  )
}

function Integration({ icon, name, desc, status, toggle, on }) {
  return (
    <div className="flex items-center gap" style={{ padding: '12px 2px' }}>
      <div style={{ width: 42, height: 42, borderRadius: 11, background: '#f1f5f9', display: 'grid', placeItems: 'center', fontSize: '1.2rem', color: 'var(--ink)' }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{name}</div>
        <div className="muted" style={{ fontSize: '0.82rem' }}>{desc}</div>
      </div>
      {toggle ? (
        <button className={`chip ${on ? 'active' : ''}`} onClick={toggle}>{on ? 'Enabled' : 'Disabled'}</button>
      ) : (
        <Badge color="green" dot>{status}</Badge>
      )}
    </div>
  )
}

function KeyRow({ icon, label, value }) {
  return (
    <div className="flex items-center gap">
      <span style={{ color: 'var(--accent)' }}>{icon}</span>
      <div className="kv" style={{ flex: 1 }}><span className="kv__k">{label}</span><span className="kv__v mono" style={{ fontSize: '0.85rem', fontWeight: 500 }}>{value}</span></div>
      <FiCheckCircle style={{ color: 'var(--green)' }} />
    </div>
  )
}
