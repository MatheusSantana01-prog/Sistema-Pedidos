let RESTAURANT   = null;
let MESA         = null;
let SESSAO_ID    = null;
let categorias   = [];
let todosProdutos = [];
let carrinho     = [];
let prodAtual    = null;
let modsSelecionadas = {};
let pollingConta = null;
let notaFeedback = 5;
let categoriaAtual = null;

const FOOD_IMAGES = {
  pizza: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80',
  burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80',
  fries: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=80',
  chicken: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=900&q=80',
  drink: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80',
  juice: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?auto=format&fit=crop&w=900&q=80',
  dessert: 'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?auto=format&fit=crop&w=900&q=80',
  default: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
};

/* ── INIT ───────────────────────────────────────────── */
async function init() {
  // 1. Resolver restaurante pelo slug
  RESTAURANT = await initTenant();
  if (!RESTAURANT) return;

  // 2. Buscar mesa pelo token na URL
  // URL: /r/{slug}/mesa/{token}
  const path  = window.location.pathname;
  const match = path.match(/\/mesa\/([^\/]+)/);
  const token = match ? match[1] : new URLSearchParams(window.location.search).get('mesa');

  if (!token) {
    showToast('Mesa não identificada', 'error'); return;
  }

  try {
    const slug = getCurrentRestaurantSlug();
    // Validar mesa via API
    const resp = await apiPublic('GET', `/api/public/restaurants/${slug}/tables/${token}`);
    MESA = Array.isArray(resp.mesa) ? resp.mesa[0] : resp.mesa;
    if (!MESA?.id) throw new Error('Mesa inválida');
    document.getElementById('header-mesa').textContent = `Mesa ${MESA.numero || ''}`;

    // Abrir/recuperar sessão
    const sessResp = await apiPublic('POST', `/api/public/restaurants/${slug}/tables/${token}/sessions`);
    const sessaoData = Array.isArray(sessResp.sessao) ? sessResp.sessao[0] : sessResp.sessao;
    SESSAO_ID = sessaoData?.id;
    if (!SESSAO_ID) throw new Error('Sessão da mesa não foi criada');

    document.getElementById('app').style.display = 'block';
    carregarCardapio();
    iniciarPollingConta();
  } catch (e) {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:12px;background:var(--color-bg);color:var(--color-text);font-family:sans-serif;">
        <div style="font-size:48px;">🚫</div>
        <h2>Mesa não encontrada</h2>
        <p style="color:var(--muted)">Escaneie o QR Code da mesa novamente.</p>
      </div>`;
  }
}

/* ── CARDÁPIO ────────────────────────────────────────── */
async function carregarCardapio() {
  try {
    const slug = getCurrentRestaurantSlug();
    const { cardapio } = await apiPublic('GET', `/api/public/restaurants/${slug}/menu`);
    categorias = (cardapio || [])
      .map(c => ({ ...c, nome: c.nome || 'Categoria', icone: c.icone || '', produtos: c.produtos || [] }))
      .filter(c => c.produtos.length);
    todosProdutos = categorias.flatMap(c => c.produtos || []).map(p => ({
      ...p,
      nome: p.nome || 'Produto',
      descricao: p.descricao || '',
      preco: Number(p.preco || 0),
      foto_url: p.foto_url || '',
      ings: p.ings || []
    }));
    renderCats();
    renderHero();
    renderDestaques();
    renderProdutos(categorias);
  } catch (e) {
    showToast('Erro ao carregar cardápio', 'error');
  }
}

function renderHero() {
  const disponiveis = todosProdutos.filter(p => p.disponivel !== false);
  const destaque = disponiveis.find(p => p.destaque) || disponiveis[0];
  const precos = disponiveis.map(p => Number(p.preco || 0)).filter(v => v > 0);
  const menorPreco = precos.length ? Math.min(...precos) : 0;
  const heroBg = document.getElementById('menu-hero-bg');
  const title = document.getElementById('hero-title');
  const sub = document.getElementById('hero-sub');
  const stats = document.getElementById('hero-stats');
  if (destaque && heroBg) {
    heroBg.style.backgroundImage = `linear-gradient(90deg, rgba(8,7,6,.92), rgba(8,7,6,.58) 46%, rgba(8,7,6,.22)), url('${safeUrl(imageForProduct(destaque), FOOD_IMAGES.default)}')`;
    title.textContent = destaque.destaque ? 'Destaques preparados para sua mesa' : 'Escolha seu próximo pedido';
    sub.textContent = destaque.destaque
      ? `${destaque.nome} e outras opções da casa prontas para pedir pelo cardápio digital.`
      : 'Veja o cardápio, adicione ao carrinho e acompanhe sua conta pela mesa.';
  }
  if (stats) {
    stats.innerHTML = `
      <div><strong>${disponiveis.length}</strong><span>itens disponíveis</span></div>
      <div><strong>${categorias.length}</strong><span>categorias</span></div>
      ${menorPreco ? `<div><strong>R$ ${fmt(menorPreco)}</strong><span>a partir de</span></div>` : ''}
    `;
  }
}

function renderCats() {
  const el = document.getElementById('cats');
  const total = todosProdutos.filter(p => p.disponivel !== false).length;
  el.innerHTML = `<button class="cat-pill active" onclick="filtrarCat(this,null)"><span>Tudo</span><small>${total}</small></button>`;
  categorias.forEach(c => {
    const count = (c.produtos || []).filter(p => p.disponivel !== false).length;
    el.innerHTML += `<button class="cat-pill" onclick="filtrarCat(this,'${escapeAttr(c.id)}')"><span>${escapeHtml(c.icone||'')} ${escapeHtml(c.nome)}</span><small>${count}</small></button>`;
  });
}

function filtrarCat(btn, id) {
  categoriaAtual = id;
  document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderProdutos(id ? categorias.filter(c => c.id === id) : categorias);
  document.getElementById('produtos-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderDestaques() {
  const dest = todosProdutos.filter(p => p.destaque && p.disponivel !== false);
  const wrap = document.getElementById('destaques-wrap');
  if (!dest.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `<div class="dest-wrap">
    <div class="dest-head">
      <div>
        <div class="dest-label">Seleção da casa</div>
        <div class="dest-title">Destaques do cardápio</div>
      </div>
    </div>
    <div class="dest-grid">
      ${dest.slice(0,4).map(p => `
        <div class="dest-card" onclick="abrirProduto('${escapeAttr(p.id)}')">
          <div class="dest-img-wrap">
            <img src="${safeUrl(imageForProduct(p), FOOD_IMAGES.default)}" alt="${escapeAttr(p.nome)}" loading="lazy" onerror="this.src='${FOOD_IMAGES.default}'">
            <span>Mais pedido</span>
          </div>
          <div class="dest-card-body">
            <div class="dest-card-nome">${escapeHtml(p.nome)}</div>
            ${p.descricao ? `<div class="dest-card-desc">${escapeHtml(p.descricao)}</div>` : ''}
            <div class="dest-card-foot">
              <div class="dest-card-preco">R$ ${fmt(p.preco)}</div>
              <button onclick="event.stopPropagation();adicionarRapido('${escapeAttr(p.id)}')">Adicionar</button>
            </div>
          </div>
        </div>`).join('')}
    </div>
  </div>`;
}

function renderProdutos(cats) {
  const wrap = document.getElementById('produtos-wrap');
  if (!cats.length) { wrap.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted)">Nenhum produto encontrado</div>'; return; }
  wrap.innerHTML = cats.map(c => `
    <div class="cat-section" id="cat-${escapeAttr(c.id)}">
      <div class="cat-section-title">
        <span>${escapeHtml(c.icone||'')}</span>
        <span>${escapeHtml(c.nome)}</span>
      </div>
      ${(c.produtos||[]).map((p, idx) => `
        <div class="produto-card ${p.destaque ? 'is-featured' : ''}" onclick="${p.disponivel!==false?`abrirProduto('${escapeAttr(p.id)}')`:''}" style="${p.disponivel===false?'opacity:.4':''}">
          <div class="produto-img-wrap">
            <img class="produto-img" src="${safeUrl(imageForProduct(p), FOOD_IMAGES.default)}" alt="${escapeAttr(p.nome)}" loading="lazy" onerror="this.src='${FOOD_IMAGES.default}'">
            ${p.destaque ? '<span class="produto-badge">Destaque</span>' : idx < 2 && p.disponivel !== false ? '<span class="produto-badge subtle">Sugestão</span>' : ''}
          </div>
          <div class="produto-info">
            <div class="produto-nome">${escapeHtml(p.nome)}</div>
            ${p.descricao?`<div class="produto-desc">${escapeHtml(p.descricao)}</div>`:''}
            <div class="produto-meta">
              <span class="${p.disponivel===false?'produto-ind':'produto-preco'}">${p.disponivel===false?'Indisponível':'R$ '+fmt(p.preco)}</span>
              ${p.tempo_preparo_minutos ? `<span class="produto-time">${p.tempo_preparo_minutos} min</span>` : ''}
            </div>
          </div>
          ${p.disponivel!==false?`<button class="produto-add" aria-label="Adicionar ${escapeAttr(p.nome)}" onclick="event.stopPropagation();adicionarRapido('${escapeAttr(p.id)}')"><span>+</span></button>`:''}
        </div>`).join('')}
    </div>`).join('');
}

function buscar(q) {
  const clear = document.getElementById('search-clear');
  clear.classList.toggle('show', q.length > 0);
  document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
  categoriaAtual = null;
  if (!q.trim()) {
    document.querySelector('.cat-pill')?.classList.add('active');
    renderProdutos(categorias); return;
  }
  const t = q.toLowerCase();
  const res = todosProdutos.filter(p => p.disponivel!==false &&
    ((p.nome||'').toLowerCase().includes(t) || (p.descricao||'').toLowerCase().includes(t)));
  renderProdutos([{ id:'s', nome:`Resultados (${res.length})`, icone:'🔍', produtos: res }]);
  document.getElementById('produtos-wrap').scrollIntoView({ behavior:'smooth', block:'start' });
}

function limparBusca() {
  document.getElementById('search-input').value = '';
  document.getElementById('search-clear').classList.remove('show');
  document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
  document.querySelector('.cat-pill')?.classList.add('active');
  renderProdutos(categorias);
}

function scrollParaProdutos() {
  document.getElementById('produtos-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── PRODUTO MODAL ───────────────────────────────────── */
function abrirProduto(id) {
  prodAtual = todosProdutos.find(p => p.id === id);
  if (!prodAtual) return;
  modsSelecionadas = {};
  document.getElementById('modal-qty').textContent = '1';
  document.getElementById('modal-nome').textContent = prodAtual.nome;
  document.getElementById('modal-desc').textContent = prodAtual.descricao || '';
  document.getElementById('modal-preco').textContent = 'R$ ' + fmt(prodAtual.preco);
  document.getElementById('modal-total').textContent = fmt(prodAtual.preco);
  const obsEl = document.getElementById('modal-obs');
  obsEl.value = '';
  obsEl.style.display = RESTAURANT.settings?.allow_customer_notes === false ? 'none' : 'block';

  const imgEl = document.getElementById('modal-produto-img');
  imgEl.innerHTML = `<img src="${safeUrl(imageForProduct(prodAtual), FOOD_IMAGES.default)}" alt="${escapeAttr(prodAtual.nome)}" style="width:100%;height:100%;object-fit:cover;">`;

  const ings = prodAtual.ings || [];
  document.getElementById('modal-ings').innerHTML = ings.length ? `
    <div class="modal-section-title" style="margin-top:16px;">Ingredientes</div>
    ${ings.map((ing, idx) => `
      <div class="mod-item" onclick="toggleModIndex(${idx})">
        <span>${escapeHtml(ing)}</span>
        <div class="mod-check checked" id="mod-${escapeAttr(ing.replace(/\s/g,'-'))}">✓</div>
      </div>`).join('')}` : '';

  document.getElementById('modal-produto').classList.add('show');
}

function toggleModIndex(idx) {
  const nome = (prodAtual?.ings || [])[idx];
  if (nome) toggleMod(nome);
}

function toggleMod(nome) {
  modsSelecionadas[nome] = !modsSelecionadas[nome];
  const el = document.getElementById('mod-' + nome.replace(/\s/g, '-'));
  if (el) {
    if (modsSelecionadas[nome]) { el.classList.remove('checked'); el.textContent = ''; }
    else { el.classList.add('checked'); el.textContent = '✓'; }
  }
}

function mudarQty(delta) {
  const el  = document.getElementById('modal-qty');
  const qty = Math.max(1, parseInt(el.textContent) + delta);
  el.textContent = qty;
  document.getElementById('modal-total').textContent = fmt(prodAtual.preco * qty);
}

function adicionarAoCarrinho() {
  const qty  = parseInt(document.getElementById('modal-qty').textContent);
  const obs  = document.getElementById('modal-obs').value.trim();
  const ings = Object.entries(modsSelecionadas).filter(([,r]) => r).map(([n]) => n);
  carrinho.push({
    produto_id:      prodAtual.id,
    nome_produto:    prodAtual.nome,
    preco_unitario:  prodAtual.preco,
    quantidade:      qty,
    subtotal:        prodAtual.preco * qty,
    observacao:      obs || null,
    ingredientes:    ings.map(n => ({ nome_ingrediente: n, acao: 'remover' })),
  });
  fecharModal('modal-produto');
  atualizarFAB();
  showToast(`${qty}× ${prodAtual.nome} adicionado`, 'success');
}

function adicionarRapido(id) {
  const p = todosProdutos.find(x => x.id === id);
  if (!p) return;
  carrinho.push({ produto_id:p.id, nome_produto:p.nome, preco_unitario:p.preco, quantidade:1, subtotal:p.preco, observacao:null, ingredientes:[] });
  atualizarFAB();
  showToast(`${p.nome} adicionado`, 'success');
}

function atualizarFAB() {
  const total = carrinho.reduce((a, i) => a + i.quantidade, 0);
  const valor = carrinho.reduce((a, i) => a + i.subtotal, 0);
  const fab   = document.getElementById('cart-fab');
  document.getElementById('cart-count').textContent = total;
  fab.childNodes[0].textContent = total > 0 ? `Ver carrinho · R$ ${fmt(valor)} ` : '🛒 Ver carrinho ';
  fab.classList.toggle('show', total > 0);
}

/* ── CARRINHO ────────────────────────────────────────── */
function abrirCarrinho() {
  const total = carrinho.reduce((a, i) => a + i.subtotal, 0);
  document.getElementById('carrinho-itens').innerHTML = carrinho.map((it, idx) => `
    <div class="carrinho-item">
      <div style="flex:1">
        <div style="font-weight:500">${it.quantidade}× ${escapeHtml(it.nome_produto)}</div>
        ${it.ingredientes?.length ? `<div style="font-size:12px;color:var(--muted)">Sem: ${escapeHtml(it.ingredientes.map(i=>i.nome_ingrediente).join(', '))}</div>` : ''}
        ${it.observacao ? `<div style="font-size:12px;color:var(--muted)">${escapeHtml(it.observacao)}</div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:14px;font-weight:600;color:var(--color-primary)">R$ ${fmt(it.subtotal)}</span>
        <button onclick="removerItem(${idx})" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;">✕</button>
      </div>
    </div>`).join('');
  document.getElementById('carrinho-total-val').textContent = 'R$ ' + fmt(total);
  renderSugestoesCarrinho();
  document.getElementById('obs-geral').value = '';
  document.getElementById('obs-geral').style.display = RESTAURANT.settings?.allow_customer_notes === false ? 'none' : 'block';
  document.getElementById('modal-carrinho').classList.add('show');
}

function renderSugestoesCarrinho() {
  const wrap = document.getElementById('sugestoes-wrap');
  if (!wrap) return;
  const ids = new Set(carrinho.map(i => i.produto_id));
  const sugestoes = todosProdutos
    .filter(p => p.disponivel !== false && !ids.has(p.id))
    .sort((a, b) => Number(b.destaque === true) - Number(a.destaque === true) || Number(a.preco) - Number(b.preco))
    .slice(0, 3);
  wrap.innerHTML = sugestoes.length ? `
    <div class="upsell-box">
      <div class="modal-section-title">Combina com seu pedido</div>
      ${sugestoes.map(p => `
        <button class="upsell-item" onclick="adicionarRapido('${escapeAttr(p.id)}'); abrirCarrinho();">
          <span>${escapeHtml(p.nome)}</span><strong>R$ ${fmt(p.preco)}</strong>
        </button>`).join('')}
    </div>` : '';
}

function removerItem(idx) {
  carrinho.splice(idx, 1);
  if (!carrinho.length) { fecharModal('modal-carrinho'); atualizarFAB(); return; }
  abrirCarrinho();
  atualizarFAB();
}

async function enviarPedido() {
  if (!carrinho.length) return;
  const btn   = document.querySelector('.btn-enviar');
  const obsG  = document.getElementById('obs-geral').value.trim();
  const total = carrinho.reduce((a, i) => a + i.subtotal, 0);
  btn.disabled = true; btn.textContent = 'Enviando...';
  try {
    const slug = getCurrentRestaurantSlug();
    const resp = await apiPublic('POST', `/api/public/restaurants/${slug}/orders`, {
      restaurant_id:     RESTAURANT.id,
      mesa_id:           MESA.id,
      sessao_mesa_id:    SESSAO_ID,
      subtotal:          total,
      total:             total,
      observacao_geral:  obsG || null,
      itens:             carrinho,
    });
    carrinho = [];
    fecharModal('modal-carrinho');
    atualizarFAB();
    document.getElementById('sucesso-overlay').classList.add('show');
    setTimeout(verConta, 900);
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '✓ Enviar pedido';
  }
}

function fecharSucesso() {
  document.getElementById('sucesso-overlay').classList.remove('show');
}

/* ── CONTA ───────────────────────────────────────────── */
async function verConta() {
  document.getElementById('modal-conta').classList.add('show');
  document.getElementById('conta-conteudo').innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted)">Carregando...</div>';
  try {
    const slug = getCurrentRestaurantSlug();
    const data = await apiPublic('GET', `/api/public/restaurants/${slug}/sessions/${SESSAO_ID}/bill`);
    const pedidos = data.pedidos || [];
    const total   = Number(data.total_consumido ?? pedidos.reduce((a, p) => a + Number(p.total), 0));
    const taxa    = Number(data.taxa_servico || 0);
    const totalFinal = Number(data.total_com_taxa ?? (total + taxa));
    const settings = data.settings || {};

    if (data.sessao_status === 'fechada') {
      document.getElementById('conta-conteudo').innerHTML = `
        <div style="text-align:center;padding:32px;"><div style="font-size:48px;margin-bottom:12px">✅</div>
        <div style="font-size:18px;font-weight:700">Conta fechada</div>
        <div style="color:var(--muted);margin-top:8px">Obrigado pela visita!</div>
        <button class="btn-add-cart" style="margin-top:18px" onclick="abrirFeedback()">Avaliar atendimento</button></div>`;
      return;
    }

    document.getElementById('conta-conteudo').innerHTML = `
      ${pedidos.map(p => `
        <div class="conta-pedido">
          <div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:4px;">
            <div style="font-size:12px;color:var(--muted);">Pedido #${p.numero}</div>
            <span class="pedido-status-cliente ${p.status}">${statusCliente(p.status)}</span>
          </div>
          ${(p.itens||[]).map(it => `
            <div class="conta-item">
              <span>${it.quantidade}× ${escapeHtml(it.nome_produto)}</span>
              <span style="font-family:monospace;font-weight:600">R$ ${fmt(it.subtotal)}</span>
            </div>`).join('')}
        </div>`).join('')}
      <div class="conta-total">
        <span>Subtotal</span>
        <span style="color:var(--color-primary)">R$ ${fmt(total)}</span>
      </div>
      ${taxa ? `<div class="conta-item"><span>Taxa de serviço</span><span>R$ ${fmt(taxa)}</span></div>
      <div class="conta-total"><span>Total</span><span style="color:var(--color-primary)">R$ ${fmt(totalFinal)}</span></div>` : ''}
      <div style="font-size:12px;color:var(--muted);line-height:1.5;margin-top:8px">
        Pagamento: ${[
          settings.accept_pix !== false ? 'Pix' : '',
          settings.accept_card !== false ? 'cartão' : '',
          settings.accept_cash !== false ? 'dinheiro' : '',
        ].filter(Boolean).join(', ') || 'consulte o atendimento'}
      </div>
      ${settings.allow_table_close_request ? `
        <div style="margin-top:8px;font-size:13px;color:var(--muted);text-align:center">
          <button class="account-btn" onclick="enviarChamado('conta')">Pedir fechamento da conta</button>
        </div>` : ''}`;
  } catch (e) {
    document.getElementById('conta-conteudo').innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted)">Erro ao carregar conta.</div>';
  }
}

