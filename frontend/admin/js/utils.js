/* ════════════════════════════════════════════════════
   UTILITÁRIOS v4.0
   MELHORIA: fmt() aceita null/undefined sem quebrar
   MELHORIA: showToast com tipos: success, error, warning, info
   MELHORIA: confirmar() retorna Promise (opcional)
════════════════════════════════════════════════════ */

export function fmt(n) {
  const num = Number(n);
  if (isNaN(num)) return '0,00';
  return num.toFixed(2).replace('.', ',');
}

export function statusLabel(s) {
  return {
    pendente:   'Aguardando',
    confirmado: 'Confirmado',
    em_preparo: 'Em preparo',
    pronto:     'Pronto',
    entregue:   'Entregue',
    cancelado:  'Cancelado',
  }[s] || s;
}

export function pgtoLabel(p) {
  return {
    dinheiro:      'Dinheiro',
    pix:           'Pix',
    cartao_credito:'Crédito',
    cartao_debito: 'Débito',
    misto:         'Misto',
    nao_informado: 'Não inf.',
  }[p] || p;
}

export function fecharModal(id) {
  document.getElementById(id)?.classList.remove('show');
}

export function showToast(msg, tipo = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className   = 'toast' + (tipo ? ' ' + tipo : '') + ' show';
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3500);
}

/** Substitui confirm() com suporte a Promise */
export function confirmar(msg) {
  return new Promise(resolve => resolve(window.confirm(msg)));
}

/** Formata data/hora para pt-BR */
export function fmtDateTime(iso, { date = true, time = true } = {}) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (date && time) return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  if (date) return d.toLocaleDateString('pt-BR');
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Formata duração em minutos para string legível */
export function fmtDuracao(minutos) {
  if (!minutos && minutos !== 0) return '—';
  if (minutos < 60) return minutos + 'min';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h + 'h' + (m > 0 ? m + 'min' : '');
}

// Fecha modais ao clicar no background
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-bg').forEach(b => {
    b.addEventListener('click', e => {
      if (e.target === b) b.classList.remove('show');
    });
  });
});
