/* ════════════════════════════════════════════════════
   MÓDULO: MESAS
════════════════════════════════════════════════════ */

import { supa, rpc } from './api.js';
import { state, updateState } from './config.js';
import { fmt, showToast } from './utils.js';

export async function carregarMesas() {
  try {
    const mesas = await supa(
      '/rest/v1/mesas?select=id,numero,status,capacidade,sessao_mesa!left(id,status,aberta_em,total_consumido)&ativa=eq.true&order=numero'
    );
    const peds = await supa(
      '/rest/v1/pedidos?select=id,status,sessao_mesa_id&status=in.(pendente,confirmado,em_preparo,pronto)&sessao_mesa_id=not.is.null'
    );
    const ppSessao = {};
    (peds || []).forEach(p => {
      ppSessao[p.sessao_mesa_id] = (ppSessao[p.sessao_mesa_id] || 0) + 1;
    });
    renderMesas(mesas || [], ppSessao);
    atualizarBadges(mesas || [], peds || []);
  } catch (e) {
    document.getElementById('mesas-grid').innerHTML = '<div class="tabela-empty">Erro ao carregar mesas.</div>';
  }
}

function renderMesas(mesas, ppSessao) {
  const ocup = mesas.filter(m => m.status === 'ocupada').length;
  const liv = mesas.filter(m => m.status === 'livre').length;
  const fat = mesas.reduce((a, m) => {
    const s = (m.sessao_mesa || []).find(s => s.status === 'aberta');
    return a + Number(s?.total_consumido || 0);
  }, 0);
  const pedAtivos = Object.values(ppSessao).reduce((a, b) => a + b, 0);

  document.getElementById('s-ocup').textContent = ocup;
  document.getElementById('s-liv').textContent = liv;
  document.getElementById('s-fat').textContent = 'R$ ' + fmt(fat);
  document.getElementById('s-ped').textContent = pedAtivos;

  document.getElementById('mesas-grid').innerHTML = mesas
    .map(m => {
      const sessao = (m.sessao_mesa || []).find(s => s.status === 'aberta');
      const total = Number(sessao?.total_consumido || 0);
      const npeds = sessao ? ppSessao[sessao.id] || 0 : 0;
      const dur = sessao ? Math.floor((Date.now() - new Date(sessao.aberta_em)) / 60000) : 0;
      const durStr = dur < 60 ? dur + 'min' : Math.floor(dur / 60) + 'h' + (dur % 60 > 0 ? dur % 60 + 'min' : '');

      return `<div class="mesa-card ${m.status}" ${sessao ? `onclick="window.app.mesas.abrirConta('${m.id}','${sessao.id}',${m.numero},${total})"` : ''}>
        <div class="mesa-num">${m.numero}</div>
        <div class="mesa-status-badge ${m.status}">${m.status === 'livre' ? '● Livre' : m.status === 'ocupada' ? '● Ocupada' : '● Reservada'}</div>
        <div class="mesa-info">${sessao ? `${npeds} pedido${npeds !== 1 ? 's' : ''} · ${durStr}` : `Cap. ${m.capacidade || 4} pessoas`}</div>
        ${sessao ? `<div class="mesa-total">R$ ${fmt(total)}</div>` : ''}
        <div class="mesa-actions" onclick="event.stopPropagation()">
          ${sessao ? `<button class="btn btn-sm btn-success" onclick="window.app.mesas.abrirConta('${m.id}','${sessao.id}',${m.numero},${total})">Ver conta →</button>` : `<button class="btn btn-sm" onclick="window.app.mesas.reservarMesa('${m.id}',${m.numero},'${m.status}')">${m.status === 'reservada' ? 'Liberar' : 'Reservar'}</button>`}
        </div>
      </div>`;
    })
    .join('');
}

