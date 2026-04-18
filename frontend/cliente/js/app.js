/* ════════════════════════════════════════════════
   CONFIGURAÇÃO — ajustar conforme ambiente
════════════════════════════════════════════════ */
const SUPABASE_URL  = 'https://lhrfemeunswviwzdpppp.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxocmZlbWV1bnN3dml3emRwcHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDUzMjYsImV4cCI6MjA4ODY4MTMyNn0.JsHPjGJCCAePfCicpvP4Fk-UWTwW8ve-SXjjLQN2mb4';
// Edge Function — roda na nuvem, acessível de qualquer celular
const EDGE = 'https://lhrfemeunswviwzdpppp.supabase.co/functions/v1/pedidos';
const API  = 'http://localhost:8001'; // FastAPI — fallback local (cozinha/admin)

/* Chamada ao Supabase REST direto — sem depender da FastAPI para leitura */
async function supa(path, opts={}) {
  const r = await fetch(SUPABASE_URL + path, {
    ...opts,
    headers: {
      'apikey': SUPABASE_ANON,
      'Authorization': 'Bearer ' + SUPABASE_ANON,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(opts.headers||{})
    }
  });
  if (!r.ok) { const e = await r.text(); throw new Error(e); }
  return r.json();
}

/* Chamar RPC do Supabase (funções SQL) */
async function rpc(fn, params={}) {
  return supa('/rest/v1/rpc/' + fn, {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

/* ════════════════════════════════════════════════
   ESTADO GLOBAL
════════════════════════════════════════════════ */
let mesaId         = null;
let mesaNum        = null;
let sessaoId       = null;
let carrinho       = [];
let categorias     = [];
let todosProdutos  = [];
let prodAtual      = null;
let qtyAtual       = 1;
let ingRemovidos   = [];
let totalConsumido = 0;
let pollingTimer   = null;
let prodMap        = {};
let ultimosPedidosStatus = {}; // { pedidoId: status } — detecta mudança para notificar
let pedidoRecemFeito = null;   // pedido recém confirmado — aparece na conta imediatamente

/* ════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════ */
async function init() {
  carregarCarrinhoStorage(); // restaura carrinho salvo
  const p     = new URLSearchParams(window.location.search);
  const token = p.get('mesa') || p.get('token');
  if (token) await validarMesa(token);
  else { document.getElementById('mesa-num').textContent = 'Demo'; mesaNum = 'Demo'; }

  // Botão "Minha conta" visível desde o início — sempre acessível
  document.getElementById('conta-fab').classList.add('show');

  await carregarCardapio();

  if (mesaId && !mesaId.startsWith('demo')) {
    await abrirOuRecuperarSessao();
    iniciarPolling();
  }
}

/* ════════════════════════════════════════════════
   MESA E SESSÃO
════════════════════════════════════════════════ */
async function validarMesa(token) {
  try {
    // Edge Function — fonte primária, funciona de qualquer celular
    const r = await fetch(`${EDGE}/mesa/${token}`);
    if (!r.ok) throw new Error('edge');
    const d = await r.json();
    mesaId  = d.mesa.id;
    mesaNum = d.mesa.numero;
    document.getElementById('mesa-num').textContent = mesaNum;
    if (d.mesa.status === 'reservada') {
      showToast('⚠️ Esta mesa está reservada. Fale com o atendente.');
      document.getElementById('confirmar-btn') && (document.getElementById('confirmar-btn').disabled = true);
    }
  } catch(e) {
    // Fallback: Supabase REST direto
    try {
      const rows = await supa(`/rest/v1/mesas?qr_code_token=eq.${token}&select=id,numero,status`);
      if (rows && rows.length) {
        mesaId  = rows[0].id;
        mesaNum = rows[0].numero;
        document.getElementById('mesa-num').textContent = mesaNum;
      } else throw new Error('not found');
    } catch(e2) {
      // Extrai número do token (últimos chars) ou usa 1 como fallback
      const numFallback = token ? token.slice(0,8) : '?';
      document.getElementById('mesa-num').textContent = '?';
      mesaId = 'demo-' + token;
      mesaNum = '?'; // Explícito: sem conexão, número desconhecido
    }
  }
}

async function abrirOuRecuperarSessao() {
  try {
    // Edge Function — POST /pedidos/sessao/:mesa_id
    const r = await fetch(`${EDGE}/sessao/${mesaId}`, { method: 'POST' });
    if (!r.ok) throw new Error('edge');
    const d = await r.json();
    sessaoId       = d.sessao.id;
    totalConsumido = Number(d.sessao.total_consumido) || 0;
    atualizarStatConsumido();
  } catch(e) {
    // Fallback: Supabase RPC direto
    try {
      const sessao = await rpc('get_or_create_sessao', { p_mesa_id: mesaId });
      if (sessao) { sessaoId = sessao.id; totalConsumido = Number(sessao.total_consumido)||0; atualizarStatConsumido(); }
    } catch(e2) { sessaoId = 'demo-sessao'; }
  }
}

/* ════════════════════════════════════════════════
   CARDÁPIO — lê direto do Supabase via RPC
════════════════════════════════════════════════ */
async function carregarCardapio() {
  document.getElementById('produtos-wrap').innerHTML =
    '<div style="padding:20px;display:flex;flex-direction:column;gap:12px;">' +
    [1,2,3].map(()=>'<div class="skeleton" style="height:100px;border-radius:20px;"></div>').join('') + '</div>';
  try {
    // Tenta via Supabase RPC — não depende da FastAPI
    // Edge Function — GET /pedidos/cardapio
    const r = await fetch(`${EDGE}/cardapio`);
    if (!r.ok) throw new Error('edge');
    const d = await r.json();
    categorias = d.categorias || [];
  } catch(e) {
    try {
      // Fallback: FastAPI
      const r = await fetch(`${API}/api/cardapio/`);
      const d = await r.json();
      categorias = d.categorias || [];
    } catch(e2) {
      // Demo hardcoded — funciona sem API nem Supabase
      categorias = getDemoCardapio();
    }
  }
  // Normalizar: get_cardapio retorna JSON escalar, não array de rows
  if (categorias && !Array.isArray(categorias)) {
    categorias = categorias; // já é o valor certo
  }
  todosProdutos = (categorias||[]).flatMap(c => (c.produtos||[]).map(p => ({...p, _cat:c.nome})));
  renderCats();
  renderDestaques();
  renderProdutos(categorias);
  if ((categorias||[]).some(c => c.nome.toLowerCase().includes('combo')))
    document.getElementById('combo-banner').classList.add('show');
}

function getDemoCardapio() {
  return [
    {id:'1',nome:'Lanches',icone:'🍔',ordem:1,produtos:[
      {id:'p1',nome:'X-Burguer Classic',descricao:'Pão brioche artesanal, blend 180g, queijo cheddar, alface americana e tomate fresco.',preco:24.90,tempo_preparo_minutos:12,destaque:true,disponivel:true,foto_url:'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop',ings:['Alface','Tomate','Cebola','Molho especial']},
      {id:'p2',nome:'X-Bacon Smash',descricao:'Dois smash burgers 90g, bacon crocante, queijo americano duplo e molho barbecue defumado.',preco:34.90,tempo_preparo_minutos:15,destaque:true,disponivel:true,foto_url:'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&h=300&fit=crop',ings:['Bacon','Queijo duplo','Molho BBQ','Picles']},
      {id:'p3',nome:'Crispy Chicken',descricao:'Frango empanado crocante, maionese de alho, picles e coleslaw na ciabatta tostada.',preco:29.90,tempo_preparo_minutos:14,destaque:false,disponivel:true,foto_url:'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&h=300&fit=crop',ings:['Picles','Maionese de alho','Coleslaw']},
      {id:'p4',nome:'Veggie Smash',descricao:'Hambúrguer de grão-de-bico e beterraba, queijo vegano, rúcula e molho tahini.',preco:27.90,tempo_preparo_minutos:12,destaque:false,disponivel:true,foto_url:'https://images.unsplash.com/photo-1520072959219-c595dc870360?w=400&h=300&fit=crop',ings:['Rúcula','Tomate','Molho tahini']},
    ]},
    {id:'2',nome:'Porções',icone:'🍟',ordem:3,produtos:[
      {id:'p5',nome:'Batata Rústica',descricao:'Batata em meia-lua, temperada com alecrim e páprica defumada.',preco:18.00,tempo_preparo_minutos:10,destaque:false,disponivel:true,foto_url:'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop',ings:[]},
      {id:'p6',nome:'Onion Rings',descricao:'Anéis de cebola empanados na farinha panko com molho ranch caseiro.',preco:16.00,tempo_preparo_minutos:8,destaque:false,disponivel:true,foto_url:'https://images.unsplash.com/photo-1639024471283-03518883512d?w=400&h=300&fit=crop',ings:[]},
    ]},
    {id:'3',nome:'Bebidas',icone:'🥤',ordem:2,produtos:[
      {id:'p7',nome:'Milk Shake',descricao:'Chocolate, morango ou baunilha. Cremoso e denso, feito na hora.',preco:19.90,tempo_preparo_minutos:5,destaque:true,disponivel:true,foto_url:'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&h=300&fit=crop',ings:[]},
      {id:'p8',nome:'Suco Natural',descricao:'Laranja, limão com gengibre ou maracujá — 400ml feito na hora.',preco:12.00,tempo_preparo_minutos:4,destaque:false,disponivel:true,foto_url:'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&h=300&fit=crop',ings:[]},
      {id:'p9',nome:'Refrigerante',descricao:'Coca-Cola, Guaraná ou Sprite — lata 350ml bem gelada.',preco:7.00,tempo_preparo_minutos:1,destaque:false,disponivel:true,foto_url:'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&h=300&fit=crop',ings:[]},
    ]},
    {id:'4',nome:'Combos',icone:'🎁',ordem:5,produtos:[
      {id:'p10',nome:'Combo Classic',descricao:'X-Burguer Classic + Batata Rústica + Refrigerante. Economize R$6,90!',preco:39.90,tempo_preparo_minutos:15,destaque:true,disponivel:true,foto_url:'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=400&h=300&fit=crop',ings:[]},
      {id:'p11',nome:'Combo Bacon',descricao:'X-Bacon Smash + Onion Rings + Milk Shake. Economize R$9,90!',preco:54.90,tempo_preparo_minutos:18,destaque:true,disponivel:true,foto_url:'https://images.unsplash.com/photo-1561758033-7e924f619b47?w=400&h=300&fit=crop',ings:[]},
    ]},
    {id:'5',nome:'Sobremesas',icone:'🍦',ordem:4,produtos:[
      {id:'p12',nome:'Brownie Quente',descricao:'Brownie de chocolate belga com sorvete de baunilha e calda de caramelo.',preco:18.90,tempo_preparo_minutos:8,destaque:false,disponivel:true,foto_url:'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=400&h=300&fit=crop',ings:[]},
    ]},
  ];
}

/* ════════════════════════════════════════════════
   RENDER CARDÁPIO
════════════════════════════════════════════════ */
function renderCats() {
  const el = document.getElementById('cats');
  el.innerHTML = '<button class="cat-pill active" onclick="filtrarCat(this,null)">Tudo</button>';
  (categorias || []).forEach(c => {
    el.innerHTML += `<button class="cat-pill" onclick="filtrarCat(this,'${c.id}')">${c.icone || ''} ${c.nome}</button>`;
  });
}

function filtrarCat(btn, id) {
  document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderProdutos(id ? (categorias||[]).filter(c => c.id === id) : categorias);
  // Rola suavemente até os produtos
  const wrap = document.getElementById('produtos-wrap');
  if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function filtrarPorCombo() {
  const b = Array.from(document.querySelectorAll('.cat-pill')).find(b => b.textContent.toLowerCase().includes('combo'));
  if (b) b.click();
}

function renderDestaques() {
  const dest = todosProdutos.filter(p => p.destaque && p.disponivel !== false);
  if (!dest.length) return;
  document.getElementById('dest-section').style.display = 'block';
  const el = document.getElementById('destaques');
  el.innerHTML = dest.map(p => {
    prodMap[p.id] = p;
    return '<div class="destaque-card" data-pid="' + p.id + '">' +
      '<div class="destaque-badge">⭐ Destaque</div>' +
      '<div class="destaque-img">' + imgEl(p) + '</div>' +
      '<div class="destaque-body"><div class="destaque-nome">' + p.nome + '</div>' +
      '<div class="destaque-preco">R$ ' + fmt(p.preco) + '</div></div></div>';
  }).join('');
  el.onclick = e => { const c = e.target.closest('.destaque-card'); if (c) abrirProdById(c.dataset.pid); };
}

function renderProdutos(cats) {
  let html = '';
  (cats||[]).forEach(cat => {
    const prods = (cat.produtos || []);
    if (!prods.length) return;
    html += '<div class="prod-section"><div class="prod-section-title"><span>' + (cat.icone||'🍽') + '</span>' + cat.nome + '</div><div class="prod-list">';
    prods.forEach(p => {
      prodMap[p.id] = p;
      const indisponivel = p.disponivel === false;
      html += '<div class="prod-card' + (indisponivel?' indisponivel':'') + '" data-pid="' + p.id + '">' +
        '<div class="prod-card-img">' + imgEl(p) + '</div>' +
        '<div class="prod-card-body">' +
          '<div class="prod-card-nome">' + p.nome + '</div>' +
          '<div class="prod-card-desc">' + (p.descricao||'') + '</div>' +
          '<div class="prod-card-footer">' +
            '<div><div class="prod-card-preco">R$ ' + fmt(p.preco) + '</div>' +
            (indisponivel
              ? '<div class="unavailable-tag">INDISPONÍVEL</div>'
              : '<div class="prod-card-meta">⏱ ' + (p.tempo_preparo_minutos||10) + 'min</div>') +
            '</div>' +
            (!indisponivel ? '<button class="add-ring" data-pid="' + p.id + '">+</button>' : '') +
          '</div>' +
        '</div></div>';
    });
    html += '</div></div>';
  });
  const wrap = document.getElementById('produtos-wrap');
  wrap.innerHTML = html || '<div style="padding:40px;text-align:center;color:var(--muted)">Nenhum produto encontrado</div>';
  wrap.onclick = e => {
    const btn  = e.target.closest('.add-ring');
    const card = e.target.closest('.prod-card:not(.indisponivel)');
    if (btn)  { e.stopPropagation(); abrirProdById(btn.dataset.pid); return; }
    if (card) abrirProdById(card.dataset.pid);
  };
}

function buscar(q) {
  const clearBtn = document.getElementById('search-clear');
  clearBtn.classList.toggle('show', q.length > 0);
  // Desativar pills de categoria durante a busca
  document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));

  if (!q.trim()) {
    // Sem busca — reativar pill Tudo e mostrar tudo
    const tudo = document.querySelector('.cat-pill');
    if (tudo) tudo.classList.add('active');
    renderProdutos(categorias);
    return;
  }
  const t = q.toLowerCase();
  const res = todosProdutos.filter(p =>
    p.disponivel !== false && (
      p.nome.toLowerCase().includes(t) ||
      (p.descricao || '').toLowerCase().includes(t)
    )
  );
  renderProdutos([{ id: 's', nome: `Resultados para "${q}" (${res.length})`, icone: '🔍', produtos: res }]);
  // Scroll até os resultados
  const wrap = document.getElementById('produtos-wrap');
  if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function limparBusca() {
  document.getElementById('search-input').value = '';
  document.getElementById('search-clear').classList.remove('show');
  document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
  const tudo = document.querySelector('.cat-pill');
  if (tudo) tudo.classList.add('active');
  renderProdutos(categorias);
}

/* ════════════════════════════════════════════════
   MODAL PRODUTO
════════════════════════════════════════════════ */
function abrirProdById(id) { const p = prodMap[id]; if (p) abrirProd(p); }

function abrirProd(p) {
  prodAtual = p; qtyAtual = 1; ingRemovidos = [];
  document.getElementById('modal-nome').textContent  = p.nome;
  document.getElementById('modal-desc').textContent  = p.descricao || '';
  document.getElementById('modal-preco').textContent = 'R$ ' + fmt(p.preco);
  document.getElementById('modal-obs').value         = '';
  document.getElementById('modal-qty').textContent   = 1;
  const mi = document.getElementById('modal-img');
  mi.innerHTML = p.foto_url ? `<img src="${p.foto_url}" onerror="this.parentElement.innerHTML='${emoji(p.nome)}'">` : emoji(p.nome);
  mi.style.fontSize = p.foto_url ? '' : '96px';
  const ings = p.ings || [];
  const box  = document.getElementById('ing-box');
  if (ings.length) {
    box.style.display = 'block';
    document.getElementById('ing-desc-text').textContent = 'Contém: ' + ings.join(', ') + '.';
    document.getElementById('ing-list').innerHTML = ings.map(i =>
      `<button class="ing-chip" onclick="toggleIng(this,'${i}')">${i}</button>`
    ).join('');
  } else { box.style.display = 'none'; }
  atualizarSub();
  document.getElementById('prod-overlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function fecharProd() { document.getElementById('prod-overlay').classList.remove('show'); document.body.style.overflow = ''; }
function toggleIng(btn, nome) {
  const i = ingRemovidos.indexOf(nome);
  if (i >= 0) { ingRemovidos.splice(i,1); btn.classList.remove('removido'); }
  else         { ingRemovidos.push(nome);  btn.classList.add('removido'); }
}
function chQty(d) { qtyAtual = Math.max(1, qtyAtual+d); document.getElementById('modal-qty').textContent = qtyAtual; atualizarSub(); }
function atualizarSub() { if (!prodAtual) return; document.getElementById('modal-sub').textContent = 'R$ '+fmt(Number(prodAtual.preco)*qtyAtual); }

function addCart() {
  carrinho.push({
    produto:    prodAtual,
    quantidade: qtyAtual,
    observacao: document.getElementById('modal-obs').value.trim(),
    ingRemovidos: [...ingRemovidos],
    subtotal:   Number(prodAtual.preco) * qtyAtual
  });
  salvarCarrinhoStorage();
  fecharProd();
  atualizarUI();
  showToast(prodAtual.nome + ' adicionado! 🎉');
  // Sugestão de bebida se adicionou lanche sem bebida
  setTimeout(() => {
    const temL = carrinho.some(i => i.produto._cat === 'Lanches');
    const temB = carrinho.some(i => i.produto._cat === 'Bebidas');
    if (temL && !temB) {
      const beb = todosProdutos.find(p => p._cat === 'Bebidas' && p.disponivel !== false);
      if (beb) showToast('Que tal uma ' + beb.nome + '? 🥤');
    }
  }, 2000);
}

/* ════════════════════════════════════════════════
   CARRINHO
════════════════════════════════════════════════ */
function atualizarUI() {
  const total = carrinho.reduce((a,i) => a + i.subtotal, 0);
  const qty   = carrinho.reduce((a,i) => a + i.quantidade, 0);
  document.getElementById('fab-qty').textContent    = qty;
  document.getElementById('fab-price').textContent  = 'R$ ' + fmt(total);
  document.getElementById('stat-itens').textContent = qty;
  const maxTempo = carrinho.reduce((a,i) => Math.max(a, i.produto.tempo_preparo_minutos||10), 0);
  document.getElementById('stat-tempo').textContent = qty > 0 ? '~' + maxTempo : '—';
  document.getElementById('cart-fab').className = 'cart-fab' + (qty > 0 ? ' show' : '');
}

function atualizarStatConsumido() {
  document.getElementById('stat-consumido').textContent = 'R$' + fmt(totalConsumido);
}

/* Persistência do carrinho — sobrevive a reload da página */
function salvarCarrinhoStorage() {
  try { sessionStorage.setItem('carrinho_' + (mesaId||'demo'), JSON.stringify(carrinho)); } catch(e) {}
}
function carregarCarrinhoStorage() {
  try {
    const saved = sessionStorage.getItem('carrinho_' + (mesaId||'demo'));
    if (saved) { carrinho = JSON.parse(saved); atualizarUI(); }
  } catch(e) {}
}

function abrirCarrinho() { renderCarrinho(); document.getElementById('cart-overlay').classList.add('show'); document.body.style.overflow = 'hidden'; }
function fecharCarrinho() { document.getElementById('cart-overlay').classList.remove('show'); document.body.style.overflow = ''; }

function renderCarrinho() {
  document.getElementById('erro-rede').classList.remove('show');
  const el = document.getElementById('cart-items');
  if (!carrinho.length) {
    el.innerHTML = '<div class="empty-cart"><div class="empty-icon">🛒</div><p style="color:var(--muted)">Nada por aqui ainda</p></div>';
    document.getElementById('cart-summary').style.display  = 'none';
    document.getElementById('cart-obs-wrap').style.display = 'none';
    document.getElementById('confirmar-btn').disabled      = true;
    return;
  }
  el.innerHTML = carrinho.map((item, i) =>
    '<div class="cart-item">' +
      '<div class="ci-emoji">' + emoji(item.produto.nome) + '</div>' +
      '<div class="ci-info">' +
        '<div class="ci-nome">' + item.produto.nome + '</div>' +
        (item.ingRemovidos.length ? '<div class="ci-mods">✕ Sem: ' + item.ingRemovidos.join(', ') + '</div>' : '') +
        (item.observacao ? '<div class="ci-obs">📝 ' + item.observacao + '</div>' : '') +
        '<div class="ci-bottom">' +
          '<div class="ci-price">R$ ' + fmt(item.subtotal) + '</div>' +
          '<div class="ci-qty">' +
            '<button class="qty-sm" onclick="cartQty(' + i + ',-1)">−</button>' +
            '<div class="qty-sm-n">' + item.quantidade + '</div>' +
            '<button class="qty-sm" onclick="cartQty(' + i + ',1)">+</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<button class="ci-del" onclick="removerItem(' + i + ')" title="Remover">🗑</button>' +
    '</div>'
  ).join('');
  const sub = carrinho.reduce((a,i) => a + i.subtotal, 0);
  document.getElementById('sum-sub').textContent    = 'R$ ' + fmt(sub);
  document.getElementById('sum-total').textContent  = 'R$ ' + fmt(sub);
  document.getElementById('cart-summary').style.display  = 'block';
  document.getElementById('cart-obs-wrap').style.display = 'block';
  document.getElementById('confirmar-btn').disabled      = false;
}

function cartQty(i, d) {
  const n = carrinho[i].quantidade + d;
  if (n <= 0) carrinho.splice(i, 1);
  else { carrinho[i].quantidade = n; carrinho[i].subtotal = Number(carrinho[i].produto.preco) * n; }
  salvarCarrinhoStorage();
  atualizarUI();
  renderCarrinho();
}

function removerItem(i) {
  carrinho.splice(i, 1);
  salvarCarrinhoStorage();
  atualizarUI();
  renderCarrinho();
  showToast('Item removido');
}

/* ════════════════════════════════════════════════
   CONFIRMAR PEDIDO — via Supabase RPC (sem depender da FastAPI)
════════════════════════════════════════════════ */
async function confirmar() {
  if (!carrinho.length) return;
  const btn = document.getElementById('confirmar-btn');
  const txt = document.getElementById('confirmar-txt');
  document.getElementById('erro-rede').classList.remove('show');
  btn.disabled = true;
  txt.textContent = 'Enviando... ⏳';

  const subtotal = carrinho.reduce((a,i) => a + i.subtotal, 0);
  const payload = {
    mesa_id:          (mesaId && !mesaId.startsWith('demo')) ? mesaId : null,
    sessao_mesa_id:   (sessaoId && !sessaoId.startsWith('demo')) ? sessaoId : null,
    sessao_cliente:   'mesa_' + mesaNum,
    subtotal:         subtotal,
    total:            subtotal,
    observacao_geral: document.getElementById('obs-geral').value.trim() || null,
    itens: carrinho.map(i => ({
      produto_id:     i.produto.id.startsWith('p') ? null : i.produto.id, // ids demo são 'p1','p2'...
      nome_produto:   i.produto.nome,
      preco_unitario: Number(i.produto.preco),
      quantidade:     i.quantidade,
      observacao:     i.observacao || null,
      subtotal:       i.subtotal,
      ingredientes:   i.ingRemovidos.map(n => ({ nome_ingrediente: n, acao: 'remover', preco_adicional: 0 }))
    }))
  };

  let pedidoId = null, pedidoNum = null;

  try {
    // Edge Function — POST /pedidos/criar (sem depender da FastAPI ou Supabase RPC)
    const r2 = await fetch(`${EDGE}/criar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r2.ok) { const e = await r2.json(); throw new Error(e.error || 'edge'); }
    const res = await r2.json();
    pedidoId  = res.pedido_id;
    pedidoNum = res.numero;
    totalConsumido += subtotal;
    atualizarStatConsumido();
  } catch(e) {
    try {
      // Fallback: FastAPI
      const r = await fetch(`${API}/api/pedidos/`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({...payload, status:'confirmado', status_pagamento:'aguardando'})
      });
      if (!r.ok) throw new Error('API error');
      const d = await r.json();
      pedidoId  = d.id || d.pedido_id;
      pedidoNum = d.numero;
      totalConsumido += subtotal;
      atualizarStatConsumido();
    } catch(e2) {
      // Falha total — mostra erro com retry
      btn.disabled = false;
      txt.textContent = 'Confirmar Pedido';
      document.getElementById('erro-rede').classList.add('show');
      return;
    }
  }

  // Sucesso — guarda pedido na lista local para aparecer na conta imediatamente
  pedidoRecemFeito = {
    id: pedidoId || 'local-' + Date.now(),
    numero: pedidoNum || '—',
    status: 'pendente',
    created_at: new Date().toISOString(),
    total: subtotal,
    itens: carrinho.map(i => ({
      nome_produto: i.produto.nome,
      quantidade:   i.quantidade,
      subtotal:     i.subtotal,
      observacao:   i.observacao || null,
      ingredientes: i.ingRemovidos.map(n => ({acao:'remover', nome_ingrediente:n}))
    }))
  };
  // Adiciona ao tracking de status para polling detectar mudanças
  if (pedidoId) ultimosPedidosStatus[pedidoId] = 'pendente';

  fecharCarrinho();
  carrinho = [];
  salvarCarrinhoStorage();
  atualizarUI();
  btn.disabled = false;
  txt.textContent = 'Confirmar Pedido';

  // Mostra tela de sucesso
  const mesaLabel = (mesaNum && mesaNum !== '?') ? mesaNum : '?';
  document.getElementById('sucesso-mesa').textContent = 'Mesa ' + mesaLabel;
  // Se não identificou a mesa, mostra aviso
  if (mesaLabel === '?') {
    document.querySelector('.sucesso-card p').textContent = 'Sem conexão com o servidor. Pedido salvo localmente.';
  }
  document.getElementById('sucesso-num').textContent  = pedidoNum ? 'Pedido #' + pedidoNum : '';
  document.getElementById('sucesso-overlay').classList.add('show');

  // Avaliação (se houver pedidos entregues anteriores)
  mostrarAvaliacaoSucesso();
}

function fecharSucesso() {
  document.getElementById('sucesso-overlay').classList.remove('show');
  document.getElementById('conta-fab').classList.add('show');
}

function mostrarAvisoSessaoFechada() {
  // Avisa o cliente que a conta foi fechada pelo garçom
  showToast('✅ Sua conta foi fechada. Obrigado pela visita!');
  // Desabilita o botão de confirmar novos pedidos
  const btn = document.getElementById('confirmar-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Conta encerrada'; }
  // Oculta o FAB do carrinho
  document.getElementById('cart-fab').classList.remove('show');
}

/* ════════════════════════════════════════════════
   AVALIAÇÃO (estrelas — armazena no pedido)
════════════════════════════════════════════════ */
function mostrarAvaliacaoSucesso() {
  // Só mostra avaliação se houver pedido entregue anterior nesta sessão
  const temEntregue = Object.values(ultimosPedidosStatus).some(s => s === 'entregue');
  if (!temEntregue) return;
  const wrap = document.getElementById('aval-wrap');
  wrap.style.display = 'block';
  const stars = document.getElementById('stars');
  stars.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement('button');
    btn.className = 'star-btn';
    btn.textContent = '⭐';
    btn.dataset.v = i;
    btn.onclick = () => {
      document.querySelectorAll('.star-btn').forEach((b,idx) => b.classList.toggle('ativo', idx < i));
      // Salvar avaliação no último pedido entregue
    };
    stars.appendChild(btn);
  }
}

/* ════════════════════════════════════════════════
   CONTA DA MESA
════════════════════════════════════════════════ */
async function abrirConta() {
  document.getElementById('conta-overlay').classList.add('show');
  document.body.style.overflow = 'hidden';
  document.getElementById('conta-title').textContent    = 'Mesa ' + (mesaNum||'—');
  document.getElementById('conta-subtitle').textContent = 'Carregando pedidos...';
  document.getElementById('conta-body').innerHTML = '<div style="padding:40px 0;text-align:center;color:var(--muted);">⏳ Buscando seus pedidos...</div>';
  await carregarConta();
}

function fecharConta() {
  document.getElementById('conta-overlay').classList.remove('show');
  document.body.style.overflow = '';
}

async function carregarConta() {
  let pedidos = [];
  try {
    if (sessaoId && !sessaoId.startsWith('demo')) {
      // Edge Function — GET /pedidos/conta/:sessao_id
      const r = await fetch(`${EDGE}/conta/${sessaoId}`);
      if (!r.ok) throw new Error('edge');
      const d = await r.json();
      pedidos = d.pedidos || [];
      // Verificar se sessão foi encerrada pelo admin durante o uso
      if (d.sessao_status === 'fechada' || d.sessao_status === 'paga') {
        mostrarAvisoSessaoFechada();
      }
    } else {
      throw new Error('demo');
    }
  } catch(e) {
    // Demo
    pedidos = [
      {id:'d1',numero:42,status:'entregue',created_at:new Date(Date.now()-25*60000).toISOString(),total:54.80,
       itens:[{nome_produto:'X-Burguer Classic',quantidade:2,subtotal:49.80,observacao:'',ingredientes:[]},{nome_produto:'Refrigerante',quantidade:2,subtotal:14.00,observacao:'',ingredientes:[]}]},
      {id:'d2',numero:43,status:'em_preparo',created_at:new Date(Date.now()-8*60000).toISOString(),total:34.90,
       itens:[{nome_produto:'X-Bacon Smash',quantidade:1,subtotal:34.90,observacao:'bem passado',ingredientes:[{acao:'remover',nome_ingrediente:'Picles'}]}]},
    ];
  }

  // Injeta pedido recém-feito na lista enquanto o servidor ainda não o retornou
  if (pedidoRecemFeito) {
    const jaExiste = pedidos.some(p => p.id === pedidoRecemFeito.id);
    if (!jaExiste) {
      pedidos = [...pedidos, pedidoRecemFeito];
    } else {
      pedidoRecemFeito = null; // servidor confirmou — remove o local
    }
  }

  // Detectar mudanças de status para notificação "Pronto!"
  pedidos.forEach(p => {
    const anterior = ultimosPedidosStatus[p.id];
    if (anterior && anterior !== 'pronto' && p.status === 'pronto') {
      mostrarNotifPronto(p.numero);
    }
    ultimosPedidosStatus[p.id] = p.status;
  });

  renderConta(pedidos);
}

function renderConta(pedidos) {
  const total = pedidos.filter(p => p.status !== 'cancelado').reduce((a,p) => a + Number(p.total), 0);
  totalConsumido = total;
  atualizarStatConsumido();

  document.getElementById('conta-subtitle').textContent =
    pedidos.length === 0 ? 'Nenhum pedido ainda' :
    pedidos.length + ' pedido' + (pedidos.length > 1 ? 's' : '') + ' • Total R$ ' + fmt(total);

  if (!pedidos.length) {
    document.getElementById('conta-body').innerHTML =
      '<div style="padding:60px 0;text-align:center;">' +
      '<div style="font-size:56px;margin-bottom:12px;">🍽️</div>' +
      '<p style="color:var(--muted);font-size:14px;">Nenhum pedido ainda.<br>Que tal começar agora?</p></div>';
    return;
  }

  const grupos = pedidos.map(p => {
    const hora  = new Date(p.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const label = statusLabel(p.status);
    const itens = (p.itens||[]).map(it => {
      const mods = (it.ingredientes||[]).filter(i => i.acao==='remover');
      return '<div class="pedido-item-row">' +
        '<div class="pir-emoji">' + emoji(it.nome_produto) + '</div>' +
        '<div class="pir-info">' +
          '<div class="pir-nome">' + it.nome_produto + '</div>' +
          (mods.length ? '<div class="pir-mods">✕ Sem: ' + mods.map(i=>i.nome_ingrediente).join(', ') + '</div>' : '') +
          (it.observacao ? '<div class="pir-obs">📝 ' + it.observacao + '</div>' : '') +
        '</div>' +
        '<div class="pir-right">' +
          '<div class="pir-qty">' + it.quantidade + 'x</div>' +
          '<div class="pir-price">R$ ' + fmt(it.subtotal) + '</div>' +
        '</div></div>';
    }).join('');

    return '<div class="pedido-grupo">' +
      '<div class="pedido-grupo-header">' +
        '<div class="pedido-grupo-num">Pedido #' + p.numero +
          '<span class="status-badge ' + p.status + '">' + label + '</span></div>' +
        '<div class="pedido-grupo-hora">' + hora + '</div>' +
      '</div>' +
      '<div class="pedido-itens-lista">' + itens + '</div>' +
    '</div>';
  }).join('');

  const totalCard =
    '<div class="conta-total-card">' +
      '<div class="conta-total-row"><span>Subtotal</span><span>R$ ' + fmt(total) + '</span></div>' +
      '<div class="conta-total-row grand"><span>Total da conta</span><span>R$ ' + fmt(total) + '</span></div>' +
    '</div>' +
    '<div class="conta-aviso">' +
      '💳 O pagamento é realizado no caixa ou com o garçom.<br>' +
      'Peça o fechamento da conta quando quiser ir embora.' +
    '</div>';

  document.getElementById('conta-body').innerHTML = grupos + totalCard;
}

function statusLabel(s) {
  return {pendente:'Aguardando', confirmado:'Recebido', em_preparo:'Em preparo 🍳', pronto:'Pronto! 🔔', entregue:'Entregue ✓', cancelado:'Cancelado'}[s] || s;
}

/* ════════════════════════════════════════════════
   NOTIFICAÇÃO "PRONTO!" — banner fixo no topo
════════════════════════════════════════════════ */
function mostrarNotifPronto(numPedido) {
  const el = document.getElementById('notif-pronto');
  document.getElementById('notif-msg').textContent = numPedido ? 'Pedido #' + numPedido + ' — o garçom está a caminho!' : 'O garçom está a caminho!';
  el.classList.add('show');
  // Vibração no celular (se suportado)
  if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
  // Auto-fecha após 8s
  setTimeout(fecharNotif, 8000);
}

function fecharNotif() { document.getElementById('notif-pronto').classList.remove('show'); }
function notifClick() { fecharNotif(); abrirConta(); }

/* ════════════════════════════════════════════════
   POLLING — atualiza status dos pedidos
   8s quando conta aberta, 15s em background
════════════════════════════════════════════════ */
function iniciarPolling() {
  pollingTimer = setInterval(async () => {
    const contaAberta = document.getElementById('conta-overlay').classList.contains('show');
    if (contaAberta) {
      await carregarConta();
    } else {
      // Background: só busca status para detectar "Pronto!" sem render completo
      await checkStatusBackground();
    }
  }, 8000);
}

async function checkStatusBackground() {
  if (!sessaoId || sessaoId.startsWith('demo')) return;
  try {
    const r = await fetch(`${EDGE}/conta/${sessaoId}`);
    if (!r.ok) return;
    const d = await r.json();
    // Parar polling se sessão foi encerrada pelo admin
    if (d.sessao_status === 'fechada' || d.sessao_status === 'paga') {
      mostrarAvisoSessaoFechada();
      clearTimeout(pollingConta);
      return;
    }
    const pedidos = d.pedidos || [];
    pedidos.forEach(p => {
      const anterior = ultimosPedidosStatus[p.id];
      if (anterior && anterior !== 'pronto' && p.status === 'pronto') {
        mostrarNotifPronto(p.numero);
      }
      ultimosPedidosStatus[p.id] = p.status;
    });
    // Atualiza total consumido em background
    const total = pedidos.filter(p => p.status !== 'cancelado').reduce((a,p) => a + Number(p.total), 0);
    totalConsumido = total;
    atualizarStatConsumido();
  } catch(e) {}
}

/* ════════════════════════════════════════════════
   UTILITÁRIOS
════════════════════════════════════════════════ */
function fmt(n) { return Number(n).toFixed(2).replace('.', ','); }

function imgEl(p) {
  return p.foto_url
    ? `<img src="${p.foto_url}" loading="lazy" onerror="this.parentElement.innerHTML='${emoji(p.nome)}';">`
    : emoji(p.nome);
}

function emoji(nome) {
  const n = (nome||'').toLowerCase();
  if (n.includes('bacon')||n.includes('smash'))     return '🥓';
  if (n.includes('chicken')||n.includes('frango'))  return '🍗';
  if (n.includes('veggie')||n.includes('vegano'))   return '🥗';
  if (n.includes('batata')||n.includes('frita'))    return '🍟';
  if (n.includes('onion')||n.includes('cebola'))    return '🧅';
  if (n.includes('shake')||n.includes('milk'))      return '🥤';
  if (n.includes('suco')||n.includes('juice'))      return '🍊';
  if (n.includes('refri')||n.includes('coca'))      return '🥃';
  if (n.includes('brownie')||n.includes('sobremes'))return '🍫';
  if (n.includes('combo'))                          return '🎁';
  return '🍔';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('search-input').addEventListener('input', (e) => buscar(e.target.value));
  document.getElementById('search-clear').addEventListener('click', limparBusca);
  document.getElementById('combo-banner').addEventListener('click', filtrarPorCombo);
  document.getElementById('cart-fab').addEventListener('click', abrirCarrinho);
  document.getElementById('conta-fab').addEventListener('click', abrirConta);
  document.getElementById('prod-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) fecharProd();
  });
  document.getElementById('cart-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) fecharCarrinho();
  });
  document.getElementById('conta-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) fecharConta();
  });
  init();
});
