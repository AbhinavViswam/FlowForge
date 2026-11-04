// Where the website finds the API.
//
// - Development (npm run dev): the API on http://localhost:3000.
// - Production build: the same address the website is served from (the API
//   serves the website), unless VITE_API_URL is set at build time to an API
//   hosted somewhere else, e.g. VITE_API_URL=https://api.example.com.
// Written as import.meta.env.X so Vite fills these in at build time (and drops
// the development address from production builds).
const configured = String((import.meta as any).env.VITE_API_URL || '').trim();
const rawBase = configured || ((import.meta as any).env.DEV ? 'http://localhost:3000' : '');

/** API origin, e.g. http://localhost:3000, or '' for "same address as the website". */
export const API_BASE = String(rawBase).replace(/\/$/, '');

/** Versioned REST base, e.g. http://localhost:3000/api/v1 (or /api/v1). */
export const API_V1 = `${API_BASE}/api/v1`;

/** Full API address for links people copy elsewhere (webhook URLs). */
export const PUBLIC_API_BASE = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');

/** Public webhook ingestion URL for a given workflow id. */
export const webhookUrl = (id: string) => `${PUBLIC_API_BASE}/api/v1/wh/${id}`;
