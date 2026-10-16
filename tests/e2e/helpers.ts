import { expect, type Page } from '@playwright/test';

/** Opens the app with clean storage and dismisses the first-visit guide. */
export async function openFreshApp(page: Page) {
	await page.goto('/');
	await page.evaluate(() => localStorage.clear());
	await page.reload();
	await page.getByTestId('help-start').click();
	await expect(page.getByTestId('facade-canvas')).toBeVisible();
}

/** Normalises the narrow no-break spaces used by Intl currency formatting. */
export function euro(text: string | null): string {
	return (text ?? '').replace(/\s/g, ' ').trim();
}

export async function projectTotal(page: Page) {
	return euro(await page.getByTestId('project-total').textContent());
}

export async function wallTotal(page: Page) {
	return euro(await page.getByTestId('wall-total').textContent());
}

/** Clicks a module rectangle in the 2D canvas by its id. */
export async function clickModule(
	page: Page,
	moduleId: string,
	modifiers: ('Shift' | 'Control')[] = []
) {
	await page
		.getByTestId('facade-canvas')
		.locator(`[data-module-id="${moduleId}"]`)
		.click({ modifiers, force: true });
}
