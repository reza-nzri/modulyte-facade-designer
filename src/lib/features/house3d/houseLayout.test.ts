import { describe, expect, it } from 'vitest';
import { loadExampleProject } from '$lib/testing/fixtures';
import { computeHouseLayout, wallOrientation, wallPointToWorld } from './houseLayout';

const close = (a: { x: number; z: number }, b: { x: number; z: number }) => {
	expect(a.x).toBeCloseTo(b.x, 6);
	expect(a.z).toBeCloseTo(b.z, 6);
};

describe('3D house layout', () => {
	const project = loadExampleProject();
	const layout = computeHouseLayout(project.walls);

	it('recognises the four orientations of the example house', () => {
		expect(layout.mode).toBe('footprint');
		expect(layout.width).toBe(9800);
		expect(layout.depth).toBe(8500);
		expect(layout.height).toBe(5500);
		expect(wallOrientation({ id: 'Süd' })).toBe('south');
	});

	it('closes the footprint: each wall ends where the next one starts (seen from outside)', () => {
		const byId = Object.fromEntries(layout.placements.map((p) => [p.wallId, p]));
		const walls = Object.fromEntries(project.walls.map((w) => [w.id, w]));
		// Walking around the house counter-clockwise seen from above: south → east → north → west.
		const order = ['south', 'east', 'north', 'west'];
		for (let i = 0; i < order.length; i++) {
			const current = order[i]!;
			const next = order[(i + 1) % order.length]!;
			const end = wallPointToWorld(byId[current]!, walls[current]!.width_mm);
			const start = wallPointToWorld(byId[next]!, 0);
			close(end, start);
		}
	});

	it('puts the south wall on the +z side, left end towards the west', () => {
		const south = layout.placements.find((p) => p.wallId === 'south')!;
		close(wallPointToWorld(south, 0), { x: -4900, z: 4250 });
		expect(south.normal).toEqual({ x: 0, z: 1 });
	});

	it('falls back to a row for unknown wall ids', () => {
		const walls = project.walls.map((w, i) => ({ ...w, id: `wall-${i}` }));
		const row = computeHouseLayout(walls);
		expect(row.mode).toBe('row');
		expect(row.placements).toHaveLength(4);
		expect(row.placements[1]!.origin.x).toBeGreaterThan(row.placements[0]!.origin.x);
	});
});
