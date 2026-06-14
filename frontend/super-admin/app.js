let RESTAURANTES = [];
let mostrarInativos = false;
let DETALHE_ATUAL = null;
let FINANCEIRO_ITEMS = [];
let SUPORTE_ITEMS = [];
let suportePollingHandle = null;
const PLATFORM_THEME_STORAGE_KEY = 'brickkode-platform-theme';
const PLATFORM_THEME_DEFAULTS = {
  bg: '#020617',
  primary: '#2563EB',
  accent: '#22D3EE',
  secondary: '#7C3AED',
  text: '#FFFFFF',
  muted: '#CBD5E1',
};

const PLANOS = {
  starter: {
    label: 'Básico',
    headline: 'QR Code, pedidos digitais e operação essencial.',
    basePrice: 79,
    limits: { users: 5, tables: 10, products: 100, registers: 2 },
    modules: { financeiro: true, cupons: false, garcom: false, relatorios: false, custom_branding: false, backups: false, advanced_reports: false, priority_support: false, api_integrations: false, ifood: false, whatsapp: false, multiunit: false },
  },
  pro: {
    label: 'Pro',
    headline: 'Plano recomendado para salão, cozinha, caixa e atendimento.',
    basePrice: 149,
    limits: { users: 15, tables: 60, products: 400, registers: 3 },
    modules: { financeiro: true, cupons: false, garcom: true, relatorios: true, custom_branding: true, backups: false, advanced_reports: false, priority_support: false, api_integrations: false, ifood: false, whatsapp: false, multiunit: false },
  },
  enterprise: {
    label: 'Premium',
    headline: 'Escala, suporte e integrações premium em evolução.',
    basePrice: 249,
    limits: { users: 9999, tables: 9999, products: 9999, registers: 20 },
    modules: { financeiro: true, cupons: true, garcom: true, relatorios: true, custom_branding: true, backups: true, advanced_reports: true, priority_support: true, api_integrations: false, ifood: false, whatsapp: false, multiunit: false },
  },
};

const BUSINESS_TYPE_OPTIONS = [
  ['restaurante', 'Restaurante'],
  ['pizzaria', 'Pizzaria'],
  ['padaria', 'Padaria'],
  ['cafeteria', 'Cafeteria'],
  ['hamburgueria', 'Hamburgueria'],
  ['bar', 'Bar'],
  ['delivery_only', 'Delivery only'],
];

const BUSINESS_TYPE_PRESETS = {
  restaurante: { mesas: true, comandas: true, qr_code: true, garcom: true, cozinha: true, caixa: true, estoque: true, ficha_tecnica: true, delivery: true, encomendas: false, venda_peso: false, codigo_barras: false, pizza_meio_a_meio: false, pizza_bordas: false, pizza_tamanhos: false, producao_padaria: false, lotes_validade: false, balcao_rapido: true, fiscal: true, relatorios_avancados: true },
  pizzaria: { mesas: true, comandas: true, qr_code: true, garcom: true, cozinha: true, caixa: true, estoque: true, ficha_tecnica: true, delivery: true, encomendas: true, venda_peso: false, codigo_barras: false, pizza_meio_a_meio: true, pizza_bordas: true, pizza_tamanhos: true, producao_padaria: false, lotes_validade: false, balcao_rapido: true, fiscal: true, relatorios_avancados: true },
  padaria: { mesas: false, comandas: false, qr_code: false, garcom: false, cozinha: true, caixa: true, estoque: true, ficha_tecnica: true, delivery: true, encomendas: true, venda_peso: true, codigo_barras: true, pizza_meio_a_meio: false, pizza_bordas: false, pizza_tamanhos: false, producao_padaria: true, lotes_validade: true, balcao_rapido: true, fiscal: true, relatorios_avancados: true },
  cafeteria: { mesas: true, comandas: true, qr_code: true, garcom: false, cozinha: true, caixa: true, estoque: true, ficha_tecnica: true, delivery: true, encomendas: true, venda_peso: false, codigo_barras: true, pizza_meio_a_meio: false, pizza_bordas: false, pizza_tamanhos: false, producao_padaria: false, lotes_validade: true, balcao_rapido: true, fiscal: true, relatorios_avancados: true },
  hamburgueria: { mesas: true, comandas: true, qr_code: true, garcom: true, cozinha: true, caixa: true, estoque: true, ficha_tecnica: true, delivery: true, encomendas: true, venda_peso: false, codigo_barras: false, pizza_meio_a_meio: false, pizza_bordas: false, pizza_tamanhos: false, producao_padaria: false, lotes_validade: false, balcao_rapido: true, fiscal: true, relatorios_avancados: true },
  bar: { mesas: true, comandas: true, qr_code: true, garcom: true, cozinha: true, caixa: true, estoque: true, ficha_tecnica: true, delivery: true, encomendas: false, venda_peso: false, codigo_barras: false, pizza_meio_a_meio: false, pizza_bordas: false, pizza_tamanhos: false, producao_padaria: false, lotes_validade: false, balcao_rapido: true, fiscal: true, relatorios_avancados: true },
  delivery_only: { mesas: false, comandas: false, qr_code: false, garcom: false, cozinha: true, caixa: true, estoque: true, ficha_tecnica: true, delivery: true, encomendas: true, venda_peso: false, codigo_barras: false, pizza_meio_a_meio: false, pizza_bordas: false, pizza_tamanhos: false, producao_padaria: false, lotes_validade: false, balcao_rapido: true, fiscal: true, relatorios_avancados: true },
};

const MODULE_LABELS = {
  financeiro: 'Financeiro e caixa',
  cupons: 'Cupons',
  garcom: 'Garçom e chamadas',
  relatorios: 'Relatórios',
  custom_branding: 'Personalização avançada',
  backups: 'Backups automáticos',
  advanced_reports: 'Relatórios avançados',
  priority_support: 'Suporte prioritário',
  api_integrations: 'API para integrações',
  ifood: 'iFood',
  whatsapp: 'WhatsApp',
  multiunit: 'Multiunidade',
  mesas: 'Mesas',
  comandas: 'Comandas',
  qr_code: 'QR Code',
  cozinha: 'Cozinha',
  caixa: 'Caixa',
  estoque: 'Estoque',
  ficha_tecnica: 'Ficha técnica',
  delivery: 'Delivery',
  encomendas: 'Encomendas',
  venda_peso: 'Venda por peso',
  codigo_barras: 'Código de barras',
  pizza_meio_a_meio: 'Pizza meio a meio',
  pizza_bordas: 'Bordas de pizza',
  pizza_tamanhos: 'Tamanhos de pizza',
  producao_padaria: 'Produção padaria',
  lotes_validade: 'Lotes e validade',
  balcao_rapido: 'Balcão rápido',
  fiscal: 'Fiscal',
  relatorios_avancados: 'Relatórios avançados',
};

const IMPLEMENTED_MODULES = new Set([
  'mesas', 'comandas', 'qr_code', 'garcom', 'cozinha', 'caixa', 'estoque', 'ficha_tecnica',
  'balcao_rapido', 'fiscal', 'relatorios_avancados', 'financeiro', 'relatorios',
  'backups', 'advanced_reports', 'priority_support',
]);
const FUTURE_MODULES = new Set([
  'delivery', 'encomendas', 'venda_peso', 'codigo_barras', 'pizza_meio_a_meio', 'pizza_bordas',
  'pizza_tamanhos', 'producao_padaria', 'lotes_validade', 'cupons', 'custom_branding',
  'api_integrations', 'ifood', 'whatsapp', 'multiunit',
]);

/* ── LOGIN ──────────────────────────────────────────── */
async function fazerLogin() {
  const email = document.getElementById('l-email').value.trim();
  const senha = document.getElementById('l-senha').value.trim();
  const remember = document.getElementById('l-remember')?.checked === true;
  const btn   = document.querySelector('.btn-primary');
  const erro  = document.getElementById('login-erro');
  btn.disabled = true;
  document.getElementById('login-txt').textContent = 'Entrando...';
  try {
    const data = await login(email, senha, null, { remember });
    if (!data.usuario?.is_super_admin) {
      throw new Error('Sem acesso de super admin');
    }
    if (remember) localStorage.setItem('super_admin_saved_login', email);
    else localStorage.removeItem('super_admin_saved_login');
    iniciarApp(data.usuario);
  } catch(e) {
    erro.textContent = e.message;
    erro.classList.add('show');
  } finally {
    btn.disabled = false;
    document.getElementById('login-txt').textContent = 'Entrar';
  }
}

function fazerLogout() {
  logout();
  clearTimeout(suportePollingHandle);
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

function iniciarApp(u) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'flex';
  document.getElementById('user-email').textContent = u.email;
  carregarTemaPlataforma();
  carregarRestaurantes();
  iniciarPollingSuporteSuper();
}

if (isLoggedIn() && getUsuario()?.is_super_admin) {
  iniciarApp(getUsuario());
}

document.addEventListener('DOMContentLoaded', () => {
  carregarTemaPlataforma();
  const savedLogin = localStorage.getItem('super_admin_saved_login') || '';
  if (savedLogin) {
    const email = document.getElementById('l-email');
    const remember = document.getElementById('l-remember');
    if (email) email.value = savedLogin;
    if (remember) remember.checked = true;
  }
});

function iniciarPollingSuporteSuper() {
  clearTimeout(suportePollingHandle);
  carregarContadorSuporteSuper(false);
  const tick = () => {
    suportePollingHandle = setTimeout(async () => {
      await carregarContadorSuporteSuper(false);
      tick();
    }, 60000);
  };
  tick();
}

/* ── NAV ────────────────────────────────────────────── */
function irPara(pagina, tabEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + pagina).classList.add('active');
  tabEl.classList.add('active');
  const loaders = { restaurantes: carregarRestaurantes, usuarios: carregarUsuarios, financeiro: carregarFinanceiroPlataforma, suporte: carregarSuportePlataforma, metricas: carregarMetricas, operacao: carregarOperacao, tema: carregarTemaPlataforma, auditoria: carregarAuditoria, validacao: () => {} };
  if (loaders[pagina]) loaders[pagina]();
}

function lerTemaPlataforma() {
  try {
    return { ...PLATFORM_THEME_DEFAULTS, ...(JSON.parse(localStorage.getItem(PLATFORM_THEME_STORAGE_KEY) || '{}') || {}) };
  } catch (_) {
    return { ...PLATFORM_THEME_DEFAULTS };
  }
}

function aplicarTemaPlataforma(theme = lerTemaPlataforma()) {
  const root = document.documentElement;
  root.style.setProperty('--bg', theme.bg);
  root.style.setProperty('--panel', '#0f172a');
  root.style.setProperty('--text', theme.text);
  root.style.setProperty('--muted', theme.muted);
  root.style.setProperty('--primary', theme.primary);
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--secondary', theme.secondary);
  root.style.setProperty('--color-bg', theme.bg);
  root.style.setProperty('--color-primary', theme.primary);
  root.style.setProperty('--color-accent', theme.accent);
  root.style.setProperty('--color-secondary', theme.secondary);
  root.style.setProperty('--color-text', theme.text);
}

function preencherCamposTema(theme) {
  const map = {
    'theme-bg': theme.bg,
    'theme-primary': theme.primary,
    'theme-accent': theme.accent,
    'theme-secondary': theme.secondary,
    'theme-text': theme.text,
    'theme-muted': theme.muted,
  };
  Object.entries(map).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });
}

function carregarTemaPlataforma() {
  const theme = lerTemaPlataforma();
  aplicarTemaPlataforma(theme);
  preencherCamposTema(theme);
}

