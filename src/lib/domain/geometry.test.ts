import { describe, expect, it } from 'vitest';
import { getWall, loadExampleProject } from '$lib/testing/fixtures';
import {
	computeWallAreas,
	intersectionArea,
	mm2ToM2,
	rectFromPoints,
	rectsTouch,
	standardShare,
	unionArea
} from './geometry';

const r = (x_mm: number, y_mm: number, width_mm: number, height_mm: number) => ({
	x_mm,
	y_mm,
	width_mm,
	height_mm
});

describe('rectangle primitives', () => {
	it('computes intersection areas, touching rectangles have none', () => {
		expect(intersectionArea(r(0, 0, 10, 10), r(5, 5, 10, 10))).toBe(25);
		expect(intersectionArea(r(0, 0, 10, 10), r(10, 0, 10, 10))).toBe(0);
	});

	it('counts overlapping rectangles only once in a union', () => {
		expect(unionArea([r(0, 0, 10, 10), r(5, 0, 10, 10)])).toBe(150);
		expect(unionArea([r(0, 0, 10, 10), r(0, 0, 10, 10)])).toBe(100);
		expect(unionArea([r(0, 0, 10, 10), r(20, 20, 5, 5)])).toBe(125);
		expect(unionArea([])).toBe(0);
	});

	it('detects edge contact but not corner contact', () => {
		expect(rectsTouch(r(0, 0, 10, 10), r(10, 0, 10, 10))).toBe(true);
		expect(rectsTouch(r(0, 0, 10, 10), r(10, 10, 10, 10))).toBe(false);
		expect(rectsTouch(r(0, 0, 10, 10), r(11, 0, 10, 10))).toBe(false);
	});

	it('normalises rectangles from arbitrary corners', () => {
		expect(rectFromPoints(10, 20, 0, 5)).toEqual(r(0, 5, 10, 15));
	});
});

describe('wall areas of the supplied example house', () => {
	const project = loadExampleProject();
	const expected = {
		south: { gross: 53.9, openings: 12, net: 41.9, standard: 121, special: 22, share: 0.9024 },
		east: { gross: 46.75, openings: 3.75, net: 43, standard: 121, special: 25, share: 0.8794 },
		north: { gross: 53.9, openings: 10.5, net: 43.4, standard: 121, special: 30, share: 0.8713 },
		west: { gross: 46.75, openings: 6.75, net: 40, standard: 116, special: 20, share: 0.9062 }
	} as const;

	for (const [wallId, values] of Object.entries(expected)) {
		it(`matches the reference numbers for the ${wallId} wall`, () => {
			const areas = computeWallAreas(getWall(project, wallId));
			expect(mm2ToM2(areas.grossMm2)).toBeCloseTo(values.gross, 6);
			expect(mm2ToM2(areas.openingsMm2)).toBeCloseTo(values.openings, 6);
			expect(mm2ToM2(areas.netMm2)).toBeCloseTo(values.net, 6);
			expect(mm2ToM2(areas.coveredMm2)).toBeCloseTo(values.net, 6);
			expect(areas.uncoveredMm2).toBe(0);
			expect(areas.standardCount).toBe(values.standard);
			expect(areas.specialCount).toBe(values.special);
			expect(standardShare(areas)).toBeCloseTo(values.share, 4);
		});
	}

	it('covers the whole net facade area of the house with modules', () => {
		const totals = project.walls
			.map(computeWallAreas)
			.reduce((sum, a) => ({ net: sum.net + a.netMm2, covered: sum.covered + a.coveredMm2 }), {
				net: 0,
				covered: 0
			});
		expect(mm2ToM2(totals.net)).toBeCloseTo(168.3, 6);
		expect(totals.covered).toBe(totals.net);
	});
});