function atualizarBadges(mesas, peds) {
  const ocup = mesas.filter(m => m.status === 'ocupada').length;
  const pend = peds.filter(p => p.status === 'pendente').length;
  const bO = document.getElementById('badge-ocupadas');
  const bP = document.getElementById('badge-pendentes');
  bO.textContent = ocup;
  bO.classList.toggle('show', ocup > 0);
  bP.textContent = pend;
  bP.classList.toggle('show', pend > 0);
}

export async function reservarMesa(id, num, statusAtual) {
  const novo = statusAtual === 'reservada' ? 'livre' : 'reservada';
  await supa(`/rest/v1/mesas?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status: novo }) });
  showToast(`Mesa ${num} ${novo === 'reservada' ? 'reservada' : 'liberada'}`, 'success');
  carregarMesas();
}

export async function abrirConta(mesaId, sessaoId, numero, total) {
  updateState({
    mesaAberta: { mesa_id: mesaId, sessao_id: sessaoId, numero, total },
    pgtoSelecionado: null,
  });

  document.getElementById('modal-conta-title').textContent = `Conta — Mesa ${numero}`;
  document.getElementById('modal-conta-footer').style.display = 'none';
  document.getElementById('modal-conta-body').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  document.getElementById('modal-conta').classList.add('show');

  try {
    const data = await rpc('get_pedidos_sessao', { p_sessao_id: sessaoId });
    const pedidos = Array.isArray(data) ? data : data ? JSON.parse(data) : [];
    renderContaModal(pedidos, numero);
  } catch (e) {
    document.getElementById('modal-conta-body').innerHTML = '<div class="tabela-empty">Erro ao carregar.</div>';
  }
}

function renderContaModal(pedidos, numero) {
  const total = pedidos.filter(p => p.status !== 'cancelado').reduce((a, p) => a + Number(p.total), 0);
  updateState({ mesaAberta: { ...state.mesaAberta, total } });

  // Renderizar conta modal (simplificado)
  const html = `
    <div class="conta-mesa-num">Mesa ${numero}</div>
    <div class="conta-aberta-em">${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''}</div>
    <div class="conta-total-linha"><span style="font-size:14px;color:var(--muted)">Total da conta</span><span class="conta-total-val">R$ ${fmt(total)}</span></div>
  `;
  document.getElementById('modal-conta-body').innerHTML = html;
  document.getElementById('modal-conta-footer').style.display = 'flex';
}

export function selecionarPgto(btn) {
  document.querySelectorAll('.pgto-btn').forEach(b => b.classList.remove('selecionado'));
  btn.classList.add('selecionado');
  updateState({ pgtoSelecionado: btn.dataset.pgto });
  document.getElementById('btn-fechar-conta').disabled = false;
}

export async function confirmarFecharConta() {
  if (!state.pgtoSelecionado || !state.mesaAberta) return;
  const btn = document.getElementById('btn-fechar-conta');
  btn.disabled = true;
  btn.textContent = 'Fechando...';

  try {
    await rpc('fechar_sessao_mesa', { p_sessao_id: state.mesaAberta.sessao_id });
    await supa(
      `/rest/v1/pedidos?sessao_mesa_id=eq.${state.mesaAberta.sessao_id}&status=neq.cancelado`,
      {
        method: 'PATCH',
        body: JSON.stringify({ forma_pagamento: state.pgtoSelecionado, status_pagamento: 'aprovado' }),
      }
    );
    document.getElementById('modal-conta').classList.remove('show');
    showToast(`Mesa ${state.mesaAberta.numero} fechada · R$ ${fmt(state.mesaAberta.total)}`, 'success');
    carregarMesas();
  } catch (e) {
    showToast('Erro ao fechar: ' + e.message, 'error');
    btn.disabled = false;
    btn.textContent = '✓ Fechar conta';
  }
}

// Exportar namespace
export const mesasModule = {
  carregarMesas,
  reservarMesa,
  abrirConta,
  selecionarPgto,
  confirmarFecharConta,
};
