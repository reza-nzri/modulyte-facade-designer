import { describe, expect, it } from 'vitest';
import { computeModuleCladdingAreas } from './claddingArea';
import { facadeProjectSchema } from './project';
import { validateProjectSemantics } from './validation';
import { createTinyProject, loadExampleProject, loadExampleRaw } from '$lib/testing/fixtures';

describe('project schema', () => {
	it('accepts the supplied example file unchanged', () => {
		const result = facadeProjectSchema.safeParse(loadExampleRaw());
		expect(result.success).toBe(true);
	});

	it('rejects negative sizes, unknown module types and empty colour lists', () => {
		const project = structuredClone(loadExampleRaw()) as {
			walls: { width_mm: number; modules: { type: string }[] }[];
			surfaces: { colors: string[] }[];
		};
		project.walls[0]!.width_mm = -1;
		project.walls[0]!.modules[0]!.type = 'giant';
		project.surfaces[0]!.colors = [];
		const result = facadeProjectSchema.safeParse(project);
		expect(result.success).toBe(false);
		expect(result.error?.issues.length).toBeGreaterThanOrEqual(3);
	});

	it('keeps unknown extra fields (forward compatibility)', () => {
		const raw = { ...(loadExampleRaw() as object), customField: { a: 1 } };
		const parsed = facadeProjectSchema.parse(raw) as Record<string, unknown>;
		expect(parsed.customField).toEqual({ a: 1 });
	});
});

describe('semantic validation', () => {
	it('reports no issues for the clean example house', () => {
		expect(validateProjectSemantics(loadExampleProject())).toEqual([]);
	});

	it('reports duplicate ids as errors', () => {
		const project = createTinyProject();
		project.walls[0]!.modules[1]!.id = 'A';
		project.surfaces[1]!.id = 'wood';
		const codes = validateProjectSemantics(project).map((i) => `${i.severity}:${i.code}`);
		expect(codes).toContain('error:duplicate_module_id');
		expect(codes).toContain('error:duplicate_surface_id');
	});

	it('warns about overlaps and out-of-bounds modules', () => {
		const project = createTinyProject();
		project.walls[0]!.modules.push({
			id: 'E',
			type: 'special',
			x_mm: 1800,
			y_mm: 0,
			width_mm: 400,
			height_mm: 500
		});
		const codes = validateProjectSemantics(project).map((i) => i.code);
		expect(codes).toContain('modules_overlap');
		expect(codes).toContain('module_outside_wall');
	});
});

describe('cladding area per module', () => {
	it('equals the module area for clean layouts', () => {
		const areas = computeModuleCladdingAreas(createTinyProject().walls[0]!);
		expect(areas.get('A')).toBe(500_000);
		expect(areas.get('D')).toBe(250_000);
	});

	it('never counts overlapping areas or openings twice', () => {
		const project = createTinyProject();
		const wall = project.walls[0]!;
		// E overlaps B (200×500 inside the wall) and sticks out of the wall by 200 mm.
		wall.modules.push({
			id: 'E',
			type: 'special',
			x_mm: 1800,
			y_mm: 0,
			width_mm: 400,
			height_mm: 500
		});
		// F covers half of the window.
		wall.modules.push({
			id: 'F',
			type: 'special',
			x_mm: 1000,
			y_mm: 500,
			width_mm: 250,
			height_mm: 500
		});
		const areas = computeModuleCladdingAreas(wall);
		expect(areas.get('E')).toBe(0);
		expect(areas.get('F')).toBe(0);
		const total = [...areas.values()].reduce((a, b) => a + b, 0);
		expect(total).toBe(2000 * 1000 - 500 * 500);
	});
});
