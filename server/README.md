# PassGP — Server (Node.js)

Secure backend for the PassGP AI oral examiner. It does two things:

1. **`POST /api/realtime/session`** — mints a short-lived **ephemeral token** so
   the browser can open a **WebRTC** voice connection straight to the OpenAI
   Realtime API. Your real `OPENAI_API_KEY` **never leaves the server**.
2. **`POST /api/chat`** — a **streaming (SSE)** text examiner using the Chat
   Completions API, as a fallback / text mode.

All models, endpoints, the voice and the port are configured **in code**
([`config.js`](config.js)). The **only** environment variable is `OPENAI_API_KEY`.

## Setup

```bash
cd server
cp .env.example .env        # then paste your real key into .env
npm install
npm run dev                 # http://localhost:5050  (or: npm start)
```

`.env`:

```
OPENAI_API_KEY=sk-...
```

## Endpoints

| Method | Path                     | Purpose                                  |
| ------ | ------------------------ | ---------------------------------------- |
| GET    | `/api/health`            | Service + model info                     |
| POST   | `/api/realtime/session`  | Ephemeral token for WebRTC voice         |
| POST   | `/api/chat`              | SSE streaming text examiner              |

`/api/chat` body:

```json
{
  "messages": [{ "role": "user", "content": "I'd start with a focused history." }],
  "candidateName": "Dr. Smith",
  "examType": "RACGP"
}
```

## How the secure voice flow works

```
Browser ──POST /api/realtime/session──▶ Server ──(real API key)──▶ OpenAI
Browser ◀──── ephemeral client_secret ──── Server
Browser ──WebRTC offer + ephemeral key────────────────────────────▶ OpenAI Realtime
Browser ◀──────────── audio + events (data channel) ───────────────  OpenAI Realtime
```

The prompt engineering for the examiner lives in
[`prompts/examiner.js`](prompts/examiner.js), including the hard-coded MVP case.
