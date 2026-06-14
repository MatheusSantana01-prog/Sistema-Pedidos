/**
 * shared/tenant.js
 * Resolve o restaurante atual pela URL e aplica identidade visual quando apropriado.
 *
 * Padrão de URL: /r/{slug}/admin | /r/{slug}/cozinha | /r/{slug}/mesa/{token}
 * Também suporta subdomínio futuro: slug.meusaas.com.br
 */

const TENANT_API_URL = window.SAAS_CONFIG.API_URL || "";
const TENANT_CACHE_TTL_MS = 60000;
const PLATFORM_THEME_STORAGE_KEY = 'brickkode-platform-theme';
const PLATFORM_THEME_DEFAULTS = {
  bg: '#020617',
  primary: '#2563EB',
  accent: '#22D3EE',
  secondary: '#7C3AED',
  text: '#FFFFFF',
  muted: '#CBD5E1',
};

/**
 * Extrai o slug do restaurante a partir da URL atual.
 * Suporta /r/{slug}/... e subdomínio {slug}.dominio.com
 */
function getCurrentRestaurantSlug() {
  const path = window.location.pathname;

  // Padrão /r/{slug}/...
  const match = path.match(/^\/r\/([^\/]+)/);
  if (match) return match[1];

  // Subdomínio: slug.meusaas.com.br
  const host = window.location.hostname;
  const parts = host.split('.');
  if (parts.length >= 3) {
    // Ignora www e localhost
    if (parts[0] !== 'www' && parts[0] !== 'localhost') {
      return parts[0];
    }
  }

  return null;
}

/**
 * Busca configurações do restaurante pelo slug via API pública.
 * Retorna { id, name, slug, logo_url, cores..., settings... }
 */
async function fetchRestaurantConfig(slug) {
  if (!slug) throw new Error('Slug não informado');
  const cacheKey = `tenant-config:${slug}`;
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
    if (cached?.expiresAt > Date.now() && cached.data) return cached.data;
  } catch (_) {}
  const resp = await fetch(`${TENANT_API_URL}/api/public/restaurants/${slug}`);
  if (!resp.ok) throw new Error(`Restaurante '${slug}' não encontrado`);
  const data = await resp.json();
  const config = Array.isArray(data) ? data[0] : data;
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({
      expiresAt: Date.now() + TENANT_CACHE_TTL_MS,
      data: config,
    }));
  } catch (_) {}
  return config;
}

function readPlatformTheme() {
  try {
    return { ...PLATFORM_THEME_DEFAULTS, ...(JSON.parse(localStorage.getItem(PLATFORM_THEME_STORAGE_KEY) || '{}') || {}) };
  } catch (_) {
    return { ...PLATFORM_THEME_DEFAULTS };
  }
}

function applyPlatformTheme(theme = readPlatformTheme()) {
  const root = document.documentElement;
  root.style.setProperty('--bg', theme.bg || PLATFORM_THEME_DEFAULTS.bg);
  root.style.setProperty('--text', theme.text || PLATFORM_THEME_DEFAULTS.text);
  root.style.setProperty('--primary', theme.primary || PLATFORM_THEME_DEFAULTS.primary);
  root.style.setProperty('--secondary', theme.secondary || PLATFORM_THEME_DEFAULTS.secondary);
  root.style.setProperty('--accent', theme.accent || PLATFORM_THEME_DEFAULTS.accent);
  root.style.setProperty('--color-bg', theme.bg || PLATFORM_THEME_DEFAULTS.bg);
  root.style.setProperty('--color-primary', theme.primary || PLATFORM_THEME_DEFAULTS.primary);
  root.style.setProperty('--color-accent', theme.accent || PLATFORM_THEME_DEFAULTS.accent);
  root.style.setProperty('--color-secondary', theme.secondary || PLATFORM_THEME_DEFAULTS.secondary);
  root.style.setProperty('--color-text', theme.text || PLATFORM_THEME_DEFAULTS.text);
  root.style.setProperty('--muted', theme.muted || PLATFORM_THEME_DEFAULTS.muted);
}

function shouldApplyRestaurantTheme() {
  return /^\/r\/[^/]+\/mesa(?:\/|$)/.test(window.location.pathname);
}

function applyRestaurantIdentity(config, { updateFavicon = false } = {}) {
  if (!config) return;

  const logoEls = document.querySelectorAll('.restaurant-logo');
  logoEls.forEach(el => {
    if (config.logo_url) {
      el.src = config.logo_url;
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  });

  const nameEls = document.querySelectorAll('.restaurant-name');
  nameEls.forEach(el => { el.textContent = config.name || ''; });

  if (updateFavicon && config.logo_url) {
    let favicon = document.querySelector("link[rel='icon']");
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.href = config.logo_url;
  }

  if (config.name) {
    const suffix = document.title.includes('—') ? document.title.split('—')[1].trim() : document.title;
    document.title = `${config.name} — ${suffix}`;
  }
}

/**
 * Aplica tema visual do restaurante (cores, fonte, logo) via CSS variables.
 * Use somente nas páginas públicas do cliente final.
 */
function applyRestaurantTheme(config) {
  if (!config) return;

  const root = document.documentElement;
  root.style.setProperty('--color-primary',    config.primary_color    || '#ff4d1c');
  root.style.setProperty('--color-secondary',  config.secondary_color  || '#1a1a1a');
  root.style.setProperty('--color-accent',     config.accent_color     || '#ff6b3d');
  root.style.setProperty('--color-bg',         config.background_color || '#0a0a0a');
  root.style.setProperty('--color-text',       config.text_color       || '#f2f0eb');

  applyRestaurantIdentity(config, { updateFavicon: true });
}

/**
 * Inicializa o tenant na página atual.
 * Uso: const restaurant = await initTenant();
 */
async function initTenant() {
  const slug = getCurrentRestaurantSlug();
  if (!slug) {
    console.warn('[tenant] Nenhum slug encontrado na URL');
    return null;
  }

  try {
    const config = await fetchRestaurantConfig(slug);
    if (shouldApplyRestaurantTheme()) {
      applyRestaurantTheme(config);
    } else {
      applyPlatformTheme();
      applyRestaurantIdentity(config);
    }
    window.__RESTAURANT__ = config;
    return config;
  } catch (e) {
    console.error('[tenant]', e.message);
    // Mostrar tela de restaurante não encontrado
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;
                  height:100vh;background:#0a0a0a;color:#fff;font-family:sans-serif;
                  flex-direction:column;gap:12px;">
        <div style="font-size:48px;">🍽️</div>
        <h2 style="margin:0">Restaurante não encontrado</h2>
        <p style="color:#555;margin:0">Verifique o endereço e tente novamente.</p>
      </div>`;
    return null;
  }
}

// Expor globalmente
window.getCurrentRestaurantSlug = getCurrentRestaurantSlug;
window.fetchRestaurantConfig    = fetchRestaurantConfig;
window.applyRestaurantTheme     = applyRestaurantTheme;
window.applyRestaurantIdentity  = applyRestaurantIdentity;
window.applyPlatformTheme       = applyPlatformTheme;
window.readPlatformTheme        = readPlatformTheme;
window.initTenant               = initTenant;