function temaPlataformaDosCampos() {
  return {
    bg: document.getElementById('theme-bg')?.value || PLATFORM_THEME_DEFAULTS.bg,
    primary: document.getElementById('theme-primary')?.value || PLATFORM_THEME_DEFAULTS.primary,
    accent: document.getElementById('theme-accent')?.value || PLATFORM_THEME_DEFAULTS.accent,
    secondary: document.getElementById('theme-secondary')?.value || PLATFORM_THEME_DEFAULTS.secondary,
    text: document.getElementById('theme-text')?.value || PLATFORM_THEME_DEFAULTS.text,
    muted: document.getElementById('theme-muted')?.value || PLATFORM_THEME_DEFAULTS.muted,
  };
}

function previewTemaPlataforma() {
  aplicarTemaPlataforma(temaPlataformaDosCampos());
}

function salvarTemaPlataforma() {
  const theme = temaPlataformaDosCampos();
  localStorage.setItem(PLATFORM_THEME_STORAGE_KEY, JSON.stringify(theme));
  aplicarTemaPlataforma(theme);
  showToast('Tema da plataforma atualizado', 'success');
}

function restaurarTemaPlataforma() {
  localStorage.removeItem(PLATFORM_THEME_STORAGE_KEY);
  preencherCamposTema(PLATFORM_THEME_DEFAULTS);
  aplicarTemaPlataforma(PLATFORM_THEME_DEFAULTS);
  showToast('Tema BrickKode restaurado', 'success');
}

/* ── RESTAURANTES ───────────────────────────────────── */
async function carregarRestaurantes() {
  document.getElementById('restaurantes-lista').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const { restaurants } = await apiCall('GET', '/api/super-admin/restaurants');
    RESTAURANTES = restaurants || [];

    // Popular select do modal de usuário
    const sel = document.getElementById('u-restaurant');
    if (sel) {
      sel.innerHTML = RESTAURANTES.map(r => `<option value="${escapeAttr(r.id)}">${escapeHtml(r.name)} (${escapeHtml(r.slug)})</option>`).join('');
    }

    const visiveis = mostrarInativos ? RESTAURANTES : RESTAURANTES.filter(r => r.is_active);

    document.getElementById('restaurantes-lista').innerHTML = !visiveis.length
      ? '<div style="padding:32px;text-align:center;color:var(--muted)">Nenhum restaurante</div>'
      : visiveis.map(r => `
        <div class="rest-card">
          <div class="rest-color" style="background:${r.primary_color||'#ff4d1c'}"></div>
          <div class="rest-info">
            <div class="rest-nome">${escapeHtml(r.name)}</div>
            <div class="rest-slug">/r/${escapeHtml(r.slug)}</div>
            <div class="rest-badges">
              <span class="badge ${r.is_active ? 'badge-active' : 'badge-inactive'}">${r.is_active ? '● Ativo' : '● Inativo'}</span>
              <span class="badge badge-plan">${planLabel(r.plan)}</span>
              <span class="badge" style="background:rgba(255,255,255,.05);color:var(--muted)">${new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
          <div class="rest-actions">
            <button class="btn btn-sm btn-primary" onclick="abrirDetalhesRestaurante('${r.id}')">Detalhes</button>
            <a class="btn btn-sm" href="/r/${escapeAttr(r.slug)}/admin" target="_blank" rel="noopener">Admin</a>
            <button class="btn btn-sm" onclick="verQRCodes('${escapeJs(r.id)}','${escapeJs(r.name)}')">QR Codes</button>
            <button class="btn btn-sm ${r.is_active?'btn-danger':''}" onclick="toggleAtivo('${r.id}',${r.is_active})">
              ${r.is_active ? 'Desativar' : 'Ativar'}
            </button>
            <button class="btn btn-sm btn-danger" onclick="deletarRestaurante('${escapeJs(r.id)}','${escapeJs(r.name)}')">Deletar</button>
          </div>
        </div>`).join('');
  } catch(e) {
    document.getElementById('restaurantes-lista').innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted)">Erro: ' + e.message + '</div>';
  }
}

async function toggleAtivo(id, atual) {
  if (!await appConfirm(`${atual ? 'Desativar' : 'Ativar'} este restaurante?`, { title: atual ? 'Desativar restaurante' : 'Ativar restaurante', danger: atual })) return;
  try {
    await apiCall('PATCH', `/api/super-admin/restaurants/${id}/status`, { is_active: !atual });
    showToast(atual ? 'Restaurante desativado' : 'Restaurante ativado', 'success');
    carregarRestaurantes();
  } catch(e) { showToast(e.message, 'error'); }
}

async function deletarRestaurante(id, nome) {
  const ok = await appConfirm(`Deletar "${nome}"? Se o backend já estiver atualizado, os dados serão apagados. Se ainda não estiver, ele será desativado e removido desta lista.`, { title: 'Deletar restaurante', danger: true, confirmText: 'Deletar' });
  if (!ok) return;
  try {
    await apiCall('DELETE', `/api/super-admin/restaurants/${id}`);
    showToast('Restaurante deletado', 'success');
    carregarRestaurantes();
  } catch(e) {
    if (String(e.message || '').toLowerCase().includes('not found')) {
      await apiCall('PATCH', `/api/super-admin/restaurants/${id}/status`, { is_active: false });
      showToast('Backend sem DELETE ainda. Restaurante desativado e removido da lista.', 'success');
      carregarRestaurantes();
      return;
    }
    showToast(e.message, 'error');
  }
}

async function verQRCodes(restId, nome) {
  const modal = document.getElementById('modal-qrcodes');
  const title = document.getElementById('qr-modal-title');
  const body = document.getElementById('qr-modal-body');
  title.textContent = `QR Codes - ${nome}`;
  body.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  modal.classList.add('show');

  try {
    const { mesas } = await apiCall('GET', `/api/super-admin/restaurants/${restId}/qrcodes`);
    const lista = mesas || [];
    body.innerHTML = !lista.length
      ? '<div class="qr-empty">Nenhuma mesa ativa com QR Code para este restaurante.</div>'
      : `
        <div class="qr-toolbar">
          <div>
            <div class="qr-count">${lista.length} mesa${lista.length === 1 ? '' : 's'} ativa${lista.length === 1 ? '' : 's'}</div>
            <div class="qr-hint">Clique no link para abrir a mesa ou use copiar para enviar ao restaurante.</div>
          </div>
          <button class="btn btn-sm" onclick="copiarTodosQRCodes()">Copiar todos</button>
        </div>
        <div class="qr-grid">
          ${lista.map(m => renderQRCodeCard(m)).join('')}
        </div>`;
  } catch(e) {
    body.innerHTML = `
      <div class="qr-empty">
        Não foi possível carregar os QR Codes. Verifique se o backend do Render está atualizado.
      </div>`;
    showToast('Falha ao carregar QR Codes', 'error');
  }
}

