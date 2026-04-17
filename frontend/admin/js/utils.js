/* ════════════════════════════════════════════════════
   UTILITÁRIOS
════════════════════════════════════════════════════ */

// Formatação
export function fmt(n) {
  return Number(n).toFixed(2).replace('.', ',');
}

export function statusLabel(s) {
  const labels = {
    pendente: 'Aguardando',
    confirmado: 'Confirmado',
    em_preparo: 'Em preparo',
    pronto: 'Pronto',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
  };
  return labels[s] || s;
}

export function pgtoLabel(p) {
  const labels = {
    dinheiro: 'Dinheiro',
    pix: 'Pix',
    cartao_credito: 'Crédito',
    cartao_debito: 'Débito',
    nao_informado: 'Não inf.',
  };
  return labels[p] || p;
}

// Toast
export function showToast(msg, tipo = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast' + (tipo ? ' ' + tipo : '') + ' show';
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3500);
}

// Modais
export function fecharModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('show');
}

export function abrirModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('show');
}

// Setup modal background click
export function setupModalClicks() {
  document.querySelectorAll('.modal-bg').forEach(b => {
    b.addEventListener('click', e => {
      if (e.target === b) b.classList.remove('show');
    });
  });
}
