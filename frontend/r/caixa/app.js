let RESTAURANT = null;
let mesaSelecionada = null;
let sessaoSelecionada = null;
let pgtoSelecionado = null;
let pagamentos = [];
let totalContaAtual = 0;
let polling = null;

async function init() {
  RESTAURANT = await initTenant();
  if (!RESTAURANT) return;
  if (isLoggedIn() && sessaoDoRestaurante(RESTAURANT)) iniciarApp();
  else if (isLoggedIn()) logout();
}

async function fazerLogin() {
  const email = document.getElementById('l-email').value.trim();
  const senha = document.getElementById('l-senha').value.trim();
  const erro  = document.getElementById('login-erro');
  erro.classList.remove('show');
  try {
    await login(email, senha, getCurrentRestaurantSlug());
    iniciarApp();
  } catch(e) {
    erro.textContent = e.message;
    erro.classList.add('show');
  }
}

function fazerLogout() {
  logout();
  clearTimeout(polling);
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

function iniciarApp() {
  try {
    exigirSessaoRestaurante(RESTAURANT);
    exigirPerfil(['cashier', 'manager', 'owner'], 'Use um login de caixa, gerente ou dono para fechar contas');
  } catch (e) {
    document.getElementById('login-erro').textContent = e.message;
    document.getElementById('login-erro').classList.add('show');
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
    return;
  }
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'flex';
  carregarMesas();
  function agendar() { polling = setTimeout(() => { carregarMesas(); agendar(); }, 10000); }
  agendar();
}

async function carregarMesas() {
  try {
    const { mesas } = await apiCall('GET', '/api/admin/tables');
    document.getElementById('mesas-grid').innerHTML = mesas.map(m => {
      const sess  = m.sessao_ativa;
      const total = Number(sess?.total_consumido || 0);
      const isSel = mesaSelecionada?.id === m.id;
      return `<button class="mesa-btn ${m.status} ${isSel?'selecionada':''}"
        onclick="selecionarMesa('${m.id}','${sess?.id||''}',${m.numero},${total},'${m.status}')">
        <div class="mesa-num">${m.numero}</div>
        <div class="mesa-status ${m.status}">${m.status === 'ocupada' ? '● Ocupada' : '● Livre'}</div>
        ${sess ? `<div class="mesa-total">R$ ${fmt(total)}</div>` : ''}
      </button>`;
    }).join('');

    // Se tinha mesa selecionada, recarregar a conta dela
    if (mesaSelecionada && sessaoSelecionada) {
      carregarConta(mesaSelecionada.numero, sessaoSelecionada);
    }
  } catch(e) {
    document.getElementById('mesas-grid').innerHTML = '<div style="padding:20px;color:var(--muted);font-size:13px">Erro ao carregar mesas.</div>';
  }
}

function selecionarMesa(mesaId, sessaoId, numero, total, status) {
  if (status !== 'ocupada' || !sessaoId) {
    showToast('Mesa livre — nenhuma conta aberta', '');
    return;
  }
  mesaSelecionada   = { id: mesaId, numero };
  sessaoSelecionada = sessaoId;
  pgtoSelecionado   = null;
  pagamentos = [];
  totalContaAtual = Number(total || 0);
  document.getElementById('split-forma').innerHTML = formasPagamentoOptions();
  document.getElementById('btn-fechar').disabled = true;
  document.getElementById('conta-mesa-num').textContent = `Mesa ${numero}`;
  document.getElementById('conta-mesa-info').textContent = `R$ ${fmt(total)} em aberto`;
  document.getElementById('conta-footer').style.display = 'block';
  carregarConta(numero, sessaoId);
  // Atualizar visual das mesas
  document.querySelectorAll('.mesa-btn').forEach(b => b.classList.remove('selecionada'));
  event.currentTarget.classList.add('selecionada');
}

async function carregarConta(numero, sessaoId) {
  document.getElementById('conta-body').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const slug = getCurrentRestaurantSlug();
    const data = await apiPublic('GET', `/api/public/restaurants/${slug}/sessions/${sessaoId}/bill`);
    const pedidos = data.pedidos || [];
    const total   = pedidos.reduce((a, p) => a + Number(p.total || 0), 0);
    totalContaAtual = total;

    document.getElementById('conta-total').textContent = 'R$ ' + fmt(total);
    document.getElementById('conta-mesa-info').textContent = `${pedidos.length} pedido(s) · R$ ${fmt(total)}`;

    if (!pedidos.length) {
      document.getElementById('conta-body').innerHTML = '<div class="conta-vazia"><span>Nenhum pedido ainda</span></div>';
      return;
    }

    document.getElementById('conta-body').innerHTML = pedidos.map(p => `
      <div class="pedido-bloco">
        <div class="pedido-head">
          <span class="pedido-num">#${p.numero}</span>
          <span class="pedido-status ${p.status}">${{pendente:'Aguardando',confirmado:'Confirmado',em_preparo:'Em preparo',pronto:'Pronto',entregue:'Entregue'}[p.status]||p.status}</span>
        </div>
        ${(p.itens||[]).map(it => `
          <div class="pedido-item">
            <span>${it.quantidade}× ${it.nome_produto}</span>
            <span class="pedido-item-preco">R$ ${fmt(it.subtotal)}</span>
          </div>`).join('')}
      </div>`).join('');
    renderPagamentos();
  } catch(e) {
    document.getElementById('conta-body').innerHTML = '<div class="conta-vazia"><span>Erro ao carregar conta</span></div>';
  }
}

