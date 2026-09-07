const { test, expect } = require('@playwright/test');

test.describe('acesso e telas locais', () => {
  test.skip(!process.env.E2E_LOCAL, 'Executar apenas com o servidor local e respostas de teste.');

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/login') {
        return route.fulfill({ json: {
          token: 'test-session',
          usuario: { id: 'qa-user', nome: 'QA Admin', email: 'qa@example.com', role: 'super_admin', is_super_admin: true, password_change_required: true },
        } });
      }
      if (path === '/api/auth/me/password') return route.fulfill({ json: { mensagem: 'Senha atualizada' } });
      if (/\/api\/public\/restaurants\/qa$/.test(path)) return route.fulfill({ json: {
        id: 'qa-restaurant', name: 'Restaurante QA', slug: 'qa', primary_color: '#b91c1c',
        background_color: '#181818', text_color: '#ffffff', is_active: true,
        modules: { mesas: true, qr_code: true, cozinha: true, caixa: true, garcom: true }, settings: {},
      } });
      return route.fulfill({ json: {} });
    });
  });

  for (const surface of ['admin', 'garcom', 'cozinha', 'caixa', 'tv']) {
    test(`${surface}: login visivel e sem rolagem horizontal`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`/r/qa/${surface}`);
      await expect(page.locator('#l-email')).toBeVisible();
      await expect(page.locator('#l-senha')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width + 1);
      expect(errors).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`${surface}.png`), fullPage: true });
    });
  }

  test('senha fraca exige troca antes de operar e encerra a sessao ao salvar', async ({ page }) => {
    await page.goto('/super-admin');
    await page.locator('#l-email').fill('qa@example.com');
    await page.locator('#l-senha').fill('weak-test');
    await page.getByRole('button', { name: /^entrar/i }).click();
    await expect(page.locator('#auth-password-modal')).toBeVisible();
    await expect(page.locator('#auth-nova-senha')).toHaveAttribute('minlength', '12');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width + 1);
    await page.screenshot({ path: test.info().outputPath('password-required.png'), fullPage: true });
    await page.locator('#auth-senha-atual').fill('weak-test');
    await page.locator('#auth-nova-senha').fill('Cafe com mesas 2026!');
    await page.locator('#auth-confirmar-senha').fill('Cafe com mesas 2026!');
    await page.locator('#auth-password-submit').click();
    await expect(page.locator('#l-email')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('saas_token'))).toBeNull();
  });

  test('QR Code abre cardapio e envia pedido da mesa', async ({ page }) => {
    let submitted;
    await page.route('**/api/public/restaurants/qa/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/tables/qa-token')) return route.fulfill({ json: { mesa: { id: 'table-1', numero: 1 } } });
      if (path.endsWith('/tables/qa-token/sessions')) return route.fulfill({ json: { sessao: { id: 'session-1' } } });
      if (path.endsWith('/menu')) return route.fulfill({ json: { cardapio: [{ id: 'category-1', nome: 'Espetinhos', produtos: [{ id: 'product-1', nome: 'Espetinho QA', preco: 15.90, disponivel: true }] }] } });
      if (path.endsWith('/orders')) {
        submitted = route.request().postDataJSON();
        return route.fulfill({ json: { pedido: { id: 'order-1', numero: 1, total: 15.90 } } });
      }
      return route.fulfill({ json: { pedidos: [], total_consumido: 0, settings: {} } });
    });
    await page.goto('/r/qa/mesa/qa-token');
    await expect(page.locator('#header-mesa')).toHaveText('Mesa 1');
    await page.getByRole('button', { name: 'Adicionar Espetinho QA', exact: true }).click();
    await page.locator('#cart-fab').click();
    await expect(page.locator('#carrinho-total-val')).toContainText('15,90');
    await page.locator('.btn-enviar').click();
    await expect(page.locator('#sucesso-overlay')).toHaveClass(/show/);
    expect(submitted.mesa_id).toBe('table-1');
    expect(submitted.sessao_mesa_id).toBe('session-1');
    expect(submitted.itens[0].produto_id).toBe('product-1');
    expect(submitted.total).toBe(15.90);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width + 1);
    await page.screenshot({ path: test.info().outputPath('order-sent.png'), fullPage: true });
  });
});
