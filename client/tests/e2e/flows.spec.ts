import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  if (await page.getByLabel('邮箱').isVisible().catch(() => false)) {
    await page.getByLabel('邮箱').fill('dev@weavia.local');
    await page.getByLabel('密码').fill('weavia-dev-2026');
    await page.getByRole('button', { name: '登录' }).click();
    await page.locator('.account-mini b', { hasText: 'dev@weavia.local' }).waitFor({ timeout: 15000 });
  }
});

test('首页直接生成，结果留在创作会话', async ({ page }) => {
  await expect(page.getByRole('heading', { name: '今天，为商品创作什么？' })).toBeVisible();
  await page.getByLabel('创作描述').fill('为一瓶金色香水制作白底商品主图');
  await page.getByRole('button', { name: '生成图片' }).click();
  await page.waitForURL('**/create');
  await expect(page.locator('.page-header .badge')).toHaveText('已完成', { timeout: 60000 });
  await expect(page.locator('.session-stage img')).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'test-results/session.png', fullPage: true });
});

test('左侧导航保留原有入口并新增 Skill 与 AI 应用', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: '工作区' });
  for (const label of ['首页', '商品', '作品', '任务', '素材中心', 'Skill', 'AI 应用']) {
    await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  await nav.getByRole('button', { name: '创作工具' }).click();
  for (const label of ['图片编辑', '视频工作台', '工作流']) {
    await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: '账户与设置' })).toBeVisible();
});

test('素材与账户设置仍可正常使用', async ({ page }) => {
  await page.getByRole('link', { name: '素材中心', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'test.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64'),
  });
  await expect(page.getByText('test.png')).toBeVisible();
  await page.getByLabel('搜索素材').fill('absent');
  await expect(page.getByText('没有匹配的素材')).toBeVisible();

  await page.getByRole('link', { name: '账户与设置' }).click();
  await page.getByRole('button', { name: '偏好设置' }).click();
  await page.getByRole('button', { name: 'Cream' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'cream');
});

test('灵感示例可以回填提示词', async ({ page }) => {
  const card = page.getByRole('button', { name: /使用示例：香水/ }).first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByLabel('创作描述')).toHaveValue(/香水瓶/);
});
