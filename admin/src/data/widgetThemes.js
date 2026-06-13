/**
 * 10 voice-agent widget templates — each a DISTINCT visual design.
 * `id` is saved to app_settings; `design` selects the shape/animation.
 */
export const widgetThemes = [
  { id: 'aurora',      name: 'Aurora',       desc: 'Flowing equalizer ribbon',      design: 'bars',    c1: '#22d3ee', c2: '#34d399', c3: '#a78bfa', bg: '#06121f' },
  { id: 'neon',        name: 'Neon Radar',   desc: 'Pulsing radar sweep',           design: 'radar',   c1: '#f0abfc', c2: '#22d3ee', c3: '#818cf8', bg: '#0a0a18' },
  { id: 'plasma',      name: 'Plasma Blob',  desc: 'Morphing molten energy',        design: 'blob',    c1: '#fb7185', c2: '#f59e0b', c3: '#e879f9', bg: '#1a0612' },
  { id: 'cosmic',      name: 'Cosmic',       desc: 'Orbiting particle system',      design: 'orbit',   c1: '#818cf8', c2: '#c084fc', c3: '#38bdf8', bg: '#070b1f' },
  { id: 'gold',        name: 'Golden Disc',  desc: '3D spinning gold disc',         design: 'disc',    c1: '#fbbf24', c2: '#f59e0b', c3: '#fcd34d', bg: '#1c1206' },
  { id: 'ocean',       name: 'Ocean Waves',  desc: 'Rolling sound waves',           design: 'waves',   c1: '#38bdf8', c2: '#22d3ee', c3: '#2563eb', bg: '#04121f' },
  { id: 'sunset',      name: 'Sunset',       desc: 'Glowing sun over horizon',      design: 'horizon', c1: '#fb7185', c2: '#fb923c', c3: '#f472b6', bg: '#190810' },
  { id: 'matrix',      name: 'Matrix Rain',  desc: 'Falling data streams',          design: 'rain',    c1: '#22c55e', c2: '#4ade80', c3: '#10b981', bg: '#04140a' },
  { id: 'holographic', name: 'Holographic',  desc: 'Iridescent spinning prism',     design: 'prism',   c1: '#f0abfc', c2: '#7dd3fc', c3: '#86efac', bg: '#0b0a1a' },
  { id: 'minimal',     name: 'Minimal',      desc: 'Clean pulse & waveform',        design: 'dot',     c1: '#60a5fa', c2: '#93c5fd', c3: '#cbd5e1', bg: '#0e1726' },
]

export const defaultWidgetTheme = 'cosmic'
