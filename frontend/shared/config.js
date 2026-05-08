/**
 * shared/config.js
 * Config central do SaaS - UNICA fonte de verdade para URLs.
 * NUNCA colocar service_role_key aqui.
 */

(function () {
  const explicitApiUrl = "";
  const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  window.SAAS_CONFIG = {
    API_URL: explicitApiUrl || (isLocalHost ? 'http://localhost:8000' : ''),
    SUPABASE_URL: "https://lhrfemeunswviwzdpppp.supabase.co",
    SUPABASE_ANON: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxocmZlbWV1bnN3dml3emRwcHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDUzMjYsImV4cCI6MjA4ODY4MTMyNn0.JsHPjGJCCAePfCicpvP4Fk-UWTwW8ve-SXjjLQN2mb4",
    POLL_COZINHA: 5000,
    POLL_CLIENTE: 8000
  };
})();
