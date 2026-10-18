import { describe, expect, it } from 'vitest';
import { applyFinishToAllWalls, applyModuleFinish, createDefaultDesign } from './design';
import { costForArea, formatCents, formatCentsDelta } from './money';
import { priceProject, priceWall } from './pricing';
import { selectPreset } from './selection';
import { createTinyProject, getWall, loadExampleProject } from '$lib/testing/fixtures';

describe('money', () => {
	it('rounds half up to whole cents', () => {
		// 3.775 m² × 95 €/m² = 358.625 € → 358.63 €
		expect(costForArea(3_775_000, 95)).toBe(35_863);
		expect(costForArea(1_000_000, 0)).toBe(0);
		expect(costForArea(333_333, 95.5)).toBe(3_183);
	});

	it('formats German currency strings', () => {
		const normalize = (value: string) => value.replace(/\s/g, ' ');
		expect(normalize(formatCents(1_598_850))).toBe('15.988,50 €');
		expect(normalize(formatCentsDelta(9_438))).toBe('+94,38 €');
		expect(normalize(formatCentsDelta(-1_200))).toBe('−12,00 €');
	});
});

describe('pricing of the supplied example house', () => {
	const project = loadExampleProject();

	it.each([
		['clinker', 'red', 1_598_850],
		['rockpanel', 'white', 1_178_100],
		['rhombus', 'natural', 1_346_400]
	])('one surface everywhere: %s', (surfaceId, color, expectedCents) => {
		const design = applyFinishToAllWalls(createDefaultDesign(project), project, {
			surfaceId,
			color
		});
		expect(priceProject(project, design).totalCents).toBe(expectedCents);
	});

	it('prices a clinker plinth on a rockpanel south wall correctly', () => {
		let design = applyFinishToAllWalls(createDefaultDesign(project), project, {
			surfaceId: 'rockpanel',
			color: 'grey'
		});
		const south = getWall(project, 'south');
		const plinth = selectPreset(south, 'plinth');
		expect(plinth).toHaveLength(13);
		design = applyModuleFinish(design, 'south', plinth, {
			surfaceId: 'clinker',
			color: 'anthracite'
		});
		const wall = priceWall(project, design, south);
		// 3.775 m² × 95 = 358.63 € plus 38.125 m² × 70 = 2,668.75 €
		expect(wall.totalCents).toBe(302_738);
		expect(wall.lines.map((l) => [l.surfaceId, l.moduleCount])).toEqual([
			['rockpanel', 130],
			['clinker', 13]
		]);
	});

	it('wall totals and lines always add up to the project total', () => {
		const design = applyModuleFinish(createDefaultDesign(project), 'east', ['S-122', 'X-023'], {
			surfaceId: 'rhombus',
			color: 'grey glaze'
		});
		const price = priceProject(project, design);
		const sumWalls = price.walls.reduce((s, w) => s + w.totalCents, 0);
		const sumLines = price.lines.reduce((s, l) => s + l.costCents, 0);
		expect(sumWalls).toBe(price.totalCents);
		expect(sumLines).toBe(price.totalCents);
		for (const wall of price.walls) {
			expect(wall.lines.reduce((s, l) => s + l.costCents, 0)).toBe(wall.totalCents);
			expect(wall.unpricedAreaMm2).toBe(0);
		}
	});

	it('colours do not change the price, surfaces do', () => {
		const a = applyFinishToAllWalls(createDefaultDesign(project), project, {
			surfaceId: 'clinker',
			color: 'red'
		});
		const b = applyFinishToAllWalls(createDefaultDesign(project), project, {
			surfaceId: 'clinker',
			color: 'sand'
		});
		expect(priceProject(project, a).totalCents).toBe(priceProject(project, b).totalCents);
	});
});

describe('pricing of arbitrary projects (not tied to the example)', () => {
	it('uses module areas and the rate of each module finish', () => {
		const project = createTinyProject();
		let design = createDefaultDesign(project); // wood 80 €/m² everywhere
		expect(priceProject(project, design).totalCents).toBe(Math.round(1.75 * 80 * 100));
		design = applyModuleFinish(design, 'front', ['D'], { surfaceId: 'brick', color: 'red' });
		// 1.5 m² wood (120 €) + 0.25 m² brick at 95.50 € (23.875 → 23.88 €)
		expect(priceProject(project, design).totalCents).toBe(12_000 + 2_388);
	});

	it('marks modules with an invalid finish as unpriced instead of guessing', () => {
		const project = createTinyProject();
		const design = {
			wallFinishes: { front: { surfaceId: 'unknown', color: 'x' } },
			moduleOverrides: {}
		};
		const price = priceProject(project, design);
		expect(price.totalCents).toBe(0);
		expect(price.walls[0]!.unpricedAreaMm2).toBe(1_750_000);
	});
});
