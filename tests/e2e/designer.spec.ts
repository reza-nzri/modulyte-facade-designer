import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
	clickModule,
	euro,
	expectProjectTotal,
	expectWallTotal,
	openFreshApp,
	projectTotal
} from './helpers';

test.describe('Homeowner workflow', () => {
	test.beforeEach(async ({ page }) => {
		await openFreshApp(page);
	});

	test('loads the example house with all four facades, modules and the correct price', async ({
		page
	}) => {
		for (const wall of ['south', 'east', 'north', 'west']) {
			await expect(page.getByTestId(`wall-card-${wall}`)).toBeVisible();
		}
		// South wall: 121 standard + 22 special modules.
		await expect(page.locator('[data-testid="facade-canvas"] rect.module')).toHaveCount(143);
		await expect(page.locator('[data-testid="facade-canvas"] rect.module.special')).toHaveCount(22);
		// Default: clinker everywhere = 168.30 m² × 95 €/m².
		await expectProjectTotal(page, '15.988,50 €');
		await expectWallTotal(page, '3.980,50 €');
	});

	test('changes material and colour of a whole wall with live price update', async ({ page }) => {
		await page.getByTestId('swatch-rockpanel-grey').click();
		// 41.90 m² × 70 €/m²
		await expect(page.getByTestId('wall-total')).toHaveText(/2\.933,00/);
		await expectProjectTotal(page, '14.941,00 €');
		await expect(page.getByTestId('wall-card-south')).toContainText('Rockpanel-Platten · Grau');
		// Colour change without material change keeps the price.
		await page.getByTestId('swatch-rockpanel-black').click();
		await expect(page.getByTestId('wall-total')).toHaveText(/2\.933,00/);
	});

	test('styles a plinth region differently from the rest of the wall', async ({ page }) => {
		await page.getByTestId('swatch-rockpanel-grey').click();
		await page.getByTestId('preset-plinth').click();
		await expect(page.getByTestId('selection-summary')).toContainText('13 Module ausgewählt');
		await expect(page.getByTestId('apply-target')).toContainText('13 ausgewählte Module');
		await page.getByTestId('swatch-clinker-anthracite').click();
		// 3.775 m² × 95 € + 38.125 m² × 70 € = 358.63 € + 2,668.75 €
		await expect(page.getByTestId('wall-total')).toHaveText(/3\.027,38/);
		await expect(page.getByTestId('wall-card-south')).toContainText('13 individuelle Module');
	});

	test('selects modules by click, shift-click and frame, and shows module details', async ({
		page
	}) => {
		await clickModule(page, 'X-002');
		const details = page.getByTestId('module-details');
		await expect(details).toContainText('X-002');
		await expect(details).toContainText('Passstück (Sondermodul)');
		await expect(details).toContainText('425 × 500 mm');
		await expect(details).toContainText('0,213 m²');
		// 0.2125 m² × 95 €/m² = 20.1875 €
		await expect(details).toContainText('20,19 €');
		await clickModule(page, 'S-001', ['Shift']);
		await expect(page.getByTestId('selection-summary')).toContainText('2 Module ausgewählt');

		// Drag a selection frame over the lower-left corner of the wall.
		const canvas = page.getByTestId('facade-canvas');
		const first = await page.locator('[data-module-id="S-001"]').boundingBox();
		const second = await page.locator('[data-module-id="S-013"]').boundingBox();
		if (!first || !second) throw new Error('modules not rendered');
		await canvas.hover();
		await page.mouse.move(first.x + 5, first.y + first.height - 5);
		await page.mouse.down();
		await page.mouse.move(second.x + second.width - 5, second.y + 5, { steps: 8 });
		await page.mouse.up();
		await expect(page.getByTestId('selection-summary')).toContainText('4 Module ausgewählt');
		await page.keyboard.press('Escape');
		await expect(page.getByTestId('selection-summary')).toHaveCount(0);
	});

	test('supports undo and redo', async ({ page }) => {
		await page.getByTestId('swatch-rhombus-natural').click();
		await expectWallTotal(page, '3.352,00 €');
		await page.getByRole('button', { name: 'Rückgängig' }).click();
		await expectWallTotal(page, '3.980,50 €');
		await page.getByRole('button', { name: 'Wiederholen' }).click();
		await expectWallTotal(page, '3.352,00 €');
	});

	test('switches walls and keeps designs per wall', async ({ page }) => {
		await page.getByTestId('swatch-rockpanel-white').click();
		await page.getByTestId('wall-card-east').click();
		await expect(page.locator('[data-testid="facade-canvas"] rect.module')).toHaveCount(146);
		await expectWallTotal(page, '4.085,00 €');
		await expect(page.getByTestId('wall-card-south')).toContainText('2.933,00');
	});

	test('restores the design after a reload (autosave)', async ({ page }) => {
		await page.getByTestId('swatch-rockpanel-white').click();
		await page.reload();
		await expectProjectTotal(page, '14.941,00 €');
	});
});

