import { describe, expect, it } from 'vitest';
import {
	moduleAtPoint,
	modulesInRect,
	selectPreset,
	SELECTION_PRESETS,
	toggleInSelection
} from './selection';
import { createTinyProject, getWall, loadExampleProject } from '$lib/testing/fixtures';

describe('selection presets on the example house', () => {
	const project = loadExampleProject();
	const south = getWall(project, 'south');

	it('selects the plinth row (13 modules on the south wall)', () => {
		const ids = selectPreset(south, 'plinth');
		expect(ids).toHaveLength(13);
		expect(ids).toContain('S-001');
		expect(ids).toContain('X-002');
	});

	it('selects the right edge column made of special modules', () => {
		const ids = selectPreset(south, 'right-edge');
		expect(ids).toHaveLength(11);
		expect(ids.every((id) => id.startsWith('X-'))).toBe(true);
	});

	it('selects all special modules and all modules', () => {
		expect(selectPreset(south, 'special-modules')).toHaveLength(22);
		expect(selectPreset(south, 'standard-modules')).toHaveLength(121);
		expect(selectPreset(south, 'all')).toHaveLength(143);
	});

	it('selects modules adjacent to openings', () => {
		const ids = selectPreset(south, 'around-openings');
		expect(ids.length).toBeGreaterThan(0);
		// X-001 sits directly right of the terrace door (x = 3500).
		expect(ids).toContain('X-001');
		// S-001 at the bottom-left corner does not touch any opening.
		expect(ids).not.toContain('S-001');
	});

	it('every preset works on every wall', () => {
		for (const wall of project.walls) {
			for (const preset of SELECTION_PRESETS) {
				expect(selectPreset(wall, preset.id).length).toBeGreaterThan(0);
			}
		}
	});
});

describe('geometric selection', () => {
	const wall = createTinyProject().walls[0]!;

	it('finds modules by rectangle (intersect and contain)', () => {
		expect(
			modulesInRect(wall, { x_mm: 900, y_mm: 400, width_mm: 200, height_mm: 200 }).sort()
		).toEqual(['A', 'B', 'C']);
		expect(
			modulesInRect(wall, { x_mm: 0, y_mm: 0, width_mm: 1000, height_mm: 1000 }, 'contain').sort()
		).toEqual(['A', 'C']);
	});

	it('finds the module at a point', () => {
		expect(moduleAtPoint(wall, 1600, 600)?.id).toBe('D');
		expect(moduleAtPoint(wall, 1200, 700)).toBeUndefined();
	});

	it('toggles selections like shift-click', () => {
		expect(toggleInSelection(['A'], ['B'])).toEqual(['A', 'B']);
		expect(toggleInSelection(['A', 'B'], ['B'])).toEqual(['A']);
		expect(toggleInSelection(['A'], ['A', 'B'])).toEqual(['A', 'B']);
	});
});