function renderQRCodeCard(mesa) {
  const url = mesa.url_slug || '';
  const token = mesa.public_token || '';
  const numero = mesa.mesa_numero || '—';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=10&data=${encodeURIComponent(url)}`;
  return `
    <div class="qr-card">
      <div class="qr-image-wrap">
        <img class="qr-image" src="${qrUrl}" alt="QR Code da mesa ${escapeHtml(numero)}" loading="lazy">
      </div>
      <div class="qr-card-body">
        <div class="qr-card-top">
          <div>
            <div class="qr-table">Mesa ${escapeHtml(numero)}</div>
            <div class="qr-token">Token ${escapeHtml(token)}</div>
          </div>
          <span class="qr-status">Ativa</span>
        </div>
        <a class="qr-link" href="${escapeAttr(url)}" target="_blank" rel="noopener" title="${escapeAttr(url)}">${escapeHtml(url)}</a>
        <div class="qr-actions">
          <button class="btn btn-sm btn-primary" onclick="copiarTexto('${escapeJs(url)}','Link da mesa ${escapeJs(numero)} copiado')">Copiar link</button>
          <a class="btn btn-sm" href="${escapeAttr(url)}" target="_blank" rel="noopener">Abrir mesa</a>
        </div>
      </div>
    </div>`;
}

function copiarTodosQRCodes() {
  const links = [...document.querySelectorAll('#modal-qrcodes .qr-link')].map(a => a.href).join('\n');
  copiarTexto(links, 'Links das mesas copiados');
}

async function copiarTexto(texto, msg = 'Copiado') {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
    } else {
      const ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    showToast(msg, 'success');
  } catch(e) {
    showToast('Não foi possível copiar automaticamente', 'error');
  }
}

async function abrirDetalhesRestaurante(restId) {
  const modal = document.getElementById('modal-detalhes');
  const body = document.getElementById('detalhes-body');
  document.getElementById('detalhes-title').textContent = 'Carregando...';
  document.getElementById('detalhes-subtitle').textContent = '';
  body.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  modal.classList.add('show');
  try {
    DETALHE_ATUAL = await apiCall('GET', `/api/super-admin/restaurants/${restId}/overview`);
    renderDetalhesRestaurante();
  } catch(e) {
    body.innerHTML = `<div class="qr-empty">Erro ao carregar detalhes: ${escapeHtml(e.message)}</div>`;
  }
}

function renderDetalhesRestaurante() {
  const d = DETALHE_ATUAL;
  const r = d.restaurant;
  const c = d.control || {};
  const f = d.feature_flags || {};
  const u = d.usage || {};
  const planMeta = PLANOS[r.plan] || PLANOS.starter;
  const rolesAtivos = new Set((d.users || [])
    .filter(m => m.is_active !== false && m.usuarios && m.usuarios.ativo !== false)
    .map(m => m.role));
  document.getElementById('detalhes-title').textContent = r.name;
  document.getElementById('detalhes-subtitle').textContent = `/r/${r.slug} • ${planLabel(r.plan)} • ${escapeHtml(r.business_type || c.business_type || c.segment || 'restaurante')} • ${r.is_active ? 'ativo' : 'inativo'}`;
  document.getElementById('detalhes-body').innerHTML = `
    <div class="plan-banner ${r.plan === 'pro' ? 'recommended' : ''}">
      <div>
        <span>${r.plan === 'pro' ? 'Mais indicado' : 'Plano atual'}</span>
        <b>${planLabel(r.plan)}</b>
        <small>${escapeHtml(c.plan_marketing?.headline || planMeta.headline)}</small>
      </div>
      <div class="plan-banner-limits">
        <span>${u.active_users}/${c.limits?.users || '-'} usuários</span>
        <span>${u.tables}/${c.limits?.tables || '-'} mesas</span>
        <span>${u.products}/${c.limits?.products || '-'} produtos</span>
      </div>
    </div>

    <div class="detail-actions">
      ${profileLink('Admin', d.links.admin, rolesAtivos.has('owner') || rolesAtivos.has('manager'))}
      ${profileLink('Caixa', d.links.caixa, rolesAtivos.has('cashier'))}
      ${profileLink('Garçom', d.links.garcom, rolesAtivos.has('waiter'))}
      ${profileLink('Cozinha', d.links.cozinha, rolesAtivos.has('kitchen'))}
      <button class="btn btn-sm" onclick="verQRCodes('${escapeJs(r.id)}','${escapeJs(r.name)}')">QR Codes</button>
      <button class="btn btn-sm btn-primary" onclick="entrarComoDono('${escapeJs(r.id)}')">Entrar como dono</button>
      <button class="btn btn-sm" onclick="exportarRestauranteAtual()">Exportar dados</button>
    </div>

    <div class="detail-stats">
      ${statMini('Pedidos 30d', u.orders_30d)}
      ${statMini('Receita 30d', 'R$ ' + fmtMoney(u.revenue_30d))}
      ${statMini('Usuários', `${u.active_users}/${c.limits?.users || '-'}`)}
      ${statMini('Mesas', `${u.tables}/${c.limits?.tables || '-'}`)}
      ${statMini('Produtos', `${u.products}/${c.limits?.products || '-'}`)}
      ${statMini('Abertos', u.open_orders)}
    </div>

    <div class="detail-grid">
      <div class="detail-panel">
        <div class="detail-panel-title">Plano e operação</div>
        <div class="form-grid">
          ${selectField('ctrl-plan', 'Plano', r.plan, [['starter','Básico'],['pro','Pro - recomendado'],['enterprise','Premium']])}
          ${selectField('ctrl-business-type', 'Tipo de negócio', c.business_type || r.business_type || c.segment || 'restaurante', BUSINESS_TYPE_OPTIONS)}
          ${inputField('ctrl-city', 'Cidade', c.city || '')}
        </div>
        <div class="billing-alert ${escapeAttr(c.billing_status || 'em_dia')}" style="margin-top:12px">
          Financeiro movido para a aba Financeiro. Status atual: ${escapeHtml(c.billing_notice || 'sem alerta')}.
        </div>
      </div>

      <div class="detail-panel">
        <div class="detail-panel-title">Limites e módulos</div>
        <div class="form-grid compact">
          ${inputField('limit-users', 'Usuários', c.limits?.users ?? planMeta.limits.users, 'number')}
          ${inputField('limit-tables', 'Limite de mesas', c.limits?.tables ?? planMeta.limits.tables, 'number')}
          ${inputField('desired-tables', 'Mesas cadastradas', u.tables ?? 0, 'number')}
          ${inputField('limit-products', 'Produtos', c.limits?.products ?? planMeta.limits.products, 'number')}
          ${selectField('ctrl-block', 'Bloqueio', c.block_mode, [['none','Sem bloqueio'],['orders','Bloquear pedidos'],['admin','Bloquear admin'],['users','Bloquear usuários'],['full','Bloqueio total']])}
        </div>
        <div class="muted-line" style="margin-top:8px">Limite define o máximo do plano. Mesas cadastradas cria as mesas reais que aparecem no admin, QR Codes e atendimento.</div>
        ${renderModules(c.modules || planMeta.modules)}
        <div class="module-grid" style="margin-top:12px">
          <label class="module-toggle"><input type="checkbox" id="flag-waiter-delivery" ${f.allow_waiter_delivery ? 'checked' : ''}> <span>Garçom pode marcar pedido como entregue</span></label>
          <label class="module-toggle"><input type="checkbox" id="flag-waiter-payment" ${f.allow_waiter_payment ? 'checked' : ''}> <span>Garçom pode fechar pagamento na mesa</span></label>
        </div>
      </div>

      <div class="detail-panel">
        <div class="detail-panel-title">Saúde do cliente</div>
        <div class="health-list">
          ${(d.health || []).map(h => `
            <div class="health-row">
              <span class="health-dot ${h.status.toLowerCase()}"></span>
              <div><b>${escapeHtml(h.check)}</b><small>${escapeHtml(h.detail)}</small></div>
            </div>`).join('')}
        </div>
      </div>

      <div class="detail-panel">
        <div class="detail-panel-title">Suporte e notas internas</div>
        <div class="form-grid compact">
          ${selectField('support-status', 'Chamado', c.support_status, [['sem_chamado','Sem chamado'],['aberto','Aberto'],['em_andamento','Em andamento'],['liberado_teste','Liberado para teste'],['aguardando_cliente','Aguardando cliente'],['resolvido','Resolvido']])}
          ${selectField('support-priority', 'Prioridade', c.support_priority, [['normal','Normal'],['alta','Alta'],['urgente','Urgente']])}
        </div>
        <label class="form-label">Notas internas</label>
        <textarea class="form-input text-area" id="internal-notes">${escapeHtml(c.internal_notes || '')}</textarea>
        <label class="form-label">Suporte</label>
        <textarea class="form-input text-area" id="support-notes">${escapeHtml(c.support_notes || '')}</textarea>
        <label class="form-label">Aviso para o cliente</label>
        <textarea class="form-input text-area" id="broadcast-message">${escapeHtml(c.broadcast_message || '')}</textarea>
        <div class="support-mini-list">
          ${(d.support_tickets || []).slice(0, 4).map(renderSupportMini).join('') || '<div class="muted-line">Nenhum chamado registrado.</div>'}
        </div>
      </div>
    </div>

    <div class="detail-grid two">
      <div class="detail-panel">
        <div class="detail-panel-title">Usuários</div>
        <div class="mini-table">
          ${(d.users || []).map(m => `<div><span>${escapeHtml(m.usuarios?.nome || 'Sem nome')}</span><small>${escapeHtml(m.role)} • ${escapeHtml(m.usuarios?.login || m.usuarios?.email || '')}</small><button class="btn btn-sm" onclick="redefinirSenhaSuper('${escapeAttr(m.usuarios?.id || '')}')">Senha</button></div>`).join('') || '<div class="muted-line">Nenhum usuário</div>'}
        </div>
      </div>
      <div class="detail-panel">
        <div class="detail-panel-title">Pedidos recentes</div>
        <div class="mini-table">
          ${(d.recent_orders || []).map(p => `<div><span>#${escapeHtml(p.numero)} • ${escapeHtml(p.status)}</span><small>Mesa ${escapeHtml(p.mesas?.numero || '-')} • R$ ${fmtMoney(p.total)} • ${fmtDate(p.created_at)}</small></div>`).join('') || '<div class="muted-line">Nenhum pedido recente</div>'}
        </div>
      </div>
    </div>

    <div class="modal-footer inline-footer">
      <button class="btn" onclick="fecharModal('modal-detalhes')">Fechar</button>
      <button class="btn btn-primary" onclick="salvarControleRestaurante('${r.id}')">Salvar controle</button>
    </div>`;
  document.getElementById('ctrl-plan')?.addEventListener('change', aplicarPlanoControle);
  document.getElementById('ctrl-business-type')?.addEventListener('change', aplicarTipoNegocioControle);
}

function profileLink(label, url, enabled) {
  if (enabled) {
    return `<a class="btn btn-sm" href="${escapeAttr(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
  }
  return `<span class="btn btn-sm btn-disabled" title="Crie um usuário ativo deste perfil para liberar o acesso">${escapeHtml(label)} · sem usuário</span>`;
}

function statMini(label, value) {
  return `<div class="detail-stat"><span>${escapeHtml(label)}</span><b>${escapeHtml(value ?? 0)}</b></div>`;
}

function inputField(id, label, value, type = 'text') {
  return `<div class="form-row"><label class="form-label">${label}</label><input class="form-input" id="${id}" type="${type}" value="${escapeAttr(value)}"></div>`;
}

function selectField(id, label, value, options) {
  return `<div class="form-row"><label class="form-label">${label}</label><select class="form-input" id="${id}">
    ${options.map(([v, t]) => `<option value="${v}" ${String(value) === v ? 'selected' : ''}>${t}</option>`).join('')}
  </select></div>`;
}

function moduleToggle(id, label, checked) {
  return `<label class="module-toggle"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''}> ${label}</label>`;
}

function renderModules(modules) {
  const keys = [
    'mesas', 'comandas', 'qr_code', 'garcom', 'cozinha', 'caixa', 'estoque', 'ficha_tecnica',
    'delivery', 'encomendas', 'venda_peso', 'codigo_barras', 'pizza_meio_a_meio', 'pizza_bordas',
    'pizza_tamanhos', 'producao_padaria', 'lotes_validade', 'balcao_rapido', 'fiscal', 'relatorios_avancados',
    'financeiro', 'relatorios', 'custom_branding', 'cupons', 'backups', 'advanced_reports', 'priority_support',
    'api_integrations', 'ifood', 'whatsapp', 'multiunit'
  ];
  return `<div class="module-grid">
    ${keys.map(key => {
      const future = FUTURE_MODULES.has(key) || !IMPLEMENTED_MODULES.has(key);
      const checkedValue = !future && modules?.[key] === true;
      return `<label class="module-toggle ${future ? 'future' : ''}">
        <input type="checkbox" id="mod-${key}" ${checkedValue ? 'checked' : ''} ${future ? 'disabled' : ''}>
        <span>${escapeHtml(MODULE_LABELS[key] || key)}</span>
        <small>${future ? 'Em implantação' : 'Funcional'}</small>
      </label>`;
    }).join('')}
  </div>`;
}

async function salvarControleRestaurante(restId) {
  const payload = {
    plan: val('ctrl-plan'),
    business_type: val('ctrl-business-type'),
    segment: val('ctrl-business-type'),
    city: val('ctrl-city'),
    block_mode: val('ctrl-block'),
    support_status: val('support-status'),
    support_priority: val('support-priority'),
    internal_notes: val('internal-notes'),
    support_notes: val('support-notes'),
    broadcast_message: val('broadcast-message'),
    limits: {
      users: Number(val('limit-users') || 0),
      tables: Number(val('limit-tables') || 0),
      products: Number(val('limit-products') || 0),
    },
    desired_tables: Number(val('desired-tables') || 0),
    modules: {
      mesas: checked('mod-mesas'),
      comandas: checked('mod-comandas'),
      qr_code: checked('mod-qr_code'),
      garcom: checked('mod-garcom'),
      cozinha: checked('mod-cozinha'),
      caixa: checked('mod-caixa'),
      estoque: checked('mod-estoque'),
      ficha_tecnica: checked('mod-ficha_tecnica'),
      delivery: checked('mod-delivery'),
      encomendas: checked('mod-encomendas'),
      venda_peso: checked('mod-venda_peso'),
      codigo_barras: checked('mod-codigo_barras'),
      pizza_meio_a_meio: checked('mod-pizza_meio_a_meio'),
      pizza_bordas: checked('mod-pizza_bordas'),
      pizza_tamanhos: checked('mod-pizza_tamanhos'),
      producao_padaria: checked('mod-producao_padaria'),
      lotes_validade: checked('mod-lotes_validade'),
      balcao_rapido: checked('mod-balcao_rapido'),
      fiscal: checked('mod-fiscal'),
      relatorios_avancados: checked('mod-relatorios_avancados'),
      financeiro: checked('mod-financeiro'),
      cupons: false,
      relatorios: checked('mod-relatorios'),
      custom_branding: false,
      backups: checked('mod-backups'),
      advanced_reports: checked('mod-advanced_reports'),
      priority_support: checked('mod-priority_support'),
      api_integrations: false,
      ifood: false,
      whatsapp: false,
      multiunit: false,
    },
    feature_flags: {
      allow_waiter_delivery: checked('flag-waiter-delivery'),
      allow_waiter_payment: checked('flag-waiter-payment'),
    },
  };
  try {
    await apiCall('PATCH', `/api/super-admin/restaurants/${restId}/control`, payload);
    showToast('Controle atualizado', 'success');
    await abrirDetalhesRestaurante(restId);
    carregarRestaurantes();
  } catch(e) {
    showToast(e.message, 'error');
  }
}

async function redefinirSenhaSuper(usuarioId) {
  if (!usuarioId) return;
  const senha = await appPrompt('Nova senha para este usuário.', '', { title: 'Redefinir senha', type: 'password', confirmText: 'Atualizar senha' });
  if (senha === null) return;
  if (senha.length < 6) return showToast('Senha precisa ter no mínimo 6 caracteres', 'error');
  try {
    await apiCall('PATCH', `/api/super-admin/users/${usuarioId}/password`, { senha });
    showToast('Senha atualizada', 'success');
  } catch(e) {
    showToast(e.message, 'error');
  }
}