function selPgto(btn, pgto) {
  document.querySelectorAll('.pgto-opt').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  pgtoSelecionado = pgto;
  document.getElementById('btn-fechar').disabled = false;
}

function formasPagamentoOptions() {
  return [
    ['dinheiro', 'Dinheiro'],
    ['pix', 'Pix'],
    ['cartao_credito', 'Cartão crédito'],
    ['cartao_debito', 'Cartão débito'],
    ['vale_refeicao', 'Vale refeição'],
    ['vale_alimentacao', 'Vale alimentação'],
    ['transferencia', 'Transferência'],
    ['outro', 'Outro'],
  ].map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
}

function labelPagamento(forma) {
  return {
    dinheiro:'Dinheiro', pix:'Pix', cartao_credito:'Cartão crédito', cartao_debito:'Cartão débito',
    vale_refeicao:'Vale refeição', vale_alimentacao:'Vale alimentação', transferencia:'Transferência', outro:'Outro',
  }[forma] || forma;
}

function totalPagamentos() {
  return pagamentos.reduce((a, p) => a + Number(p.valor || 0), 0);
}

function restantePagamento() {
  return Math.max(0, Number((totalContaAtual - totalPagamentos()).toFixed(2)));
}

function adicionarPagamento() {
  const forma = document.getElementById('split-forma').value;
  const valor = Number(document.getElementById('split-valor').value || 0);
  if (!valor || valor <= 0) return showToast('Informe um valor válido', 'error');
  if (valor - restantePagamento() > 0.02) return showToast('Valor maior que o restante', 'error');
  pagamentos.push({ forma_pagamento: forma, valor: Number(valor.toFixed(2)) });
  document.getElementById('split-valor').value = '';
  renderPagamentos();
}

function preencherRestante() {
  const restante = restantePagamento();
  if (restante > 0) document.getElementById('split-valor').value = restante.toFixed(2);
}

function removerPagamento(idx) {
  pagamentos.splice(idx, 1);
  renderPagamentos();
}

function renderPagamentos() {
  const lista = document.getElementById('split-lista');
  const resumo = document.getElementById('split-resumo');
  if (!lista || !resumo) return;
  const restante = restantePagamento();
  resumo.textContent = `Pago: R$ ${fmt(totalPagamentos())} · Restante: R$ ${fmt(restante)}`;
  lista.innerHTML = pagamentos.length ? pagamentos.map((p, idx) => `
    <div class="split-pay-item">
      <span>${labelPagamento(p.forma_pagamento)}</span>
      <strong>R$ ${fmt(p.valor)}</strong>
      <button onclick="removerPagamento(${idx})">✕</button>
    </div>`).join('') : '<div class="split-empty">Nenhum pagamento adicionado.</div>';
  document.getElementById('btn-fechar').disabled = restante > 0.02 || !pagamentos.length;
}

async function fecharConta() {
  if (!mesaSelecionada || !pagamentos.length || restantePagamento() > 0.02) return;
  const btn = document.getElementById('btn-fechar');
  btn.disabled = true;
  btn.textContent = 'Fechando...';
  try {
    await apiCall('POST', `/api/admin/tables/${mesaSelecionada.id}/close`,
      { pagamentos });
    showToast(`Mesa ${mesaSelecionada.numero} fechada!`, 'success');
    // Resetar
    mesaSelecionada = null; sessaoSelecionada = null; pgtoSelecionado = null; pagamentos = []; totalContaAtual = 0;
    document.getElementById('conta-mesa-num').textContent = '—';
    document.getElementById('conta-mesa-info').textContent = 'Selecione uma mesa';
    document.getElementById('conta-footer').style.display = 'none';
    document.getElementById('conta-body').innerHTML = '<div class="conta-vazia"><div style="font-size:32px">🧾</div><span>Selecione uma mesa ocupada</span></div>';
    carregarMesas();
  } catch(e) {
    showToast(e.message, 'error');
    btn.disabled = false;
    btn.textContent = '✓ Fechar conta';
  }
}

function fmt(n) { return Number(n).toFixed(2).replace('.', ','); }

function showToast(msg, tipo='') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (tipo?' '+tipo:'') + ' show';
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3000);
}

init();

