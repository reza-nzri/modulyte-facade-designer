/** Test helpers (node only). Not imported by application code. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { facadeProjectSchema, type FacadeProject, type Wall } from '$lib/domain';

export function loadExampleRaw(): unknown {
	const path = resolve(process.cwd(), 'static/projects/fassadendesigner_house.json');
	return JSON.parse(readFileSync(path, 'utf8'));
}

export function loadExampleProject(): FacadeProject {
	return facadeProjectSchema.parse(loadExampleRaw());
}

export function getWall(project: FacadeProject, id: string): Wall {
	const wall = project.walls.find((w) => w.id === id);
	if (!wall) throw new Error(`wall ${id} missing in fixture`);
	return wall;
}

/** Small synthetic project: one 2000×1000 wall, one window, four modules, two surfaces. */
export function createTinyProject(): FacadeProject {
	return facadeProjectSchema.parse({
		project: 'Tiny test house',
		walls: [
			{
				id: 'front',
				label: 'Front',
				width_mm: 2000,
				height_mm: 1000,
				openings: [
					{ id: 'front-o1', type: 'window', x_mm: 1000, y_mm: 500, width_mm: 500, height_mm: 500 }
				],
				modules: [
					{ id: 'A', type: 'standard', x_mm: 0, y_mm: 0, width_mm: 1000, height_mm: 500 },
					{ id: 'B', type: 'standard', x_mm: 1000, y_mm: 0, width_mm: 1000, height_mm: 500 },
					{ id: 'C', type: 'standard', x_mm: 0, y_mm: 500, width_mm: 1000, height_mm: 500 },
					{ id: 'D', type: 'special', x_mm: 1500, y_mm: 500, width_mm: 500, height_mm: 500 }
				]
			}
		],
		surfaces: [
			{ id: 'wood', name: 'Wood', colors: ['natural', 'grey'], eur_per_m2: 80 },
			{ id: 'brick', name: 'Brick', colors: ['red'], eur_per_m2: 95.5 }
		]
	});
}