async function entrarComoDono(restId) {
  if (!await appConfirm('Entrar no painel deste cliente como suporte? A ação será registrada em auditoria.', { title: 'Entrar como suporte', confirmText: 'Entrar' })) return;
  try {
    const data = await apiCall('POST', `/api/super-admin/restaurants/${restId}/impersonate`);
    const tokenAtual = localStorage.getItem('saas_token');
    const usuarioAtual = localStorage.getItem('saas_user');
    localStorage.setItem('saas_token', data.token);
    localStorage.setItem('saas_user', JSON.stringify(data.usuario));
    window.open(data.redirect_url, '_blank', 'noopener');
    setTimeout(() => {
      if (tokenAtual) localStorage.setItem('saas_token', tokenAtual);
      if (usuarioAtual) localStorage.setItem('saas_user', usuarioAtual);
    }, 1200);
  } catch(e) {
    showToast(e.message, 'error');
  }
}

async function exportarRestauranteAtual() {
  if (!DETALHE_ATUAL) return;
  try {
    const exportData = await apiCall('GET', `/api/super-admin/restaurants/${DETALHE_ATUAL.restaurant.id}/export`);
    baixarJson(exportData, `${String(DETALHE_ATUAL.restaurant.slug || 'restaurante').replace(/[^a-z0-9-]/gi, '-')}-export-${new Date().toISOString().slice(0,10)}.json`);
    showToast('Exportação gerada', 'success');
  } catch(e) {
    showToast(e.message, 'error');
  }
}

function abrirModalNovoRest() {
  ['r-nome','r-slug','r-email','r-owner-nome','r-owner-email','r-owner-senha'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('r-business-type').value = 'restaurante';
  document.getElementById('r-mesas').value = 10;
  document.getElementById('r-plano').value = 'starter';
  aplicarTipoNegocioRestaurante();
  document.getElementById('modal-rest').classList.add('show');
}

function aplicarTipoNegocioRestaurante() {
  const businessType = document.getElementById('r-business-type').value;
  const presets = {
    restaurante: { mesas: 10, plano: 'starter', cor: '#ff4d1c' },
    padaria: { mesas: 6, plano: 'starter', cor: '#c0843d' },
    pizzaria: { mesas: 12, plano: 'pro', cor: '#d92d20' },
    bar: { mesas: 16, plano: 'pro', cor: '#22c55e' },
    hamburgueria: { mesas: 8, plano: 'pro', cor: '#f59e0b' },
    delivery_only: { mesas: 0, plano: 'starter', cor: '#7c3aed' },
  };
  const p = presets[businessType] || presets.restaurante;
  document.getElementById('r-mesas').value = p.mesas;
  document.getElementById('r-plano').value = p.plano;
  document.getElementById('r-cor').value = p.cor;
  aplicarPlanoComercial();
}

function aplicarTemplateRestaurante() {
  aplicarTipoNegocioRestaurante();
}

function aplicarPlanoComercial() {
  const plano = document.getElementById('r-plano')?.value || 'starter';
  const meta = PLANOS[plano] || PLANOS.starter;
  const hint = document.getElementById('r-plano-hint');
  const mesas = document.getElementById('r-mesas');
  if (hint) {
    const limite = meta.limits.tables >= 9999 ? 'mesas sob contrato' : `até ${meta.limits.tables} mesas`;
    hint.textContent = `${meta.headline} ${limite}, ${meta.limits.users >= 9999 ? 'usuários sob contrato' : `até ${meta.limits.users} usuários`}.`;
  }
  if (mesas && Number(mesas.value || 0) > meta.limits.tables && meta.limits.tables < 9999) {
    mesas.value = meta.limits.tables;
  }
}

function aplicarPlanoControle() {
  const plano = document.getElementById('ctrl-plan')?.value || 'starter';
  const meta = PLANOS[plano] || PLANOS.starter;
  const limits = meta.limits || {};
  const modules = meta.modules || {};
  const setValue = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  };
  setValue('limit-users', limits.users);
  setValue('limit-tables', limits.tables);
  setValue('limit-products', limits.products);
  Object.keys(MODULE_LABELS).forEach(key => {
    const el = document.getElementById('mod-' + key);
    if (el && IMPLEMENTED_MODULES.has(key) && !FUTURE_MODULES.has(key)) el.checked = modules[key] === true;
  });
  aplicarTipoNegocioControle();
}

function aplicarTipoNegocioControle() {
  const businessType = document.getElementById('ctrl-business-type')?.value || 'restaurante';
  const preset = BUSINESS_TYPE_PRESETS[businessType] || BUSINESS_TYPE_PRESETS.restaurante;
  Object.keys(MODULE_LABELS).forEach(key => {
    const el = document.getElementById('mod-' + key);
    if (el && key in preset && IMPLEMENTED_MODULES.has(key) && !FUTURE_MODULES.has(key)) {
      el.checked = preset[key] === true;
    }
  });
}

function gerarSlug() {
  const nome = document.getElementById('r-nome').value;
  const slug = nome.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-');
  document.getElementById('r-slug').value = slug;
}

document.getElementById('r-nome')?.addEventListener('input', gerarSlug);

async function criarRestaurante() {
  const nome  = document.getElementById('r-nome').value.trim();
  const slug  = document.getElementById('r-slug').value.trim();
  const email = document.getElementById('r-email').value.trim() || null;
  const businessType = document.getElementById('r-business-type').value;
  const plano = document.getElementById('r-plano').value;
  const cor   = document.getElementById('r-cor').value;
  const mesas = Number(document.getElementById('r-mesas').value || 0);
  const ownerNome  = document.getElementById('r-owner-nome').value.trim() || null;
  const ownerEmail = document.getElementById('r-owner-email').value.trim() || null;
  const ownerSenha = document.getElementById('r-owner-senha').value || null;

  if (!nome || !slug) return showToast('Nome e slug obrigatórios', 'error');
  if (!slug.match(/^[a-z0-9-]+$/)) return showToast('Slug só pode ter letras minúsculas, números e hífens', 'error');
  if (mesas < 0 || mesas > 100) return showToast('Mesas iniciais precisa ficar entre 0 e 100', 'error');

  try {
    const payload = {
      name: nome,
      slug,
      email,
      plan: plano,
      business_type: businessType,
      template: businessType,
      primary_color: cor,
      initial_table_count: mesas,
      create_default_categories: false,
      create_sample_products: false,
    };
    const { restaurant } = await apiCall('POST', '/api/super-admin/restaurants', payload);

    // Criar owner via super-admin endpoint se fornecido
    if (ownerEmail && ownerSenha) {
      await apiCall('POST', `/api/super-admin/restaurants/${restaurant.id}/users`, {
        nome: ownerNome || ownerEmail,
        email: ownerEmail,
        senha: ownerSenha,
        role: 'owner',
      });
    }

    showToast(`Restaurante "${nome}" criado. Acesse /r/${slug}/admin`, 'success');
    fecharModal('modal-rest');
    carregarRestaurantes();
  } catch(e) {
    showToast(e.message, 'error');
  }
}

/* ── USUÁRIOS ───────────────────────────────────────── */
async function carregarUsuarios() {
  document.getElementById('usuarios-tbody').innerHTML = '<tr><td colspan="5" class="tabela-empty">Carregando...</td></tr>';
  try {
    const { memberships } = await apiCall('GET', '/api/super-admin/users');
    const rows = (memberships || []).filter(m =>
      m.usuarios &&
      m.restaurants &&
      m.is_active !== false &&
      (mostrarInativos || m.restaurants.is_active !== false)
    );
    document.getElementById('usuarios-tbody').innerHTML = !rows.length
      ? '<tr><td colspan="5" class="tabela-empty">Nenhum usuário</td></tr>'
      : rows.map(m => `<tr>
          <td>${escapeHtml(m.usuarios?.nome || '—')}</td>
          <td class="mono" style="font-size:12px">${escapeHtml(m.usuarios?.login || m.usuarios?.email || '—')}</td>
          <td style="font-size:12px;color:var(--muted)">${escapeHtml(m.restaurants?.name || '—')}</td>
          <td><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:3px;background:rgba(124,58,237,.1);color:var(--primary)">${escapeHtml(m.role)}</span></td>
          <td><span style="font-size:10px;color:${m.is_active?'var(--green)':'var(--red)'}">${m.is_active?'✓ Ativo':'✗ Inativo'}</span></td>
        </tr>`).join('');
  } catch(e) {
    document.getElementById('usuarios-tbody').innerHTML = `
      <tr><td colspan="5" class="tabela-empty">
        Este backend ainda não expõe a listagem de usuários. Os usuários criados são salvos, mas esta aba depende do redeploy do Render.
      </td></tr>`;
  }
}

function abrirModalNovoUsuario() {
  document.getElementById('modal-usuario').classList.add('show');
}

async function criarUsuario() {
  const restId = document.getElementById('u-restaurant').value;
  const nome   = document.getElementById('u-nome').value.trim();
  const email  = document.getElementById('u-email').value.trim();
  const senha  = document.getElementById('u-senha').value;
  const role   = document.getElementById('u-role').value;
  if (!nome || !email || !senha) return showToast('Preencha todos os campos', 'error');
  if (senha.length < 6) return showToast('Senha precisa ter no mínimo 6 caracteres', 'error');
  try {
    await apiCall('POST', `/api/super-admin/restaurants/${restId}/users`, { nome, username: email, email, senha, role });
    showToast('Usuário criado com sucesso', 'success');
    fecharModal('modal-usuario');
    carregarUsuarios();
  } catch(e) { showToast(e.message, 'error'); }
}

/* ── FINANCEIRO ─────────────────────────────────────── */
async function carregarFinanceiroPlataforma() {
  const el = document.getElementById('financeiro-content');
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await apiCall('GET', '/api/super-admin/finance');
    FINANCEIRO_ITEMS = data.items || [];
    renderFinanceiroPlataforma(data.summary || {});
  } catch(e) {
    try {
      const data = await carregarFinanceiroCompat();
      FINANCEIRO_ITEMS = data.items || [];
      renderFinanceiroPlataforma(data.summary || {}, true);
    } catch(fallbackError) {
      el.innerHTML = `<div class="tabela-empty">Erro ao carregar financeiro: ${escapeHtml(fallbackError.message || e.message)}</div>`;
    }
  }
}

