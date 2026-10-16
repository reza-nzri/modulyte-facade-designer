import { describe, expect, it } from 'vitest';
import { applyFinishToAllWalls, applyModuleFinish, createDefaultDesign } from '$lib/domain';
import { loadExampleProject } from '$lib/testing/fixtures';
import { compareDesigns } from './variantComparison';

describe('compareDesigns', () => {
	const project = loadExampleProject();
	const clinker = applyFinishToAllWalls(createDefaultDesign(project), project, {
		surfaceId: 'clinker',
		color: 'red'
	});
	const rockpanel = applyFinishToAllWalls(createDefaultDesign(project), project, {
		surfaceId: 'rockpanel',
		color: 'white'
	});
	const mixed = applyModuleFinish(rockpanel, 'south', ['S-001'], {
		surfaceId: 'clinker',
		color: 'sand'
	});

	it('prices each design and finds the cheapest', () => {
		const result = compareDesigns(project, [
			{ key: 'a', name: 'Klinker', design: clinker },
			{ key: 'b', name: 'Rockpanel', design: rockpanel }
		]);
		expect(result.designs.map((d) => d.totalCents)).toEqual([1_598_850, 1_178_100]);
		expect(result.cheapestKey).toBe('b');
		expect(result.differingWalls.size).toBe(4);
	});

	it('only flags walls that actually differ', () => {
		const result = compareDesigns(project, [
			{ key: 'b', name: 'Rockpanel', design: rockpanel },
			{ key: 'c', name: 'Mit Klinker-Modul', design: mixed }
		]);
		expect([...result.differingWalls]).toEqual(['south']);
		expect(result.designs[1]!.walls.find((w) => w.wallId === 'south')!.individualModules).toBe(1);
	});

	it('has no cheapest entry for a single design', () => {
		expect(
			compareDesigns(project, [{ key: 'a', name: 'A', design: clinker }]).cheapestKey
		).toBeNull();
	});
});
