/**
 * Central configuration.
 *
 * IMPORTANT: Models, endpoints, voice and port all live HERE in code.
 * The ONLY secret that comes from the environment (.env) is OPENAI_API_KEY.
 */

export const config = {
  // Server
  port: process.env.PORT || 5050,

  // --- OpenAI Realtime (voice) — GA API ---
  realtimeModel: 'gpt-realtime', // GA model (or 'gpt-4o-realtime-preview-2024-12-17')
  // Mint a short-lived ephemeral token here (server-side, real key):
  realtimeClientSecretsUrl: 'https://api.openai.com/v1/realtime/client_secrets',
  // Browser opens the WebRTC call here using the ephemeral token:
  realtimeCallsUrl: 'https://api.openai.com/v1/realtime/calls',
  voice: 'marin', // most natural/human voices: marin | cedar | sage | verse

  // --- OpenAI Chat (text streaming fallback) ---
  chatModel: 'gpt-4o-mini',

  // --- Audio transcription (so user speech appears in the transcript) ---
  transcriptionModel: 'whisper-1',

  // CORS — STRICT allow-list. Only these origins may call the API.
  // Add PassGP production / Kajabi custom domains via the ALLOWED_ORIGINS env var
  // (comma-separated), e.g. ALLOWED_ORIGINS=https://app.passgp.com,https://passgp.kajabi.com
  allowedOrigins: [
    // Local dev (Vite)
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://localhost:4173',
    // Live deployments (client account)
    'https://ai-oral-examiner-mvp-backend.vercel.app',
    'https://ai-oral-examiner-mvp-admin.vercel.app',
    'https://ai-oral-examiner-mvp-chatbot.vercel.app',
    // Extra origins from the environment (PassGP / Kajabi domains)
    ...String(process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim().replace(/\/$/, ''))
      .filter(Boolean),
  ],
}

export function getApiKey() {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    throw new Error(
      'OPENAI_API_KEY is missing. Create server/.env with OPENAI_API_KEY=sk-...'
    )
  }
  return key
}
