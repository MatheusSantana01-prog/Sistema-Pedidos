const { test, expect } = require('@playwright/test');

test.describe('admin estoque', () => {
  test('owner/manager acessa aba Estoque quando credenciais QA forem informadas', async ({ page }) => {
    const slug = process.env.E2E_RESTAURANT_SLUG;
    const email = process.env.E2E_OWNER_EMAIL;
    const password = process.env.E2E_OWNER_PASSWORD;

    test.skip(!slug || !email || !password, 'Defina E2E_RESTAURANT_SLUG, E2E_OWNER_EMAIL e E2E_OWNER_PASSWORD para testar estoque autenticado.');

    await page.goto(`/r/${slug}/admin`, { waitUntil: 'domcontentloaded' });
    await page.locator('#l-email').fill(email);
    await page.locator('#l-senha').fill(password);
    await page.getByRole('button', { name: /entrar/i }).click();

    await expect(page.locator('#app-screen')).toBeVisible();
    await page.getByText('Estoque', { exact: true }).click();
    await expect(page.locator('#page-estoque')).toBeVisible();
    await expect(page.locator('#estoque-root')).toContainText(/Insumos|Movimentacoes|Movimentações|Alertas|Relatorios|Relatórios/i);
  });
});
