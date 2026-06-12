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
  voice: 'alloy', // alloy | ash | ballad | coral | echo | sage | shimmer | verse | marin | cedar

  // --- OpenAI Chat (text streaming fallback) ---
  chatModel: 'gpt-4o-mini',

  // --- Audio transcription (so user speech appears in the transcript) ---
  transcriptionModel: 'whisper-1',

  // CORS — allow the Vite dev server and same-origin by default
  allowedOrigins: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
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