function statusCliente(s) {
  return {pendente:'Recebido',confirmado:'Confirmado',em_preparo:'Em preparo',pronto:'Pronto',entregue:'Entregue',cancelado:'Cancelado'}[s] || s || 'Recebido';
}

function mesaTokenAtual() {
  const match = window.location.pathname.match(/\/mesa\/([^\/]+)/);
  return match ? match[1] : new URLSearchParams(window.location.search).get('mesa');
}

async function enviarChamado(tipo) {
  try {
    const slug = getCurrentRestaurantSlug();
    const token = mesaTokenAtual();
    await apiPublic('POST', `/api/public/restaurants/${slug}/tables/${token}/call`, {
      tipo,
      mensagem: tipo === 'problema' ? 'Cliente informou um problema na mesa' : null,
    });
    showToast(tipo === 'conta' ? 'Conta solicitada ao atendimento' : 'Garçom chamado', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function abrirFeedback() {
  setNota(5);
  document.getElementById('feedback-comentario').value = '';
  document.getElementById('modal-feedback').classList.add('show');
}

function setNota(n) {
  notaFeedback = n;
  document.querySelectorAll('#rating-row button').forEach((b, idx) => b.classList.toggle('active', idx < n));
}

async function enviarFeedback() {
  try {
    const slug = getCurrentRestaurantSlug();
    const token = mesaTokenAtual();
    await apiPublic('POST', `/api/public/restaurants/${slug}/tables/${token}/feedback`, {
      nota: notaFeedback,
      comentario: document.getElementById('feedback-comentario').value.trim() || null,
      sessao_mesa_id: SESSAO_ID,
    });
    fecharModal('modal-feedback');
    showToast('Obrigado pela avaliação', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function iniciarPollingConta() {
  async function verificar() {
    if (!SESSAO_ID) return;
    try {
      const slug = getCurrentRestaurantSlug();
      const data = await apiPublic('GET', `/api/public/restaurants/${slug}/sessions/${SESSAO_ID}/bill`);
      if (data.sessao_status === 'fechada') {
        clearTimeout(pollingConta);
        mostrarContaFechada();
        return;
      }
    } catch(e) {}
    pollingConta = setTimeout(verificar, window.SAAS_CONFIG.POLL_CLIENTE);
  }
  pollingConta = setTimeout(verificar, window.SAAS_CONFIG.POLL_CLIENTE);
}

function mostrarContaFechada() {
  document.getElementById('cart-fab').classList.remove('show');
  showToast('✅ Conta fechada pelo caixa. Obrigado!', 'success');
  const btn = document.querySelector('.btn-enviar');
  if (btn) btn.disabled = true;
}

/* ── UTILS ───────────────────────────────────────────── */
function fmt(n) { return Number(n).toFixed(2).replace('.', ','); }

function imageForProduct(produto) {
  if (produto?.foto_url) return produto.foto_url;
  const n = (produto?.nome || '').toLowerCase();
  const d = (produto?.descricao || '').toLowerCase();
  const text = `${n} ${d}`;
  if (text.includes('pizza') || text.includes('margherita') || text.includes('calabresa')) return FOOD_IMAGES.pizza;
  if (text.includes('burguer') || text.includes('burger') || text.includes('smash') || text.includes('hambur')) return FOOD_IMAGES.burger;
  if (text.includes('batata') || text.includes('frita')) return FOOD_IMAGES.fries;
  if (text.includes('frango') || text.includes('chicken')) return FOOD_IMAGES.chicken;
  if (text.includes('suco') || text.includes('laranja') || text.includes('limão') || text.includes('limao')) return FOOD_IMAGES.juice;
  if (text.includes('refri') || text.includes('coca') || text.includes('bebida') || text.includes('drink')) return FOOD_IMAGES.drink;
  if (text.includes('brownie') || text.includes('sobr') || text.includes('doce') || text.includes('tiramisu')) return FOOD_IMAGES.dessert;
  return FOOD_IMAGES.default;
}

function emoji(nome) {
  const n = (nome||'').toLowerCase();
  if (n.includes('pizza'))                return '🍕';
  if (n.includes('burguer')||n.includes('smash')||n.includes('hambur')) return '🍔';
  if (n.includes('frango')||n.includes('chicken')) return '🍗';
  if (n.includes('batata')||n.includes('frita'))   return '🍟';
  if (n.includes('shake')||n.includes('milk'))     return '🥤';
  if (n.includes('suco'))                return '🍊';
  if (n.includes('refri')||n.includes('coca'))     return '🥃';
  if (n.includes('brownie')||n.includes('sobr'))   return '🍫';
  if (n.includes('combo'))               return '🎁';
  return '🍽️';
}

function showToast(msg, tipo = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (tipo ? ' ' + tipo : '') + ' show';
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3000);
}

function fecharModal(id) { document.getElementById(id).classList.remove('show'); }
document.querySelectorAll('.modal-bg').forEach(b =>
  b.addEventListener('click', e => { if (e.target === b) b.classList.remove('show'); }));

init();

