// Central API endpoint configuration. Override at build time with VITE_API_URL
// (e.g. VITE_API_URL=https://api.example.com) so the app works outside localhost.
const rawBase = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

/** API origin, e.g. http://localhost:3000 (no trailing slash). */
export const API_BASE = String(rawBase).replace(/\/$/, '');

/** Versioned REST base, e.g. http://localhost:3000/api/v1. */
export const API_V1 = `${API_BASE}/api/v1`;

/** Public webhook ingestion URL for a given workflow id. */
export const webhookUrl = (id: string) => `${API_BASE}/api/v1/wh/${id}`;
