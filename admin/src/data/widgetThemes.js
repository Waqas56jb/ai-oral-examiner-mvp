/**
 * 10 voice-agent widget appearance templates.
 * `id` is saved to app_settings → the client widget renders the matching theme.
 * Each template drives an animated 3D-style orb preview via CSS variables.
 */
export const widgetThemes = [
  { id: 'aurora',       name: 'Aurora',        desc: 'Flowing northern-lights gradients', c1: '#22d3ee', c2: '#34d399', c3: '#a78bfa', bg: '#06121f', anim: 'flow' },
  { id: 'neon',         name: 'Neon Pulse',    desc: 'Electric cyber neon glow',          c1: '#f0abfc', c2: '#22d3ee', c3: '#818cf8', bg: '#0a0a18', anim: 'pulse' },
  { id: 'plasma',       name: 'Plasma',        desc: 'Molten magenta–orange energy',       c1: '#fb7185', c2: '#f59e0b', c3: '#e879f9', bg: '#1a0612', anim: 'plasma' },
  { id: 'cosmic',       name: 'Cosmic',        desc: 'Deep-space violet starfield',        c1: '#818cf8', c2: '#c084fc', c3: '#38bdf8', bg: '#070b1f', anim: 'orbit' },
  { id: 'gold',         name: 'Golden Hour',   desc: 'Luxe gold & amber shimmer',          c1: '#fbbf24', c2: '#f59e0b', c3: '#fcd34d', bg: '#1c1206', anim: 'shimmer' },
  { id: 'ocean',        name: 'Ocean',         desc: 'Calm deep-sea blue ripples',         c1: '#38bdf8', c2: '#22d3ee', c3: '#2563eb', bg: '#04121f', anim: 'wave' },
  { id: 'sunset',       name: 'Sunset',        desc: 'Warm pink-to-orange dusk',           c1: '#fb7185', c2: '#fb923c', c3: '#f472b6', bg: '#190810', anim: 'flow' },
  { id: 'matrix',       name: 'Matrix',        desc: 'Digital emerald data-stream',        c1: '#22c55e', c2: '#4ade80', c3: '#10b981', bg: '#04140a', anim: 'pulse' },
  { id: 'holographic',  name: 'Holographic',   desc: 'Iridescent rainbow sheen',           c1: '#f0abfc', c2: '#7dd3fc', c3: '#86efac', bg: '#0b0a1a', anim: 'holo' },
  { id: 'minimal',      name: 'Minimal Mono',  desc: 'Clean, quiet, professional',         c1: '#60a5fa', c2: '#93c5fd', c3: '#cbd5e1', bg: '#0e1726', anim: 'pulse' },
]

export const defaultWidgetTheme = 'cosmic'
