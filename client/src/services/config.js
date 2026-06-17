/**
 * Base URL for the PassGP backend API.
 *
 * Defaults to the live deployed backend. Override locally by creating a
 * client/.env file with:  VITE_API_BASE=http://localhost:5050
 */
export const API_BASE =
  import.meta.env.VITE_API_BASE || 'https://ai-oral-examiner-mvp-backend.vercel.app'

/** Build a full API URL from a path like "/api/feedback". */
export const apiUrl = (path) =>
  `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
