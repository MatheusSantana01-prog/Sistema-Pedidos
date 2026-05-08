const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'shared', 'config.js');
const config = {
  API_URL: process.env.API_URL || '',
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://lhrfemeunswviwzdpppp.supabase.co',
  SUPABASE_ANON:
    process.env.SUPABASE_ANON ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxocmZlbWV1bnN3dml3emRwcHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDUzMjYsImV4cCI6MjA4ODY4MTMyNn0.JsHPjGJCCAePfCicpvP4Fk-UWTwW8ve-SXjjLQN2mb4',
  POLL_COZINHA: Number(process.env.POLL_COZINHA || 5000),
  POLL_CLIENTE: Number(process.env.POLL_CLIENTE || 8000),
};

const content = `/**
 * shared/config.js
 * Config central do SaaS - UNICA fonte de verdade para URLs.
 * NUNCA colocar service_role_key aqui.
 */

(function () {
  const explicitApiUrl = ${JSON.stringify(config.API_URL)};
  const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  window.SAAS_CONFIG = {
    API_URL: explicitApiUrl || (isLocalHost ? 'http://localhost:8000' : ''),
    SUPABASE_URL: ${JSON.stringify(config.SUPABASE_URL)},
    SUPABASE_ANON: ${JSON.stringify(config.SUPABASE_ANON)},
    POLL_COZINHA: ${JSON.stringify(config.POLL_COZINHA)},
    POLL_CLIENTE: ${JSON.stringify(config.POLL_CLIENTE)}
  };
})();
`;

fs.writeFileSync(configPath, content, 'utf8');
console.log(`Generated shared/config.js with API_URL=${config.API_URL}`);
