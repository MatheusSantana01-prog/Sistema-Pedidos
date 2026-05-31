const { test, expect } = require('@playwright/test');

const slug = process.env.E2E_RESTAURANT_SLUG || 'pizzaria-bella-massa';

async function expectNoCriticalConsole(page, action) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await action();
  const ignored = errors.filter((msg) => !/favicon|Failed to load resource.*404/i.test(msg));
  expect(ignored).toEqual([]);
}

test.describe('smoke das telas principais', () => {
  test('super-admin carrega login ou painel sem erro critico', async ({ page }) => {
    await expectNoCriticalConsole(page, async () => {
      await page.goto('/super-admin', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toContainText(/Sistema|Super|Login|Entrar/i);
    });
  });

  for (const surface of ['admin', 'garcom', 'cozinha', 'caixa', 'tv']) {
    test(`${surface} carrega a tela do restaurante`, async ({ page }) => {
      await expectNoCriticalConsole(page, async () => {
        await page.goto(`/r/${slug}/${surface}`, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('body')).toContainText(/Sistema|Entrar|Login|Pedido|Mesa|Cozinha|Caixa|TV/i);
      });
    });
  }
});

test.describe('mesa via QR Code', () => {
  test('carrega mesa quando token QA for informado', async ({ page }) => {
    const token = process.env.E2E_TABLE_TOKEN;
    test.skip(!token, 'Defina E2E_TABLE_TOKEN para testar uma mesa real de QA.');

    await expectNoCriticalConsole(page, async () => {
      await page.goto(`/r/${slug}/mesa/${token}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toContainText(/Cardapio|Cardápio|Carrinho|Mesa/i);
    });
  });
});
