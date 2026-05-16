let RESTAURANTES = [];
let mostrarInativos = false;
let DETALHE_ATUAL = null;

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
  const loaders = { restaurantes: carregarRestaurantes, usuarios: carregarUsuarios, metricas: carregarMetricas, auditoria: carregarAuditoria, validacao: () => {} };
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
            <button class="btn btn-sm btn-primary" onclick="abrirDetalhesRestaurante('${r.id}')">Detalhes</button>
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
  const u = d.usage || {};
  document.getElementById('detalhes-title').textContent = r.name;
  document.getElementById('detalhes-subtitle').textContent = `/r/${r.slug} • ${r.plan} • ${r.is_active ? 'ativo' : 'inativo'}`;
  document.getElementById('detalhes-body').innerHTML = `
    <div class="detail-actions">
      <a class="btn btn-sm" href="${escapeAttr(d.links.admin)}" target="_blank" rel="noopener">Admin</a>
      <a class="btn btn-sm" href="${escapeAttr(d.links.caixa)}" target="_blank" rel="noopener">Caixa</a>
      <a class="btn btn-sm" href="${escapeAttr(d.links.tv)}" target="_blank" rel="noopener">TV</a>
      <a class="btn btn-sm" href="${escapeAttr(d.links.garcom)}" target="_blank" rel="noopener">Garçom</a>
      <button class="btn btn-sm" onclick="verQRCodes('${r.id}','${escapeJs(r.name)}')">QR Codes</button>
      <button class="btn btn-sm btn-primary" onclick="entrarComoDono('${r.id}')">Entrar como dono</button>
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
        <div class="detail-panel-title">Controle comercial</div>
        <div class="form-grid">
          ${selectField('ctrl-plan', 'Plano', r.plan, [['starter','Starter'],['pro','Pro'],['enterprise','Enterprise']])}
          ${selectField('ctrl-billing', 'Status financeiro', c.billing_status, [['em_dia','Em dia'],['teste_gratis','Teste grátis'],['vencido','Vencido'],['bloqueado','Bloqueado']])}
          ${inputField('ctrl-due', 'Vencimento', c.due_date || '', 'date')}
          ${inputField('ctrl-trial', 'Teste até', c.trial_until || '', 'date')}
          ${selectField('ctrl-segment', 'Segmento', c.segment, [['restaurante','Restaurante'],['padaria','Padaria'],['pizzaria','Pizzaria'],['bar','Bar'],['hamburgueria','Hamburgueria'],['delivery','Delivery']])}
          ${inputField('ctrl-city', 'Cidade', c.city || '')}
        </div>
      </div>

      <div class="detail-panel">
        <div class="detail-panel-title">Limites e módulos</div>
        <div class="form-grid compact">
          ${inputField('limit-users', 'Usuários', c.limits?.users ?? 5, 'number')}
          ${inputField('limit-tables', 'Mesas', c.limits?.tables ?? 20, 'number')}
          ${inputField('limit-products', 'Produtos', c.limits?.products ?? 100, 'number')}
          ${selectField('ctrl-block', 'Bloqueio', c.block_mode, [['none','Sem bloqueio'],['orders','Bloquear pedidos'],['admin','Bloquear admin'],['users','Bloquear usuários'],['full','Bloqueio total']])}
        </div>
        <div class="module-grid">
          ${moduleToggle('mod-financeiro', 'Financeiro', c.modules?.financeiro)}
          ${moduleToggle('mod-estoque', 'Estoque', c.modules?.estoque)}
          ${moduleToggle('mod-cupons', 'Cupons', c.modules?.cupons)}
          ${moduleToggle('mod-tv', 'TV', c.modules?.tv)}
          ${moduleToggle('mod-garcom', 'Garçom', c.modules?.garcom)}
          ${moduleToggle('mod-relatorios', 'Relatórios', c.modules?.relatorios)}
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
          ${selectField('support-status', 'Chamado', c.support_status, [['sem_chamado','Sem chamado'],['aberto','Aberto'],['em_andamento','Em andamento'],['resolvido','Resolvido']])}
          ${selectField('support-priority', 'Prioridade', c.support_priority, [['normal','Normal'],['alta','Alta'],['urgente','Urgente']])}
        </div>
        <label class="form-label">Notas internas</label>
        <textarea class="form-input text-area" id="internal-notes">${escapeHtml(c.internal_notes || '')}</textarea>
        <label class="form-label">Suporte</label>
        <textarea class="form-input text-area" id="support-notes">${escapeHtml(c.support_notes || '')}</textarea>
        <label class="form-label">Aviso para o cliente</label>
        <textarea class="form-input text-area" id="broadcast-message">${escapeHtml(c.broadcast_message || '')}</textarea>
      </div>
    </div>

    <div class="detail-grid two">
      <div class="detail-panel">
        <div class="detail-panel-title">Usuários</div>
        <div class="mini-table">
          ${(d.users || []).map(m => `<div><span>${escapeHtml(m.usuarios?.nome || 'Sem nome')}</span><small>${escapeHtml(m.role)} • ${escapeHtml(m.usuarios?.email || '')}</small></div>`).join('') || '<div class="muted-line">Nenhum usuário</div>'}
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

async function salvarControleRestaurante(restId) {
  const payload = {
    plan: val('ctrl-plan'),
    billing_status: val('ctrl-billing'),
    due_date: val('ctrl-due') || null,
    trial_until: val('ctrl-trial') || null,
    segment: val('ctrl-segment'),
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
    modules: {
      financeiro: checked('mod-financeiro'),
      estoque: checked('mod-estoque'),
      cupons: checked('mod-cupons'),
      tv: checked('mod-tv'),
      garcom: checked('mod-garcom'),
      relatorios: checked('mod-relatorios'),
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

async function entrarComoDono(restId) {
  if (!confirm('Entrar no painel deste cliente como suporte? A ação será registrada em auditoria.')) return;
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

function exportarRestauranteAtual() {
  if (!DETALHE_ATUAL) return;
  const data = JSON.stringify(DETALHE_ATUAL, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${DETALHE_ATUAL.restaurant.slug}-export.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function abrirModalNovoRest() {
  ['r-nome','r-slug','r-email','r-owner-nome','r-owner-email','r-owner-senha'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('r-template').value = 'restaurante';
  document.getElementById('r-mesas').value = 10;
  document.getElementById('r-categorias').checked = true;
  document.getElementById('modal-rest').classList.add('show');
}

function aplicarTemplateRestaurante() {
  const template = document.getElementById('r-template').value;
  const presets = {
    restaurante: { mesas: 10, plano: 'starter', cor: '#ff4d1c' },
    padaria: { mesas: 6, plano: 'starter', cor: '#c0843d' },
    pizzaria: { mesas: 12, plano: 'pro', cor: '#d92d20' },
    bar: { mesas: 16, plano: 'pro', cor: '#22c55e' },
    hamburgueria: { mesas: 8, plano: 'pro', cor: '#f59e0b' },
    delivery: { mesas: 0, plano: 'starter', cor: '#7c3aed' },
  };
  const p = presets[template] || presets.restaurante;
  document.getElementById('r-mesas').value = p.mesas;
  document.getElementById('r-plano').value = p.plano;
  document.getElementById('r-cor').value = p.cor;
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
  const template = document.getElementById('r-template').value;
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
    await apiCall('PATCH', `/api/super-admin/restaurants/${restaurant.id}/control`, { segment: template }).catch(() => null);

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
        <div class="stat-card"><div class="stat-label">Usuários vinculados</div><div class="stat-val amber">${m.total_users}</div></div>
        <div class="stat-card"><div class="stat-label">Total pedidos</div><div class="stat-val">${m.total_orders}</div></div>
      </div>`;
  } catch(e) {
    document.getElementById('metricas-content').innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted)">Erro: ' + e.message + '</div>';
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

function resumoLog(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const text = JSON.stringify(value);
  return text.length > 120 ? text.slice(0, 120) + '...' : text;
}

function showToast(msg, tipo='') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (tipo?' '+tipo:'') + ' show';
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3500);
}