function renderFinanceiroPlataforma(summary = {}, compat = false) {
  const el = document.getElementById('financeiro-content');
  prepararCodigosFinanceiros();
  el.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Mensalidade ativa</div><div class="stat-val green">R$ ${fmtMoney(summary.total_monthly)}</div></div>
      <div class="stat-card"><div class="stat-label">Em atraso</div><div class="stat-val amber">R$ ${fmtMoney(summary.overdue_amount)}</div></div>
      <div class="stat-card"><div class="stat-label">Clientes ativos</div><div class="stat-val">${escapeHtml(summary.active_clients ?? 0)}</div></div>
      <div class="stat-card"><div class="stat-label">Atrasados</div><div class="stat-val amber">${escapeHtml(summary.overdue_clients ?? 0)}</div></div>
    </div>
      <div class="finance-pricing-strip">
        ${renderPlanoPrecoCard('starter')}
        ${renderPlanoPrecoCard('pro')}
        ${renderPlanoPrecoCard('enterprise', true)}
      </div>
      <div class="finance-workspace">
      ${renderRegistroPagamento()}
      ${renderFinanceiroTabela()}
    </div>`;
  preencherFinanceiroDatalist();
}

function renderPlanoPrecoCard(plan, premium = false) {
  const p = PLANOS[plan] || PLANOS.starter;
  const limits = p.limits || {};
  return `
    <div class="finance-plan-card ${premium ? 'premium' : ''}">
      <div class="finance-plan-top">
        <span>${escapeHtml(p.label)}</span>
        <b>R$ ${fmtMoney(p.basePrice)}/mês${premium ? ' base' : ''}</b>
      </div>
      <small>${escapeHtml(p.headline)}</small>
      <div class="finance-plan-limits">
        <span>${limits.tables >= 9999 ? 'mesas altas' : `${limits.tables} mesas`}</span>
        <span>${limits.users >= 9999 ? 'usuários altos' : `${limits.users} usuários`}</span>
        <span>${limits.products >= 9999 ? 'produtos altos' : `${limits.products} produtos`}</span>
        <span>${limits.registers || '-'} caixas</span>
      </div>
      ${premium ? '<div class="finance-plan-note">Premium cresce com filiais, integrações, suporte prioritário e necessidades especiais.</div>' : ''}
    </div>`;
}

async function carregarFinanceiroCompat() {
  let restaurants = RESTAURANTES;
  if (!restaurants.length) {
    const resp = await apiCall('GET', '/api/super-admin/restaurants');
    restaurants = resp.restaurants || [];
    RESTAURANTES = restaurants;
  }

  const overviews = await Promise.all(restaurants.map(async r => {
    try {
      return await apiCall('GET', `/api/super-admin/restaurants/${r.id}/overview`);
    } catch(e) {
      return { restaurant: r, control: {}, overview_error: e.message };
    }
  }));

  const items = overviews.map(o => {
    const r = o.restaurant || {};
    const c = o.control || {};
    const status = c.billing_status || c.billing_computed_status || 'em_dia';
    return {
      restaurant: r,
      customer_code: c.customer_code || '',
      branch_code: c.branch_code || c.customer_code || '',
      branch_label: c.branch_label || 'Matriz',
      billing_status: status,
      billing_notice: c.billing_notice || (o.overview_error ? `Não foi possível ler detalhes: ${o.overview_error}` : 'Sem alerta financeiro'),
      billing_days_overdue: Number(c.billing_days_overdue || 0),
      trial_until: c.trial_until || null,
      due_date: c.due_date || null,
      monthly_amount: Number(c.monthly_amount || 0),
      last_payment_date: c.last_payment_date || null,
      last_payment_amount: Number(c.last_payment_amount || 0),
      last_payment_reference: c.last_payment_reference || '',
      payment_notes: c.payment_notes || '',
      grace_alert_days: c.grace_alert_days ?? 15,
      grace_block_days: c.grace_block_days ?? 30,
      block_mode: c.block_mode || 'none',
    };
  });

  return {
    items,
    summary: {
      total_monthly: items.filter(i => (i.restaurant || {}).is_active !== false).reduce((acc, i) => acc + Number(i.monthly_amount || 0), 0),
      overdue_amount: items.filter(i => ['vencido', 'bloqueado'].includes(i.billing_status)).reduce((acc, i) => acc + Number(i.monthly_amount || 0), 0),
      active_clients: items.filter(i => (i.restaurant || {}).is_active !== false).length,
      overdue_clients: items.filter(i => ['vencido', 'bloqueado'].includes(i.billing_status)).length,
      trial_clients: items.filter(i => i.billing_status === 'teste_gratis').length,
    },
  };
}

function renderFinanceiroItem(item) {
  const r = item.restaurant || {};
  const status = item.billing_status || 'em_dia';
  return `
    <div class="finance-card ${escapeAttr(status)}">
      <div class="finance-main">
        <div>
          <div class="finance-title">${escapeHtml(r.name || '-')}</div>
          <div class="finance-sub">/${escapeHtml(r.slug || '-')} · ${escapeHtml(planLabel(r.plan))}</div>
        </div>
        <span class="finance-status ${escapeAttr(status)}">${escapeHtml(statusFinanceiroLabel(status))}</span>
      </div>
      <div class="finance-grid-row">
        ${financeMetric('Mensalidade', 'R$ ' + fmtMoney(item.monthly_amount))}
        ${financeMetric('Vencimento', item.due_date ? fmtDateShort(item.due_date) : 'Sem data')}
        ${financeMetric('Último pagamento', item.last_payment_date ? `${fmtDateShort(item.last_payment_date)} · R$ ${fmtMoney(item.last_payment_amount)}` : 'Sem registro')}
        ${financeMetric('Atraso', item.billing_days_overdue ? `${item.billing_days_overdue} dia(s)` : 'Em dia')}
      </div>
      <div class="billing-alert ${escapeAttr(status)}">${escapeHtml(item.billing_notice || 'Sem alerta financeiro')}</div>
      <div class="finance-edit">
        <div class="form-grid compact">
          ${selectField(`fin-status-${r.id}`, 'Status', status, [['em_dia','Em dia'],['teste_gratis','Teste grátis'],['vencido','Vencido'],['bloqueado','Bloqueado']])}
          ${inputField(`fin-monthly-${r.id}`, 'Mensalidade (R$)', item.monthly_amount || '', 'number')}
          ${inputField(`fin-due-${r.id}`, 'Vencimento', item.due_date || '', 'date')}
          ${inputField(`fin-trial-${r.id}`, 'Teste até', item.trial_until || '', 'date')}
          ${inputField(`fin-alert-${r.id}`, 'Aviso após dias', item.grace_alert_days ?? 15, 'number')}
          ${inputField(`fin-block-days-${r.id}`, 'Bloqueio após dias', item.grace_block_days ?? 30, 'number')}
          ${selectField(`fin-block-${r.id}`, 'Bloqueio', item.block_mode || 'none', [['none','Sem bloqueio'],['orders','Bloquear pedidos'],['admin','Bloquear admin'],['users','Bloquear usuários'],['full','Bloqueio total']])}
        </div>
        <div class="payment-register">
          <label class="module-toggle"><input type="checkbox" id="fin-register-${escapeAttr(r.id)}"> Registrar mensalidade paga agora</label>
          <div class="form-grid compact">
            ${inputField(`fin-pay-amount-${r.id}`, 'Valor pago', item.monthly_amount || '', 'number')}
            ${inputField(`fin-pay-date-${r.id}`, 'Data pagamento', new Date().toISOString().slice(0,10), 'date')}
            ${inputField(`fin-next-due-${r.id}`, 'Próximo vencimento', item.due_date || '', 'date')}
            ${inputField(`fin-pay-ref-${r.id}`, 'Referência', item.last_payment_reference || '')}
          </div>
          <label class="form-label">Notas financeiras</label>
          <textarea class="form-input text-area" id="fin-notes-${escapeAttr(r.id)}">${escapeHtml(item.payment_notes || '')}</textarea>
        </div>
        <div class="finance-actions">
          <button class="btn btn-sm" onclick="abrirDetalhesRestaurante('${escapeAttr(r.id)}')">Ver detalhes</button>
          <button class="btn btn-sm btn-primary" onclick="salvarFinanceiroRestaurante('${escapeAttr(r.id)}', this)">Salvar financeiro</button>
        </div>
      </div>
    </div>`;
}

function renderRegistroPagamento() {
  return `
    <div class="finance-register-panel">
      <div class="finance-register-head">
        <div>
          <div class="detail-panel-title">Recebimento de mensalidade</div>
          <div class="finance-sub">Informe o código do cliente, slug ou nome. Ex: CLI-001.</div>
        </div>
        <button class="btn btn-sm" onclick="limparRegistroFinanceiro()">Limpar</button>
      </div>
      <div class="finance-id-row">
        <div class="form-row">
          <label class="form-label">Código do cliente / slug / nome</label>
          <input class="form-input mono" id="pay-rest-query" list="finance-restaurants-list" placeholder="CLI-001" oninput="selecionarFinanceiroPorEntrada()">
          <datalist id="finance-restaurants-list"></datalist>
        </div>
        <button class="btn btn-primary" onclick="selecionarFinanceiroPorEntrada()">Buscar</button>
      </div>
      <div class="form-row finance-unit-row" id="pay-unit-row" style="display:none">
        <label class="form-label">Unidade / filial</label>
        <select class="form-input" id="pay-unit-select" onchange="carregarRestauranteNoPagamento(this.value)"></select>
      </div>
      <div id="pay-selected" class="finance-selected empty">
        Nenhum restaurante selecionado.
      </div>
      <div class="form-grid compact">
        ${inputField('pay-amount', 'Valor pago', '', 'number')}
        ${inputField('pay-date', 'Data pagamento', new Date().toISOString().slice(0,10), 'date')}
        ${inputField('pay-next-due', 'Próximo vencimento', '', 'date')}
        ${inputField('pay-ref', 'Referência', '')}
      </div>
      <div class="finance-quick-actions">
        <button class="btn btn-sm" onclick="usarMensalidadeSelecionada()">Usar mensalidade</button>
        <button class="btn btn-sm" onclick="calcularProximoVencimentoSelecionado(1)">+ 1 mês</button>
        <button class="btn btn-sm" onclick="calcularProximoVencimentoSelecionado(3)">+ 3 meses</button>
        <button class="btn btn-sm" onclick="marcarSelecionadoEmDia()">Marcar em dia sem pagamento</button>
      </div>
      <label class="form-label">Notas financeiras</label>
      <textarea class="form-input text-area" id="pay-notes" placeholder="Ex: Pix recebido, comprovante enviado, observação interna"></textarea>
      <div class="finance-actions">
        <button class="btn btn-primary" id="pay-save-btn" onclick="registrarPagamentoFinanceiro(this)" disabled>Registrar pagamento</button>
      </div>
    </div>`;
}

function renderFinanceiroTabela() {
  const cards = FINANCEIRO_ITEMS
    .slice()
    .sort((a, b) => String(a.restaurant?.name || '').localeCompare(String(b.restaurant?.name || '')))
    .map(item => renderFinanceiroAccordion(item))
    .join('');
  return `
    <div class="finance-table-panel">
      <div class="finance-register-head">
        <div>
          <div class="detail-panel-title">Planos, mensalidades e vencimentos</div>
          <div class="finance-sub">Clique em um restaurante para expandir cobranças, bloqueios e pagamento.</div>
        </div>
      </div>
      <div class="finance-accordion-list">${cards || '<div class="tabela-empty">Nenhum restaurante</div>'}</div>
    </div>`;
}

function renderFinanceiroAccordion(item) {
  const r = item.restaurant || {};
  const status = item.billing_status || 'em_dia';
  const code = codigoClienteFinanceiro(item);
  const plan = r.plan || 'starter';
  const planMeta = PLANOS[plan] || PLANOS.starter;
  return `
    <details class="finance-accordion ${escapeAttr(status)}">
      <summary>
        <div class="finance-accordion-main">
          <b>${escapeHtml(r.name || '-')}</b>
          <span>/${escapeHtml(r.slug || '-')} · ${escapeHtml(code)} · ${escapeHtml(planLabel(plan))}</span>
        </div>
        <div class="finance-accordion-metrics">
          <span>R$ ${fmtMoney(item.monthly_amount || planMeta.basePrice)}</span>
          <span>${item.due_date ? fmtDateShort(item.due_date) : 'Sem vencimento'}</span>
          <span class="finance-status ${escapeAttr(status)}">${escapeHtml(statusFinanceiroLabel(status))}</span>
        </div>
      </summary>
      <div class="finance-accordion-body">
        <div class="billing-alert ${escapeAttr(status)}">${escapeHtml(item.billing_notice || 'Sem alerta financeiro')}</div>
        <div class="finance-box-grid">
          <section class="finance-box">
            <div class="finance-box-title">Plano e valor</div>
            <div class="form-grid compact">
              ${selectField(`fin-plan-${r.id}`, 'Plano', plan, [['starter','Básico - R$ 79'],['pro','Pro - R$ 149'],['enterprise','Premium - R$ 249 base']])}
              ${inputField(`fin-monthly-${r.id}`, 'Mensalidade cobrada (R$)', item.monthly_amount || planMeta.basePrice || '', 'number')}
              ${inputField(`fin-due-${r.id}`, 'Data de vencimento', item.due_date || '', 'date')}
              ${inputField(`fin-trial-${r.id}`, 'Teste grátis até', item.trial_until || '', 'date')}
            </div>
            <div class="finance-help-text">No Premium, use R$ 249 como base e aumente conforme filiais, integrações, suporte ou escopo especial.</div>
          </section>
          <section class="finance-box">
            <div class="finance-box-title">Status e bloqueio</div>
            <div class="form-grid compact">
              ${selectField(`fin-status-${r.id}`, 'Status', status, [['em_dia','Em dia'],['teste_gratis','Teste grátis'],['vencido','Vencido'],['bloqueado','Bloqueado']])}
              ${inputField(`fin-alert-${r.id}`, 'Avisar após dias', item.grace_alert_days ?? 15, 'number')}
              ${inputField(`fin-block-days-${r.id}`, 'Bloquear após dias', item.grace_block_days ?? 30, 'number')}
              ${selectField(`fin-block-${r.id}`, 'Bloqueio aplicado', item.block_mode || 'none', [['none','Sem bloqueio'],['orders','Bloquear pedidos'],['admin','Bloquear admin'],['users','Bloquear usuários'],['full','Bloqueio total']])}
            </div>
          </section>
          <section class="finance-box">
            <div class="finance-box-title">Recebimento</div>
            <label class="module-toggle"><input type="checkbox" id="fin-register-${escapeAttr(r.id)}"> Registrar pagamento agora</label>
            <div class="form-grid compact">
              ${inputField(`fin-pay-amount-${r.id}`, 'Valor pago', item.monthly_amount || planMeta.basePrice || '', 'number')}
              ${inputField(`fin-pay-date-${r.id}`, 'Data pagamento', new Date().toISOString().slice(0,10), 'date')}
              ${inputField(`fin-next-due-${r.id}`, 'Próximo vencimento', item.due_date || '', 'date')}
              ${inputField(`fin-pay-ref-${r.id}`, 'Referência', item.last_payment_reference || '')}
            </div>
            ${renderHistoricoPagamentosResumo(item.recent_payments || [])}
          </section>
          <section class="finance-box">
            <div class="finance-box-title">Observações</div>
            <label class="form-label">Notas financeiras</label>
            <textarea class="form-input text-area" id="fin-notes-${escapeAttr(r.id)}">${escapeHtml(item.payment_notes || '')}</textarea>
            <div class="finance-row-actions">
              <button class="btn btn-sm" onclick="copiarTexto('${escapeJs(code)}','Código copiado')">Copiar código</button>
              <button class="btn btn-sm" onclick="carregarRestauranteNoPagamento('${escapeAttr(r.id)}')">Usar no recebimento</button>
              <button class="btn btn-sm" onclick="abrirDetalhesRestaurante('${escapeAttr(r.id)}')">Ver detalhes</button>
              <button class="btn btn-sm btn-primary" onclick="salvarFinanceiroRestaurante('${escapeAttr(r.id)}', this)">Salvar financeiro</button>
            </div>
          </section>
        </div>
      </div>
    </details>`;
}

function renderFinanceiroRow(item) {
  const r = item.restaurant || {};
  const status = item.billing_status || 'em_dia';
  const code = codigoClienteFinanceiro(item);
  return `<tr>
    <td>
      <b>${escapeHtml(r.name || '-')}</b>
      <div class="rest-slug">/${escapeHtml(r.slug || '-')} · ${escapeHtml(planLabel(r.plan))}${item.branch_label ? ' · ' + escapeHtml(item.branch_label) : ''}</div>
    </td>
    <td class="mono finance-id-cell" title="${escapeAttr(r.id || '')}"><b>${escapeHtml(code)}</b><small>${escapeHtml(shortId(r.id))}</small></td>
    <td><span class="finance-status ${escapeAttr(status)}">${escapeHtml(statusFinanceiroLabel(status))}</span></td>
    <td>R$ ${fmtMoney(item.monthly_amount)}</td>
    <td>${item.due_date ? fmtDateShort(item.due_date) : 'Sem data'}</td>
    <td>${item.last_payment_date ? `${fmtDateShort(item.last_payment_date)} · R$ ${fmtMoney(item.last_payment_amount)}` : 'Sem registro'}</td>
    <td>
      <div class="finance-row-actions">
        <button class="btn btn-sm" onclick="copiarTexto('${escapeJs(code)}','Código copiado')">Copiar código</button>
        <button class="btn btn-sm btn-primary" onclick="carregarRestauranteNoPagamento('${escapeAttr(r.id)}')">Usar</button>
      </div>
    </td>
  </tr>`;
}

function preencherFinanceiroDatalist() {
  const list = document.getElementById('finance-restaurants-list');
  if (!list) return;
  list.innerHTML = FINANCEIRO_ITEMS.map(item => {
    const r = item.restaurant || {};
    const code = codigoClienteFinanceiro(item);
    return `
      <option value="${escapeAttr(code)}">${escapeHtml(r.name || '')} /${escapeHtml(r.slug || '')}</option>
      <option value="${escapeAttr(r.slug || '')}">${escapeHtml(r.name || '')}</option>
      <option value="${escapeAttr(r.name || '')}">${escapeHtml(code)}</option>`;
  }).join('');
}

function selecionarFinanceiroPorEntrada() {
  const query = val('pay-rest-query');
  const item = encontrarFinanceiroItem(query);
  renderPagamentoSelecionado(item);
}

function carregarRestauranteNoPagamento(restId) {
  const input = document.getElementById('pay-rest-query');
  const item = encontrarFinanceiroItem(restId);
  if (input) input.value = codigoClienteFinanceiro(item);
  renderPagamentoSelecionado(item);
  document.getElementById('pay-rest-query')?.focus();
}

function encontrarFinanceiroItem(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return null;
  return FINANCEIRO_ITEMS.find(item => {
    const r = item.restaurant || {};
    return String(codigoClienteFinanceiro(item) || '').toLowerCase() === q
      || String(r.id || '').toLowerCase() === q
      || String(r.slug || '').toLowerCase() === q
      || String(r.name || '').toLowerCase() === q;
  }) || FINANCEIRO_ITEMS.find(item => {
    const r = item.restaurant || {};
    return String(codigoClienteFinanceiro(item) || '').toLowerCase().includes(q)
      || String(r.id || '').toLowerCase().includes(q)
      || String(r.slug || '').toLowerCase().includes(q)
      || String(r.name || '').toLowerCase().includes(q);
  }) || null;
}

function renderPagamentoSelecionado(item) {
  const box = document.getElementById('pay-selected');
  const btn = document.getElementById('pay-save-btn');
  if (!box || !btn) return;
  if (!item) {
    box.className = 'finance-selected empty';
    box.innerHTML = 'Nenhum restaurante selecionado.';
    btn.disabled = true;
    renderSelectUnidadesFinanceiro(null);
    return;
  }
  const r = item.restaurant || {};
  renderSelectUnidadesFinanceiro(item);
  box.className = `finance-selected ${escapeAttr(item.billing_status || 'em_dia')}`;
  box.innerHTML = `
    <div>
      <b>${escapeHtml(r.name || '-')}</b>
      <span>${escapeHtml(codigoClienteFinanceiro(item))} · /${escapeHtml(r.slug || '-')} · interno ${escapeHtml(shortId(r.id))}</span>
    </div>
    <div class="finance-selected-meta">
      <span>${escapeHtml(statusFinanceiroLabel(item.billing_status))}</span>
      <span>Mensalidade R$ ${fmtMoney(item.monthly_amount)}</span>
      <span>Vence ${item.due_date ? fmtDateShort(item.due_date) : 'sem data'}</span>
    </div>
    ${renderHistoricoPagamentosResumo(item.recent_payments || [])}`;
  btn.disabled = false;
  usarMensalidadeSelecionada(false);
  calcularProximoVencimentoSelecionado(1, false);
  if (!val('pay-notes')) document.getElementById('pay-notes').value = item.payment_notes || '';
}

function itemFinanceiroSelecionado() {
  return encontrarFinanceiroItem(val('pay-rest-query'));
}

function renderHistoricoPagamentosResumo(payments) {
  if (!payments.length) return '';
  return `<div class="finance-payment-history">
    <b>Últimos recebimentos</b>
    ${payments.slice(0, 3).map(p => `<span>${fmtDateShort(p.paid_at)} · R$ ${fmtMoney(p.amount)}${p.reference ? ' · ' + escapeHtml(p.reference) : ''}</span>`).join('')}
  </div>`;
}

function usarMensalidadeSelecionada(show = true) {
  const item = itemFinanceiroSelecionado();
  if (!item) return show ? showToast('Selecione um restaurante primeiro', 'error') : null;
  document.getElementById('pay-amount').value = Number(item.monthly_amount || item.last_payment_amount || 0);
}

function calcularProximoVencimentoSelecionado(months = 1, show = true) {
  const item = itemFinanceiroSelecionado();
  if (!item) return show ? showToast('Selecione um restaurante primeiro', 'error') : null;
  const base = item.due_date || val('pay-date') || new Date().toISOString().slice(0, 10);
  document.getElementById('pay-next-due').value = addMonthsDate(base, months);
}

async function marcarSelecionadoEmDia() {
  const item = itemFinanceiroSelecionado();
  if (!item) return showToast('Selecione um restaurante primeiro', 'error');
  const r = item.restaurant || {};
  try {
    await apiCall('PATCH', `/api/super-admin/restaurants/${r.id}/control`, {
      billing_status: 'em_dia',
      monthly_amount: Number(item.monthly_amount || 0),
      due_date: item.due_date || null,
      trial_until: item.trial_until || null,
      grace_alert_days: Number(item.grace_alert_days || 15),
      grace_block_days: Number(item.grace_block_days || 30),
      block_mode: 'none',
      payment_notes: val('pay-notes') || item.payment_notes || '',
    });
    showToast('Restaurante marcado em dia', 'success');
    await carregarFinanceiroPlataforma();
  } catch(e) {
    showToast(e.message, 'error');
  }
}

async function registrarPagamentoFinanceiro(btn) {
  const item = itemFinanceiroSelecionado();
  if (!item) return showToast('Selecione um restaurante primeiro', 'error');
  const r = item.restaurant || {};
  const amount = Number(val('pay-amount') || 0);
  if (amount <= 0) return showToast('Informe o valor pago', 'error');
  const payload = {
    billing_status: 'em_dia',
    monthly_amount: Number(item.monthly_amount || amount || 0),
    due_date: val('pay-next-due') || item.due_date || null,
    trial_until: item.trial_until || null,
    grace_alert_days: Number(item.grace_alert_days || 15),
    grace_block_days: Number(item.grace_block_days || 30),
    block_mode: 'none',
    payment_notes: val('pay-notes') || '',
    register_payment: true,
    payment: {
      amount,
      paid_at: val('pay-date') || new Date().toISOString().slice(0, 10),
      next_due_date: val('pay-next-due') || null,
      reference: val('pay-ref') || '',
      notes: val('pay-notes') || '',
    },
  };
  const label = btn?.textContent || 'Registrar pagamento';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Registrando...';
  }
  try {
    await apiCall('PATCH', `/api/super-admin/restaurants/${r.id}/control`, payload);
    showToast(`Pagamento registrado para ${r.name}`, 'success');
    await carregarFinanceiroPlataforma();
    const input = document.getElementById('pay-rest-query');
    if (input) input.value = codigoClienteFinanceiro(encontrarFinanceiroItem(r.id));
    renderPagamentoSelecionado(encontrarFinanceiroItem(r.id));
  } catch(e) {
    showToast(e.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.textContent = label;
    }
  }
}

function limparRegistroFinanceiro() {
  ['pay-rest-query', 'pay-amount', 'pay-next-due', 'pay-ref', 'pay-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const date = document.getElementById('pay-date');
  if (date) date.value = new Date().toISOString().slice(0,10);
  renderPagamentoSelecionado(null);
}

function prepararCodigosFinanceiros() {
  const sorted = FINANCEIRO_ITEMS
    .slice()
    .sort((a, b) => {
      const da = String(a.restaurant?.created_at || '');
      const db = String(b.restaurant?.created_at || '');
      return da.localeCompare(db) || String(a.restaurant?.name || '').localeCompare(String(b.restaurant?.name || ''));
    });

  const clientCodes = new Map();
  let next = 1;
  sorted.forEach(item => {
    const key = grupoClienteFinanceiro(item);
    const existing = item.customer_code || item.control?.customer_code || item.client_code;
    if (existing) {
      clientCodes.set(key, existing);
      item.client_code = existing;
      return;
    }
    if (!clientCodes.has(key)) clientCodes.set(key, `CLI-${String(next++).padStart(3, '0')}`);
    item.client_code = clientCodes.get(key);
  });

  const byGroup = {};
  FINANCEIRO_ITEMS.forEach(item => {
    const key = grupoClienteFinanceiro(item);
    byGroup[key] = byGroup[key] || [];
    byGroup[key].push(item);
  });
  Object.values(byGroup).forEach(items => {
    const ordered = items.slice().sort((a, b) => String(a.restaurant?.name || '').localeCompare(String(b.restaurant?.name || '')));
    ordered.forEach((item, idx) => {
      const existingBranch = item.branch_code || item.control?.branch_code;
      item.branch_code = existingBranch || (ordered.length > 1 ? `${item.client_code}-U${idx + 1}` : item.client_code);
      item.branch_label = item.branch_label || item.control?.branch_label || (ordered.length > 1 ? `Unidade ${idx + 1}` : 'Matriz');
    });
  });
}

function codigoClienteFinanceiro(item) {
  if (!item) return '';
  return item.branch_code || item.client_code || 'CLI-000';
}

function grupoClienteFinanceiro(item) {
  const r = item.restaurant || {};
  if (r.parent_restaurant_id) return `parent:${r.parent_restaurant_id}`;
  return `name:${normalizarNomeCliente(r.name || r.slug || r.id || '')}`;
}

function normalizarNomeCliente(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(unidade|filial|loja|matriz)\b/g, '')
    .replace(/\s*[-|/]\s*(carapicuiba|osasco|jandira|barueri|sao paulo|sp|centro|matriz).*$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function unidadesDoClienteFinanceiro(item) {
  if (!item) return [];
  const key = grupoClienteFinanceiro(item);
  return FINANCEIRO_ITEMS
    .filter(other => grupoClienteFinanceiro(other) === key)
    .sort((a, b) => String(a.restaurant?.name || '').localeCompare(String(b.restaurant?.name || '')));
}

function renderSelectUnidadesFinanceiro(item) {
  const row = document.getElementById('pay-unit-row');
  const sel = document.getElementById('pay-unit-select');
  if (!row || !sel) return;
  const units = unidadesDoClienteFinanceiro(item);
  if (!item || units.length <= 1) {
    row.style.display = 'none';
    sel.innerHTML = '';
    return;
  }
  row.style.display = 'block';
  sel.innerHTML = units.map(unit => {
    const r = unit.restaurant || {};
    return `<option value="${escapeAttr(r.id || '')}" ${r.id === item.restaurant?.id ? 'selected' : ''}>${escapeHtml(codigoClienteFinanceiro(unit))} - ${escapeHtml(r.name || r.slug || 'Unidade')}</option>`;
  }).join('');
}

function financeMetric(label, value) {
  return `<div class="finance-metric"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`;
}

function statusFinanceiroLabel(status) {
  return {
    em_dia: 'Em dia',
    teste_gratis: 'Teste grátis',
    vencido: 'Vencido',
    bloqueado: 'Bloqueado',
  }[status] || status || '-';
}

function fmtDateShort(value) {
  if (!value) return '-';
  return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR');
}

async function salvarFinanceiroRestaurante(restId, btn) {
  const payload = {
    plan: val(`fin-plan-${restId}`) || undefined,
    billing_status: val(`fin-status-${restId}`),
    monthly_amount: Number(val(`fin-monthly-${restId}`) || 0),
    due_date: val(`fin-due-${restId}`) || null,
    trial_until: val(`fin-trial-${restId}`) || null,
    grace_alert_days: Number(val(`fin-alert-${restId}`) || 15),
    grace_block_days: Number(val(`fin-block-days-${restId}`) || 30),
    block_mode: val(`fin-block-${restId}`),
    payment_notes: val(`fin-notes-${restId}`),
    register_payment: checked(`fin-register-${restId}`),
    payment: {
      amount: Number(val(`fin-pay-amount-${restId}`) || 0),
      paid_at: val(`fin-pay-date-${restId}`) || null,
      next_due_date: val(`fin-next-due-${restId}`) || null,
      reference: val(`fin-pay-ref-${restId}`) || '',
      notes: val(`fin-notes-${restId}`) || '',
    },
  };
  const label = btn?.textContent || 'Salvar financeiro';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Salvando...';
  }
  try {
    await apiCall('PATCH', `/api/super-admin/restaurants/${restId}/control`, payload);
    showToast('Financeiro atualizado', 'success');
    await carregarFinanceiroPlataforma();
    carregarRestaurantes();
  } catch(e) {
    showToast(e.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.textContent = label;
    }
  }
}

/* ── SUPORTE ────────────────────────────────────────── */
async function carregarSuportePlataforma() {
  const el = document.getElementById('suporte-content');
  if (!el) return;
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await apiCall('GET', '/api/super-admin/support');
    SUPORTE_ITEMS = data.tickets || [];
    atualizarBadgeSuporteSuper(SUPORTE_ITEMS);
    renderSuportePlataforma(data.summary || {});
  } catch(e) {
    el.innerHTML = `<div class="tabela-empty">Erro ao carregar suporte: ${escapeHtml(e.message)}</div>`;
  }
}

function renderSuportePlataforma(summary = {}) {
  const el = document.getElementById('suporte-content');
  const abertos = SUPORTE_ITEMS.filter(t => t.status !== 'resolvido');
  const ordenados = [...SUPORTE_ITEMS].sort((a, b) => {
    const statusScore = { aberto: 0, em_andamento: 1, aguardando_cliente: 2, resolvido: 9 };
    const priScore = { urgente: 0, alta: 1, normal: 2 };
    return (statusScore[a.status] ?? 5) - (statusScore[b.status] ?? 5)
      || (priScore[a.priority] ?? 2) - (priScore[b.priority] ?? 2)
      || new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
  el.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Chamados abertos</div><div class="stat-val amber">${escapeHtml(summary.open ?? abertos.length)}</div></div>
      <div class="stat-card"><div class="stat-label">Urgentes</div><div class="stat-val red">${escapeHtml(summary.urgent ?? abertos.filter(t => t.priority === 'urgente').length)}</div></div>
      <div class="stat-card"><div class="stat-label">Resolvidos</div><div class="stat-val green">${escapeHtml(summary.resolved ?? 0)}</div></div>
      <div class="stat-card"><div class="stat-label">Total</div><div class="stat-val">${escapeHtml(summary.total ?? SUPORTE_ITEMS.length)}</div></div>
    </div>
    <div class="support-flow">
      <div><b>Fluxo</b><span>Aberto → Em andamento → Liberado para teste → Aguardando cliente → Resolvido</span></div>
      <div><b>WhatsApp</b><span>Usem o WhatsApp para conversar e testar. No sistema, atualizem o status para orientar o cliente.</span></div>
    </div>
    <div class="support-board">
      ${(ordenados.length ? ordenados : []).map(renderSupportCard).join('') || '<div class="tabela-empty">Nenhum chamado registrado.</div>'}
    </div>`;
}

