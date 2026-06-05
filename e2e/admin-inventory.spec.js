const { test, expect } = require('@playwright/test');

async function loginWithRetry(page) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const loginResponse = page.waitForResponse(
      response => response.url().includes('/api/auth/login'),
      { timeout: 15000 },
    );
    await page.getByRole('button', { name: /entrar/i }).click();
    const response = await loginResponse;
    if (response.status() === 200) return;
    if (response.status() === 429 && attempt === 1) {
      const retryAfter = Number(response.headers()['retry-after'] || 5);
      await page.waitForTimeout(Math.min(Math.max(retryAfter, 5), 15) * 1000);
      continue;
    }
    throw new Error(`Login QA falhou com HTTP ${response.status()}: ${await response.text()}`);
  }
}

test.describe('admin estoque', () => {
  test('owner/manager acessa aba Estoque quando credenciais QA forem informadas', async ({ page }) => {
    const slug = process.env.E2E_RESTAURANT_SLUG;
    const email = process.env.E2E_OWNER_EMAIL;
    const password = process.env.E2E_OWNER_PASSWORD;

    test.skip(!slug || !email || !password, 'Defina E2E_RESTAURANT_SLUG, E2E_OWNER_EMAIL e E2E_OWNER_PASSWORD para testar estoque autenticado.');

    await page.goto(`/r/${slug}/admin`, { waitUntil: 'domcontentloaded' });
    await page.locator('#l-email').fill(email);
    await page.locator('#l-senha').fill(password);
    await loginWithRetry(page);

    await expect(page.locator('#app-screen')).toBeVisible({ timeout: 15000 });
    await page.getByText('Estoque', { exact: true }).click();
    await expect(page.locator('#page-estoque')).toBeVisible();
    await expect(page.locator('#page-estoque')).toContainText(/Insumos|Movimentacoes|Movimentações|Alertas|Relatorios|Relatórios/i);
  });
});
