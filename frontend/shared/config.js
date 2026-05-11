/**
 * shared/config.js
 * Config central do SaaS — ÚNICA fonte de verdade para URLs.
 * NUNCA colocar service_role_key aqui.
 */

const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

window.SAAS_CONFIG = {
  // Em produção no Vercel, deixe vazio para usar o proxy /api definido no vercel.json.
  // Em desenvolvimento local, usa o FastAPI local.
  API_URL: isLocalHost ? 'http://localhost:8000' : '',

  // Polling
  POLL_COZINHA: 5000,
  POLL_CLIENTE: 8000,
};
