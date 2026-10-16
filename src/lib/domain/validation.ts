/**
 * Semantic validation on top of the structural schema. Structural errors make a document
 * unusable; semantic issues are reported with a severity so the UI can still open a slightly
 * imperfect project while telling the user what is wrong.
 */
import { rectContains, rectsOverlap, wallRect } from './geometry';
import type { FacadeProject } from './project';

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
	severity: IssueSeverity;
	code: string;
	/** Human readable message in German (customer facing). */
	message: string;
	/** JSON path to the offending element, e.g. `walls[0].modules[3]`. */
	path: string;
}

function duplicates(values: readonly string[]): string[] {
	const seen = new Set<string>();
	const repeated = new Set<string>();
	for (const value of values) {
		if (seen.has(value)) repeated.add(value);
		seen.add(value);
	}
	return [...repeated];
}

export function validateProjectSemantics(project: FacadeProject): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	for (const id of duplicates(project.walls.map((w) => w.id))) {
		issues.push({
			severity: 'error',
			code: 'duplicate_wall_id',
			message: `Die Wand-ID „${id}“ kommt mehrfach vor.`,
			path: 'walls'
		});
	}
	for (const id of duplicates(project.surfaces.map((s) => s.id))) {
		issues.push({
			severity: 'error',
			code: 'duplicate_surface_id',
			message: `Die Oberflächen-ID „${id}“ kommt mehrfach vor.`,
			path: 'surfaces'
		});
	}
	project.surfaces.forEach((surface, s) => {
		for (const color of duplicates(surface.colors)) {
			issues.push({
				severity: 'warning',
				code: 'duplicate_color',
				message: `Die Farbe „${color}“ ist bei „${surface.name}“ doppelt angegeben.`,
				path: `surfaces[${s}].colors`
			});
		}
	});

	project.walls.forEach((wall, w) => {
		const bounds = wallRect(wall);
		const wallName = wall.label ?? wall.id;

		for (const id of duplicates(wall.modules.map((m) => m.id))) {
			issues.push({
				severity: 'error',
				code: 'duplicate_module_id',
				message: `Das Modul „${id}“ kommt auf der Wand „${wallName}“ mehrfach vor.`,
				path: `walls[${w}].modules`
			});
		}

		wall.openings.forEach((opening, o) => {
			if (!rectContains(bounds, opening)) {
				issues.push({
					severity: 'warning',
					code: 'opening_outside_wall',
					message: `Eine Öffnung auf der Wand „${wallName}“ ragt über den Wandrand hinaus.`,
					path: `walls[${w}].openings[${o}]`
				});
			}
		});

		wall.modules.forEach((module, m) => {
			if (!rectContains(bounds, module)) {
				issues.push({
					severity: 'warning',
					code: 'module_outside_wall',
					message: `Modul „${module.id}“ ragt über den Rand der Wand „${wallName}“ hinaus. Es wird nur der Teil auf der Wand berechnet.`,
					path: `walls[${w}].modules[${m}]`
				});
			}
			if (wall.openings.some((opening) => rectsOverlap(opening, module))) {
				issues.push({
					severity: 'warning',
					code: 'module_overlaps_opening',
					message: `Modul „${module.id}“ überdeckt ein Fenster oder eine Tür. Die überdeckte Fläche wird nicht berechnet.`,
					path: `walls[${w}].modules[${m}]`
				});
			}
		});

		// Pairwise overlap check, sorted sweep keeps this cheap for a few hundred modules.
		const sorted = wall.modules
			.map((module, index) => ({ module, index }))
			.sort((a, b) => a.module.x_mm - b.module.x_mm);
		for (let i = 0; i < sorted.length; i++) {
			const a = sorted[i]!;
			for (let j = i + 1; j < sorted.length; j++) {
				const b = sorted[j]!;
				if (b.module.x_mm >= a.module.x_mm + a.module.width_mm) break;
				if (rectsOverlap(a.module, b.module)) {
					issues.push({
						severity: 'warning',
						code: 'modules_overlap',
						message: `Die Module „${a.module.id}“ und „${b.module.id}“ überlappen sich. Die gemeinsame Fläche wird nur einmal berechnet.`,
						path: `walls[${w}].modules[${b.index}]`
					});
				}
			}
		}
	});

	return issues;
}