function renderSupportCard(t) {
  const r = t.restaurant || {};
  return `
    <div class="support-card ${escapeAttr(t.status || 'aberto')}">
      <div class="support-card-top">
        <div>
          <div class="support-code">${escapeHtml(t.ticket_number || t.id || 'Chamado')}</div>
          <div class="support-title">${escapeHtml(t.subject || t.message || 'Sem assunto')}</div>
          <div class="support-client">${escapeHtml(r.name || 'Restaurante')} /${escapeHtml(r.slug || '-')} · ${fmtDate(t.created_at)}</div>
        </div>
        <span class="support-pill ${escapeAttr(t.priority || 'normal')}">${escapeHtml(prioridadeSuporteLabel(t.priority))}</span>
      </div>
      <div class="support-message">${escapeHtml(t.message || '')}</div>
      ${t.last_response ? `<div class="support-response">${escapeHtml(t.last_response)}</div>` : ''}
      <div class="support-status-line">${escapeHtml(statusSuporteLabel(t.status))} · ${escapeHtml(t.category || 'suporte')} · Cliente: ${escapeHtml(t.customer_name || t.customer_email || '-')}</div>
      <div class="support-next-step ${escapeAttr(t.status || 'aberto')}">${escapeHtml(suporteAcaoOperador(t.status))}</div>
      <div class="support-actions-grid">
        <select class="form-input" id="sup-status-${escapeAttr(t.id)}">
          ${supportStatusOptions(t.status)}
        </select>
        <select class="form-input" id="sup-priority-${escapeAttr(t.id)}">
          ${supportPriorityOptions(t.priority)}
        </select>
      </div>
      <textarea class="form-input text-area compact" id="sup-response-${escapeAttr(t.id)}" placeholder="Resposta visível para o cliente">${escapeHtml(t.last_response || '')}</textarea>
      <textarea class="form-input text-area compact" id="sup-notes-${escapeAttr(t.id)}" placeholder="Notas internas">${escapeHtml(t.admin_notes || '')}</textarea>
      <div class="support-actions">
        <button class="btn btn-sm" onclick="abrirDetalhesRestaurante('${escapeAttr(r.id || t.restaurant_id)}')">Detalhes</button>
        <button class="btn btn-sm btn-primary" onclick="salvarTicketSuporte('${escapeAttr(t.id)}', this)">Salvar chamado</button>
      </div>
    </div>`;
}

