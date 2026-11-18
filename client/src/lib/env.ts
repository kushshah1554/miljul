export const env = {
  // Production defaults to same-origin: vercel.json proxies /api and /auth to Render, keeping cookies first-party.
  backendUrl: import.meta.env.VITE_BACKEND_URL || (import.meta.env.PROD ? "" : "http://localhost:5000"),
};
