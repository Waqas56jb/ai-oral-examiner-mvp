import { useEffect, useState } from 'react'
import { FiCpu, FiSave, FiCheck, FiAlertCircle, FiMic, FiSliders } from 'react-icons/fi'
import { supabase } from '../lib/supabase'
import { Card, Button, PageLoader, Field } from '../components/ui'

const VOICES = ['marin', 'cedar', 'sage', 'verse', 'alloy', 'ash', 'coral', 'shimmer']
const DIFFICULTY = ['gentle', 'standard', 'rigorous']
const REALTIME_MODELS = ['gpt-realtime', 'gpt-4o-realtime-preview-2024-12-17']
const CHAT_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1']
const defaults = { voice: 'marin', difficulty: 'standard', realtimeModel: 'gpt-realtime', chatModel: 'gpt-4o-mini', examinerInstructions: '', systemPromptOverride: '' }

export default function AIConfig() {
  const [cfg, setCfg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'ai_config').maybeSingle()
      setCfg({ ...defaults, ...(data?.value || {}) })
      setLoading(false)
    })()
  }, [])

  const save = async () => {
    setSaving(true); setError(''); setSaved(false)
    const { error } = await supabase.from('app_settings').upsert({ key: 'ai_config', value: cfg, updated_at: new Date().toISOString() })
    setSaving(false)
    if (error) setError(error.message)
    else { setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }))

  if (loading) return <PageLoader />

  return (
    <>
      <div className="page-head">
        <div><h2>AI Configuration</h2><p>Tune how the AI examiner behaves and sounds</p></div>
        <div className="page-actions">
          {saved && <span className="badge badge--green"><FiCheck /> Saved</span>}
          <Button loading={saving} icon={<FiSave />} onClick={save}>Save changes</Button>
        </div>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 16 }}><FiAlertCircle /> {error}</div>}

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <Card title={<span><FiMic style={{ verticalAlign: '-2px' }} /> Voice</span>} sub="The examiner's spoken voice">
          <Field label="Voice model">
            <select className="select" value={cfg.voice} onChange={(e) => set('voice', e.target.value)}>
              {VOICES.map((v) => <option key={v} value={v}>{v}{v === 'marin' || v === 'cedar' ? ' (most natural)' : ''}</option>)}
            </select>
          </Field>
          <p className="muted" style={{ fontSize: '0.82rem', marginTop: 10 }}>marin & cedar are the most human-sounding. Applied to new sessions.</p>
        </Card>

        <Card title={<span><FiSliders style={{ verticalAlign: '-2px' }} /> Difficulty</span>} sub="How hard the examiner pushes">
          <Field label="Examiner difficulty">
            <select className="select" value={cfg.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
              {DIFFICULTY.map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
            </select>
          </Field>
          <p className="muted" style={{ fontSize: '0.82rem', marginTop: 10 }}>“Rigorous” probes harder and accepts fewer vague answers.</p>
        </Card>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <Card title={<span><FiCpu style={{ verticalAlign: '-2px' }} /> Voice model (Realtime)</span>} sub="The model that powers the live voice examiner">
          <Field label="Realtime model">
            <select className="select" value={cfg.realtimeModel} onChange={(e) => set('realtimeModel', e.target.value)}>
              {REALTIME_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <p className="muted" style={{ fontSize: '0.82rem', marginTop: 10 }}>gpt-realtime is the latest, most natural. Applied to new sessions.</p>
        </Card>

        <Card title={<span><FiCpu style={{ verticalAlign: '-2px' }} /> Grading model (Chat)</span>} sub="The model that writes the scored feedback report">
          <Field label="Chat model">
            <select className="select" value={cfg.chatModel} onChange={(e) => set('chatModel', e.target.value)}>
              {CHAT_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <p className="muted" style={{ fontSize: '0.82rem', marginTop: 10 }}>gpt-4o is more thorough; gpt-4o-mini is faster & cheaper.</p>
        </Card>
      </div>

      <Card title="Examiner instructions" sub="Extra guidance appended to the examiner's system prompt" style={{ marginBottom: 20 }}>
        <Field>
          <textarea className="textarea" style={{ minHeight: 130 }} value={cfg.examinerInstructions} onChange={(e) => set('examinerInstructions', e.target.value)} placeholder="e.g. Always ask about red flags. Spend extra time on management. Use Australian guidelines." />
        </Field>
      </Card>

      <Card title="System prompt override" sub="Advanced — replaces the base examiner prompt entirely. Leave blank to use the default.">
        <Field>
          <textarea className="textarea" style={{ minHeight: 180, fontFamily: 'monospace', fontSize: '0.85rem' }} value={cfg.systemPromptOverride} onChange={(e) => set('systemPromptOverride', e.target.value)} placeholder="Leave empty to use the built-in PassGP examiner prompt." />
        </Field>
        <p className="muted" style={{ fontSize: '0.82rem', marginTop: 10 }}>⚠️ Only use this if you know what you're doing — it overrides the carefully engineered default prompt.</p>
      </Card>
    </>
  )
}