function renderSupportMini(t) {
  return `
    <div class="support-mini ${escapeAttr(t.status || 'aberto')}">
      <strong>${escapeHtml(t.ticket_number || 'Chamado')}</strong>
      <span>${escapeHtml(statusSuporteLabel(t.status))} · ${escapeHtml(prioridadeSuporteLabel(t.priority))}</span>
      <small>${escapeHtml(t.subject || t.message || '')}</small>
    </div>`;
}

async function salvarTicketSuporte(ticketId, btn) {
  const label = btn?.textContent || 'Salvar chamado';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Salvando...';
  }
  try {
    await apiCall('PATCH', `/api/super-admin/support/${ticketId}`, {
      status: val(`sup-status-${ticketId}`),
      priority: val(`sup-priority-${ticketId}`),
      last_response: val(`sup-response-${ticketId}`),
      admin_notes: val(`sup-notes-${ticketId}`),
    });
    showToast('Chamado atualizado', 'success');
    await carregarSuportePlataforma();
    carregarContadorSuporteSuper(false);
    if (DETALHE_ATUAL?.restaurant?.id) abrirDetalhesRestaurante(DETALHE_ATUAL.restaurant.id);
  } catch(e) {
    showToast(e.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.textContent = label;
    }
  }
}

async function carregarContadorSuporteSuper(showErrors = false) {
  try {
    const data = await apiCall('GET', '/api/super-admin/support');
    atualizarBadgeSuporteSuper(data.tickets || []);
  } catch(e) {
    if (showErrors) showToast(e.message, 'error');
  }
}

