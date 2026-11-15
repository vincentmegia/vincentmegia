// /about page: intro, hobby section and the donate-by-QR section
// (docs/features/about.md). The QR images are supplied at deployment, so
// this spec accepts either state of the donate section — QR cards or the
// "coming soon" note; the per-file cases are covered by the Go handler test
// (internal/handler/about_test.go).
const { test, expect } = require('@playwright/test');

async function expectAboutContent(page) {
	const main = page.locator('#main-content');
	await expect(main.getByRole('heading', { level: 1, name: 'About' })).toBeVisible();
	await expect(main).toContainText('Principal Software Engineer');
	await expect(main.getByRole('heading', { name: 'What I do for fun' })).toBeVisible();
	await expect(main.getByRole('heading', { name: 'Support my work' })).toBeVisible();

	const cards = main.locator('.about-donate-method');
	const count = await cards.count();
	if (count === 0) {
		await expect(main.locator('#about-donate-empty')).toBeVisible();
		return;
	}
	await expect(main.locator('#about-donate-empty')).toHaveCount(0);
	for (let i = 0; i < count; i++) {
		const img = cards.nth(i).locator('img');
		await expect(img).toHaveAttribute('alt', /QR code/);
		// A QR that didn't load would be a broken image, not a missing card.
		expect(await img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
	}
}

test.describe('about page', () => {
	test('renders on a direct load with About marked current in the nav', async ({ page }) => {
		await page.goto('/about');
		await expect(page).toHaveTitle(/About/);
		await expectAboutContent(page);
		await expect(page.locator('#primary-nav').getByRole('link', { name: 'About', exact: true })).toHaveAttribute('aria-current', 'page');
	});

	test('renders via the header nav, then links on to Projects', async ({ page }) => {
		await page.goto('/');
		await page.locator('#primary-nav').getByRole('link', { name: 'About', exact: true }).click();
		await expect(page).toHaveURL(/\/about$/);
		await expectAboutContent(page);

		await page.locator('#main-content').getByRole('link', { name: 'See my projects' }).click();
		await expect(page).toHaveURL(/\/projects$/);
		await expect(page.locator('#main-content').getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
	});

	test('fits a phone viewport without horizontal scroll', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 800 });
		await page.goto('/about');
		await expectAboutContent(page);
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
		expect(overflow).toBeLessThanOrEqual(0);
	});
});
