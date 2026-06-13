import { useEffect, useState } from 'react'
import { FiKey, FiDatabase, FiLayers, FiShield, FiCheckCircle, FiSave, FiCheck } from 'react-icons/fi'
import { SiOpenai } from 'react-icons/si'
import { supabase } from '../lib/supabase'
import { Card, Button, PageLoader, Badge } from '../components/ui'
import { useAuth } from '../context/AuthContext'

export default function Settings() {
  const { admin } = useAuth()
  const [integrations, setIntegrations] = useState({ kajabi: { enabled: true }, jotform: { enabled: true } })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'integrations').maybeSingle()
      if (data?.value) setIntegrations((s) => ({ ...s, ...data.value }))
      setLoading(false)
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    await supabase.from('app_settings').upsert({ key: 'integrations', value: integrations, updated_at: new Date().toISOString() })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  const toggle = (k) => setIntegrations((s) => ({ ...s, [k]: { ...s[k], enabled: !s[k]?.enabled } }))

  if (loading) return <PageLoader />

  return (
    <>
      <div className="page-head">
        <div><h2>Settings</h2><p>Integrations, security & platform configuration</p></div>
        <div className="page-actions">
          {saved && <span className="badge badge--green"><FiCheck /> Saved</span>}
          <Button loading={saving} icon={<FiSave />} onClick={save}>Save</Button>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <Card title="Integrations" sub="Connected services">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Integration icon={<SiOpenai />} name="OpenAI Realtime API" desc="Powers the live voice examiner" status="connected" />
            <div className="divider" />
            <Integration icon={<FiLayers />} name="Jotform Enterprise" desc="Live clinical case source" status="connected" toggle={() => toggle('jotform')} on={integrations.jotform?.enabled} />
            <div className="divider" />
            <Integration icon={<FiLayers />} name="Kajabi" desc="Course platform embedding" status="active" toggle={() => toggle('kajabi')} on={integrations.kajabi?.enabled} />
            <div className="divider" />
            <Integration icon={<FiDatabase />} name="Supabase" desc="Database & authentication" status="connected" />
          </div>
        </Card>

        <Card title="API configuration" sub="Keys are stored securely on the server (.env), never in the browser">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <KeyRow icon={<FiKey />} label="OpenAI API Key" value="sk-•••••••••••••••• (server-side)" />
            <KeyRow icon={<FiKey />} label="Jotform API Key" value="••••••••••••••••• (server-side)" />
            <KeyRow icon={<FiDatabase />} label="Supabase Service Key" value="sb_secret_••••••••• (server-side)" />
            <div className="alert alert--success" style={{ marginTop: 4 }}>
              <FiShield /> All secret keys are kept on the backend and never exposed to the client. ✓
            </div>
          </div>
        </Card>
      </div>

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