function atualizarBadgeSuporteSuper(tickets) {
  const total = (tickets || []).filter(t => t.status !== 'resolvido').length;
  ['super-support-open-count', 'super-support-nav-count'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = total;
    el.style.display = total ? 'inline-flex' : 'none';
  });
}

function supportStatusOptions(value) {
  return [['aberto','Aberto'],['em_andamento','Em andamento'],['liberado_teste','Liberado para teste'],['aguardando_cliente','Aguardando cliente'],['resolvido','Resolvido']]
    .map(([v, t]) => `<option value="${v}" ${value === v ? 'selected' : ''}>${t}</option>`).join('');
}

function supportPriorityOptions(value) {
  return [['normal','Normal'],['alta','Alta'],['urgente','Urgente']]
    .map(([v, t]) => `<option value="${v}" ${value === v ? 'selected' : ''}>${t}</option>`).join('');
}

function statusSuporteLabel(status) {
  return ({ aberto: 'Aberto', em_andamento: 'Em andamento', liberado_teste: 'Liberado para teste', aguardando_cliente: 'Aguardando cliente', resolvido: 'Resolvido' })[status] || 'Aberto';
}

function prioridadeSuporteLabel(priority) {
  return ({ normal: 'Normal', alta: 'Alta', urgente: 'Urgente' })[priority] || 'Normal';
}

function suporteAcaoOperador(status) {
  return ({
    aberto: 'Novo chamado. Conferir pelo WhatsApp e iniciar atendimento.',
    em_andamento: 'Equipe trabalhando. Mantenha o cliente informado pelo WhatsApp.',
    liberado_teste: 'Ajuste pronto para o cliente testar. Peça confirmação pelo WhatsApp.',
    aguardando_cliente: 'Aguardando retorno ou teste do cliente pelo WhatsApp.',
    resolvido: 'Chamado encerrado após validação ou confirmação.',
  })[status] || 'Conferir atendimento.';
}

/* ── MÉTRICAS ───────────────────────────────────────── */
async function carregarMetricas() {
  document.getElementById('metricas-content').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const m = await apiCall('GET', '/api/super-admin/metrics');
    document.getElementById('metricas-content').innerHTML = `
      <div class="stats-row">
        <div class="stat-card"><div class="stat-label">Total restaurantes</div><div class="stat-val purple">${m.total_restaurants}</div></div>
        <div class="stat-card"><div class="stat-label">Restaurantes ativos</div><div class="stat-val green">${m.active_restaurants}</div></div>
        <div class="stat-card"><div class="stat-label">Usuários vinculados</div><div class="stat-val amber">${m.total_users}</div></div>
        <div class="stat-card"><div class="stat-label">Total pedidos</div><div class="stat-val">${m.total_orders}</div></div>
      </div>`;
  } catch(e) {
    document.getElementById('metricas-content').innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted)">Erro: ' + e.message + '</div>';
  }
}

async function carregarOperacao() {
  const el = document.getElementById('operacao-content');
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await apiCall('GET', '/api/super-admin/operations');
    const s = data.summary || {};
    el.innerHTML = `
      <div class="ops-head">
        <div>
          <div class="ops-version">Backend ${escapeHtml(data.version || '-')} · ${fmtDate(data.generated_at)}</div>
          <h3>Saúde operacional da plataforma</h3>
        </div>
        <button class="btn btn-sm" onclick="executarValidacao();irPara('validacao', document.querySelector('[onclick*=validacao]'))">Rodar validação</button>
      </div>
      <div class="stats-row">
        <div class="stat-card"><div class="stat-label">Clientes ativos</div><div class="stat-val green">${escapeHtml(s.restaurants_active ?? 0)}</div></div>
        <div class="stat-card"><div class="stat-label">Pedidos 24h</div><div class="stat-val purple">${escapeHtml(s.orders_24h ?? 0)}</div></div>
        <div class="stat-card"><div class="stat-label">Pedidos abertos</div><div class="stat-val amber">${escapeHtml(s.orders_open ?? 0)}</div></div>
        <div class="stat-card"><div class="stat-label">Receita 24h</div><div class="stat-val">R$ ${fmtMoney(s.revenue_24h)}</div></div>
      </div>
      <div class="ops-grid">
        <div class="detail-panel">
          <div class="detail-panel-title">Alertas</div>
          <div class="ops-alerts">
            ${(data.alerts || []).map(a => `
              <div class="ops-alert ${escapeAttr((a.level || '').toLowerCase())}">
                <b>${escapeHtml(a.title)}</b>
                <span>${escapeHtml(a.detail)}</span>
              </div>`).join('') || '<div class="muted-line">Sem alertas</div>'}
          </div>
        </div>
        <div class="detail-panel">
          <div class="detail-panel-title">Pedidos abertos</div>
          <div class="mini-table">
            ${(data.open_orders || []).map(p => `<div>
              <span>#${escapeHtml(p.numero)} · ${escapeHtml(p.status)} · R$ ${fmtMoney(p.total)}</span>
              <small>${escapeHtml(p.restaurants?.name || '-')} · Mesa ${escapeHtml(p.mesas?.numero || '-')} · ${fmtDate(p.created_at)}</small>
            </div>`).join('') || '<div class="muted-line">Nenhum pedido aberto</div>'}
          </div>
        </div>
        <div class="detail-panel">
          <div class="detail-panel-title">Mesas antigas</div>
          <div class="mini-table">
            ${(data.old_tables || []).map(m => `<div>
              <span>${escapeHtml(m.restaurants?.name || '-')} · Mesa ${escapeHtml(m.mesas?.numero || '-')}</span>
              <small>Aberta em ${fmtDate(m.aberta_em)} · R$ ${fmtMoney(m.total_consumido)}</small>
            </div>`).join('') || '<div class="muted-line">Nenhuma mesa antiga</div>'}
          </div>
        </div>
        <div class="detail-panel">
          <div class="detail-panel-title">Erros recentes</div>
          <div class="mini-table">
            ${(data.recent_errors || []).map(e => `<div>
              <span>${escapeHtml(e.acao)} · ${escapeHtml(e.tabela || '-')}</span>
              <small>${escapeHtml(e.restaurants?.name || 'Plataforma')} · ${fmtDate(e.created_at)} · ${escapeHtml(resumoLog(e.valor_novo))}</small>
            </div>`).join('') || '<div class="muted-line">Nenhum erro registrado</div>'}
          </div>
        </div>
      </div>`;
  } catch(e) {
    el.innerHTML = `<div class="tabela-empty">Erro ao carregar operação: ${escapeHtml(e.message)}</div>`;
  }
}

async function exportarBackupPlataforma() {
  try {
    showToast('Gerando backup...', 'success');
    const backup = await apiCall('GET', '/api/super-admin/backup');
    baixarJson(backup, `plataforma-backup-${new Date().toISOString().slice(0,10)}.json`);
    showToast('Backup exportado', 'success');
  } catch(e) {
    showToast(e.message, 'error');
  }
}

async function carregarAuditoria() {
  const el = document.getElementById('auditoria-content');
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const { logs } = await apiCall('GET', '/api/super-admin/audit');
    el.innerHTML = `
      <div class="tabela-wrap">
        <table class="tabela">
          <thead><tr><th>Data</th><th>Restaurante</th><th>Ação</th><th>Usuário</th><th>Detalhe</th></tr></thead>
          <tbody>
            ${(logs || []).map(l => `<tr>
              <td class="mono" style="font-size:11px">${fmtDate(l.created_at)}</td>
              <td>${escapeHtml(l.restaurants?.name || 'Plataforma')}<div class="rest-slug">${escapeHtml(l.restaurants?.slug || '')}</div></td>
              <td><span class="badge badge-plan">${escapeHtml(l.acao || '-')}</span></td>
              <td>${escapeHtml(l.usuario_nome || '-')}<div class="rest-slug">${escapeHtml(l.perfil || '')}</div></td>
              <td style="font-size:12px;color:var(--muted)">${escapeHtml(resumoLog(l.valor_novo))}</td>
            </tr>`).join('') || '<tr><td colspan="5" class="tabela-empty">Nenhum log</td></tr>'}
          </tbody>
        </table>
      </div>`;
  } catch(e) {
    el.innerHTML = `<div class="tabela-empty">Erro ao carregar auditoria: ${escapeHtml(e.message)}</div>`;
  }
}

/* ── VALIDAÇÃO ──────────────────────────────────────── */
async function executarValidacao() {
  document.getElementById('validacao-content').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const { checks } = await apiCall('GET', '/api/super-admin/diagnostics');
    document.getElementById('validacao-content').innerHTML = `
      <div class="tabela-wrap">
        <table class="tabela">
          <thead><tr><th>Check</th><th>Status</th><th>Detalhe</th></tr></thead>
          <tbody>
            ${checks.map(c => `<tr>
              <td class="mono" style="font-size:12px">${c.check_name}</td>
              <td><span style="font-weight:700;color:${c.status==='OK'?'var(--green)':c.status==='INFO'?'var(--amber)':'var(--red)'}">${c.status}</span></td>
              <td style="font-size:12px;color:var(--muted)">${c.detail}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch(e) {
    document.getElementById('validacao-content').innerHTML = `
      <div class="tabela-empty">
        A validação avançada depende do backend atualizado no Render. Rode o deploy do último commit no Render para liberar estes checks.
      </div>`;
  }
}

/* ── UTILS ──────────────────────────────────────────── */
function fecharModal(id) { document.getElementById(id).classList.remove('show'); }
document.querySelectorAll('.modal-bg').forEach(b =>
  b.addEventListener('click', e => { if(e.target===b) b.classList.remove('show'); }));

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function escapeJs(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '');
}

function val(id) {
  return document.getElementById(id)?.value;
}

function checked(id) {
  return document.getElementById(id)?.checked === true;
}

function fmtMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function shortId(value) {
  const id = String(value || '');
  return id.length > 12 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id || '-';
}

function addMonthsDate(value, months) {
  const d = new Date(`${String(value || new Date().toISOString().slice(0, 10)).slice(0, 10)}T00:00:00`);
  const day = d.getDate();
  d.setMonth(d.getMonth() + Number(months || 1));
  if (d.getDate() !== day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

function baixarJson(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function resumoLog(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const text = JSON.stringify(value);
  return text.length > 120 ? text.slice(0, 120) + '...' : text;
}

function planLabel(plan) {
  return PLANOS[plan]?.label || plan || 'Básico';
}

function showToast(msg, tipo='') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (tipo?' '+tipo:'') + ' show';
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3500);
}

