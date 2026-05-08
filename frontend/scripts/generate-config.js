const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'shared', 'config.js');
const defaultApiUrl = process.env.VERCEL
  ? ''
  : 'http://localhost:8000';

const config = {
  API_URL: process.env.API_URL || defaultApiUrl,
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://lhrfemeunswviwzdpppp.supabase.co',
  SUPABASE_ANON:
    process.env.SUPABASE_ANON ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxocmZlbWV1bnN3dml3emRwcHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDUzMjYsImV4cCI6MjA4ODY4MTMyNn0.JsHPjGJCCAePfCicpvP4Fk-UWTwW8ve-SXjjLQN2mb4',
  POLL_COZINHA: Number(process.env.POLL_COZINHA || 8000),
  POLL_CLIENTE: Number(process.env.POLL_CLIENTE || 10000),
};

const content = `/**
 * shared/config.js
 * Config central do SaaS - gerada no build.
 * NUNCA colocar service_role_key aqui.
 */

window.SAAS_CONFIG = ${JSON.stringify(config, null, 2)};
`;

fs.writeFileSync(configPath, content, 'utf8');
console.log(`Generated shared/config.js with API_URL=${config.API_URL}`);
