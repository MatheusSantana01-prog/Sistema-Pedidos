let RESTAURANTES = [];
let mostrarInativos = false;

/* ── LOGIN ──────────────────────────────────────────── */
async function fazerLogin() {
  const email = document.getElementById('l-email').value.trim();
  const senha = document.getElementById('l-senha').value.trim();
  const btn   = document.querySelector('.btn-primary');
  const erro  = document.getElementById('login-erro');
  btn.disabled = true;
  document.getElementById('login-txt').textContent = 'Entrando...';
  try {
    const data = await login(email, senha);
    if (!data.usuario?.is_super_admin) {
      throw new Error('Sem acesso de super admin');
    }
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
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

function iniciarApp(u) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'flex';
  document.getElementById('user-email').textContent = u.email;
  carregarRestaurantes();
}

if (isLoggedIn() && getUsuario()?.is_super_admin) {
  iniciarApp(getUsuario());
}

/* ── NAV ────────────────────────────────────────────── */
function irPara(pagina, tabEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + pagina).classList.add('active');
  tabEl.classList.add('active');
  const loaders = { restaurantes: carregarRestaurantes, usuarios: carregarUsuarios, metricas: carregarMetricas, validacao: () => {} };
  if (loaders[pagina]) loaders[pagina]();
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
      sel.innerHTML = RESTAURANTES.map(r => `<option value="${r.id}">${r.name} (${r.slug})</option>`).join('');
    }

    const visiveis = mostrarInativos ? RESTAURANTES : RESTAURANTES.filter(r => r.is_active);

    document.getElementById('restaurantes-lista').innerHTML = !visiveis.length
      ? '<div style="padding:32px;text-align:center;color:var(--muted)">Nenhum restaurante</div>'
      : visiveis.map(r => `
        <div class="rest-card">
          <div class="rest-color" style="background:${r.primary_color||'#ff4d1c'}"></div>
          <div class="rest-info">
            <div class="rest-nome">${r.name}</div>
            <div class="rest-slug">/r/${r.slug}</div>
            <div class="rest-badges">
              <span class="badge ${r.is_active ? 'badge-active' : 'badge-inactive'}">${r.is_active ? '● Ativo' : '● Inativo'}</span>
              <span class="badge badge-plan">${r.plan}</span>
              <span class="badge" style="background:rgba(255,255,255,.05);color:var(--muted)">${new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
          <div class="rest-actions">
            <a class="btn btn-sm" href="/r/${r.slug}/admin" target="_blank" rel="noopener">Admin</a>
            <button class="btn btn-sm" onclick="verQRCodes('${r.id}','${r.name}')">QR Codes</button>
            <button class="btn btn-sm ${r.is_active?'btn-danger':''}" onclick="toggleAtivo('${r.id}',${r.is_active})">
              ${r.is_active ? 'Desativar' : 'Ativar'}
            </button>
            <button class="btn btn-sm btn-danger" onclick="deletarRestaurante('${r.id}','${r.name}')">Deletar</button>
          </div>
        </div>`).join('');
  } catch(e) {
    document.getElementById('restaurantes-lista').innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted)">Erro: ' + e.message + '</div>';
  }
}

async function toggleAtivo(id, atual) {
  if (!confirm(`${atual ? 'Desativar' : 'Ativar'} este restaurante?`)) return;
  try {
    await apiCall('PATCH', `/api/super-admin/restaurants/${id}/status`, { is_active: !atual });
    showToast(atual ? 'Restaurante desativado' : 'Restaurante ativado', 'success');
    carregarRestaurantes();
  } catch(e) { showToast(e.message, 'error'); }
}

async function deletarRestaurante(id, nome) {
  const ok = confirm(`Deletar "${nome}"? Se o backend já estiver atualizado, os dados serão apagados. Se ainda não estiver, ele será desativado e removido desta lista.`);
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

function abrirModalNovoRest() {
  ['r-nome','r-slug','r-email','r-owner-nome','r-owner-email','r-owner-senha'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('r-mesas').value = 10;
  document.getElementById('r-categorias').checked = true;
  document.getElementById('modal-rest').classList.add('show');
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
  const plano = document.getElementById('r-plano').value;
  const cor   = document.getElementById('r-cor').value;
  const mesas = Number(document.getElementById('r-mesas').value || 0);
  const categorias = document.getElementById('r-categorias').checked;
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
      primary_color: cor,
      initial_table_count: mesas,
      create_default_categories: categorias,
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
          <td>${m.usuarios?.nome||'—'}</td>
          <td class="mono" style="font-size:12px">${m.usuarios?.email||'—'}</td>
          <td style="font-size:12px;color:var(--muted)">${m.restaurants?.name||'—'}</td>
          <td><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:3px;background:rgba(124,58,237,.1);color:var(--primary)">${m.role}</span></td>
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
  try {
    await apiCall('POST', `/api/super-admin/restaurants/${restId}/users`, { nome, email, senha, role });
    showToast('Usuário criado com sucesso', 'success');
    fecharModal('modal-usuario');
    carregarUsuarios();
  } catch(e) { showToast(e.message, 'error'); }
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
        <div class="stat-card"><div class="stat-label">Total usuários</div><div class="stat-val amber">${m.total_users}</div></div>
        <div class="stat-card"><div class="stat-label">Total pedidos</div><div class="stat-val">${m.total_orders}</div></div>
      </div>`;
  } catch(e) {
    document.getElementById('metricas-content').innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted)">Erro: ' + e.message + '</div>';
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

function showToast(msg, tipo='') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (tipo?' '+tipo:'') + ' show';
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3500);
}