test.describe('Import and export', () => {
	test('exports a versioned JSON document and re-imports it without loss', async ({
		page
	}, testInfo) => {
		await openFreshApp(page);
		await page.getByTestId('swatch-rhombus-grey glaze').click();
		await page.getByTestId('preset-plinth').click();
		await page.getByTestId('swatch-clinker-sand').click();
		await expect(page.getByTestId('wall-card-south')).toContainText('13 individuelle Module');
		const totalBefore = await projectTotal(page);

		const downloadPromise = page.waitForEvent('download');
		await page.getByTestId('export-button').click();
		const download = await downloadPromise;
		const path = testInfo.outputPath('export.json');
		await download.saveAs(path);
		const document = JSON.parse(readFileSync(path, 'utf8'));
		expect(document.format).toBe('modulyte.facade-design');
		expect(document.formatVersion).toBe(1);
		expect(document.source.walls).toHaveLength(4);
		expect(document.design.wallFinishes.south).toEqual({
			surfaceId: 'rhombus',
			color: 'grey glaze'
		});
		expect(Object.keys(document.design.moduleOverrides.south)).toHaveLength(13);
		expect(document.summary.moduleAssignments).toHaveLength(576);
		expect(euro(document.summary.totalFormatted)).toBe(totalBefore);

		// Reset to a different state, then import the file again.
		await page.getByTestId('swatch-rockpanel-black').click();
		await page.getByTestId('file-input').setInputFiles(path);
		await expect(page.getByTestId('project-total')).toHaveText(
			new RegExp(totalBefore.replace(/[.]/g, '\\.').replace(' €', ''))
		);
		await expect(page.getByTestId('wall-card-south')).toContainText('13 individuelle Module');
	});

	test('shows an understandable error for invalid files', async ({ page }) => {
		await openFreshApp(page);
		await page.getByTestId('file-input').setInputFiles({
			name: 'kaputt.json',
			mimeType: 'application/json',
			buffer: Buffer.from('{"walls": 3}')
		});
		await expect(page.getByTestId('import-error')).toContainText(
			'passt nicht zum erwarteten Aufbau'
		);
		await page.getByRole('button', { name: 'Verstanden' }).click();
		await expectProjectTotal(page, '15.988,50 €');
	});

	test('imports the original Modulyte project file', async ({ page }) => {
		await openFreshApp(page);
		await page.getByTestId('swatch-rockpanel-white').click();
		await page
			.getByTestId('file-input')
			.setInputFiles('static/projects/fassadendesigner_house.json');
		await expect(page.getByTestId('project-total')).toHaveText(/15\.988,50/);
	});
});

test.describe('Bonus features', () => {
	test.beforeEach(async ({ page }) => {
		await openFreshApp(page);
	});

	test('shows the house in 3D and selects a module by clicking it', async ({ page }) => {
		// WebGL is rendered in software on headless CI runners, which is slow.
		test.slow();
		await page.getByTestId('view-3d').click();
		const canvas = page.getByTestId('house-3d-canvas');
		await expect(canvas).toBeVisible();
		await page.waitForTimeout(1200);
		// Jump to the south facade and click the centre of the view (a facade module).
		await page
			.getByRole('group', { name: 'Kameraposition' })
			.getByRole('button', { name: 'Südfassade' })
			.click();
		await page.waitForTimeout(900);
		const box = await canvas.boundingBox();
		if (!box) throw new Error('3D canvas missing');
		await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
		await expect(page.getByTestId('module-details')).toBeVisible();
	});

	test('saves variants and compares them', async ({ page }) => {
		await page.getByTestId('variants-button').click();
		await page.locator('#variant-name').fill('Klinker rot');
		await page.getByTestId('save-variant').click();
		await page.getByRole('button', { name: 'Schließen', exact: true }).click();

		await page.getByTestId('swatch-rockpanel-white').click();
		await page.getByTestId('variants-button').click();
		await page.locator('#variant-name').fill('Rockpanel Süd');
		await page.getByTestId('save-variant').click();
		await expect(page.getByTestId('variant-item')).toHaveCount(2);

		for (const checkbox of await page.getByRole('checkbox', { name: 'Vergleichen' }).all())
			await checkbox.check();
		const comparison = page.getByTestId('variant-comparison');
		await expect(comparison).toContainText('Aktueller Entwurf');
		await expect(comparison).toContainText('15.988,50');
		await expect(comparison).toContainText('14.941,00');
		await expect(comparison).toContainText('Günstigste');

		// Load the first variant back.
		await page.getByTestId('variant-item').first().getByRole('button', { name: 'Laden' }).click();
		await expect(page.getByTestId('project-total')).toHaveText(/15\.988,50/);
	});

	test('opens a printable customer summary', async ({ page }) => {
		await page.getByTestId('summary-button').click();
		const dialog = page.getByTestId('summary-dialog');
		await expect(dialog.getByTestId('print-summary')).toContainText('Ihre Fassadengestaltung');
		await expect(dialog.getByTestId('print-summary')).toContainText('15.988,50');
		await expect(dialog.getByTestId('print-summary')).toContainText('Südfassade');
		// The print stylesheet shows only the summary document.
		await page.emulateMedia({ media: 'print' });
		await expect(page.locator('.print-root [data-testid="print-summary"]')).toBeVisible();
		await expect(page.locator('.app-shell')).toBeHidden();
	});
});
