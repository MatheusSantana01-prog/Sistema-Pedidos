/* ════════════════════════════════════════════════════
   NAVEGAÇÃO E INICIALIZAÇÃO
════════════════════════════════════════════════════ */

import { state, updateState } from './config.js';
import { verificarLogin, logout } from './auth.js';
import { setupModalClicks } from './utils.js';

let loaders = {};

export function irPara(pagina, tabEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + pagina).classList.add('active');
  tabEl.classList.add('active');

  // Carregar dados da página
  if (loaders[pagina]) {
    loaders[pagina]();
  }
}

export function registrarLoader(pagina, callback) {
  loaders[pagina] = callback;
}

// Inicialização geral
export function inicializarApp() {
  // Setup modais
  setupModalClicks();

  // Setup navbar
  const navTabs = document.querySelectorAll('.nav-tab');
  navTabs.forEach((tab, idx) => {
    tab.addEventListener('click', () => {
      const pagina = tab.getAttribute('onclick')?.match(/'(\w+)'/)?.[1];
      if (!pagina) return;
      irPara(pagina, tab);
    });
  });

  // Setup logout
  const btnLogout = document.querySelector('.btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (confirm('Tem certeza que deseja sair?')) {
        logout();
      }
    });
  }

  // Verificar login existente
  verificarLogin();
}

// Iniciar quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializarApp);
} else {
  inicializarApp();
}
