/**
 * Module selection helpers. They turn intuitive customer intentions ("the plinth", "around the
 * windows", "this rectangle") into module id lists, independent of any UI framework.
 */
import { rectsOverlap, rectsTouch } from './geometry';
import type { FacadeModule, Rect, Wall } from './project';

export type SelectionPresetId =
	| 'all'
	| 'plinth'
	| 'top-row'
	| 'around-openings'
	| 'special-modules'
	| 'standard-modules'
	| 'left-edge'
	| 'right-edge';

export interface SelectionPreset {
	id: SelectionPresetId;
	label: string;
	description: string;
}

/** Presets offered in the UI, phrased for homeowners. */
export const SELECTION_PRESETS: readonly SelectionPreset[] = [
	{ id: 'all', label: 'Ganze Wand', description: 'Alle Module dieser Wand' },
	{
		id: 'plinth',
		label: 'Sockelzone',
		description: 'Die unterste Modulreihe direkt über dem Boden'
	},
	{
		id: 'top-row',
		label: 'Obere Abschlussreihe',
		description: 'Die oberste Modulreihe unter dem Dach'
	},
	{
		id: 'around-openings',
		label: 'Rund um Fenster & Türen',
		description: 'Alle Module, die direkt an ein Fenster oder eine Tür grenzen'
	},
	{
		id: 'special-modules',
		label: 'Alle Passstücke',
		description: 'Alle auf Maß gefertigten Module (Sondermodule)'
	},
	{
		id: 'standard-modules',
		label: 'Alle Standardmodule',
		description: 'Alle Module im Standardformat'
	},
	{ id: 'left-edge', label: 'Linke Hauskante', description: 'Die linke Modulspalte' },
	{ id: 'right-edge', label: 'Rechte Hauskante', description: 'Die rechte Modulspalte' }
];

function idsOf(modules: readonly FacadeModule[]): string[] {
	return modules.map((m) => m.id);
}

export function modulesInRect(wall: Wall, rect: Rect, mode: 'intersect' | 'contain' = 'intersect') {
	return idsOf(
		wall.modules.filter((m) =>
			mode === 'contain'
				? m.x_mm >= rect.x_mm &&
					m.y_mm >= rect.y_mm &&
					m.x_mm + m.width_mm <= rect.x_mm + rect.width_mm &&
					m.y_mm + m.height_mm <= rect.y_mm + rect.height_mm
				: rectsOverlap(m, rect)
		)
	);
}

export function moduleAtPoint(wall: Wall, x_mm: number, y_mm: number): FacadeModule | undefined {
	return wall.modules.find(
		(m) =>
			x_mm >= m.x_mm && x_mm < m.x_mm + m.width_mm && y_mm >= m.y_mm && y_mm < m.y_mm + m.height_mm
	);
}

/** Modules whose vertical extent contains the given row height (y_mm inside the module). */
function modulesOnRow(wall: Wall, rowY: number): FacadeModule[] {
	return wall.modules.filter((m) => m.y_mm <= rowY && rowY < m.y_mm + m.height_mm);
}

export function selectPreset(wall: Wall, preset: SelectionPresetId): string[] {
	if (wall.modules.length === 0) return [];
	switch (preset) {
		case 'all':
			return idsOf(wall.modules);
		case 'plinth': {
			const minY = Math.min(...wall.modules.map((m) => m.y_mm));
			return idsOf(modulesOnRow(wall, minY));
		}
		case 'top-row': {
			const maxTop = Math.max(...wall.modules.map((m) => m.y_mm + m.height_mm));
			return idsOf(wall.modules.filter((m) => m.y_mm + m.height_mm === maxTop));
		}
		case 'around-openings':
			return idsOf(wall.modules.filter((m) => wall.openings.some((o) => rectsTouch(m, o))));
		case 'special-modules':
			return idsOf(wall.modules.filter((m) => m.type === 'special'));
		case 'standard-modules':
			return idsOf(wall.modules.filter((m) => m.type === 'standard'));
		case 'left-edge': {
			const minX = Math.min(...wall.modules.map((m) => m.x_mm));
			return idsOf(wall.modules.filter((m) => m.x_mm === minX));
		}
		case 'right-edge': {
			const maxRight = Math.max(...wall.modules.map((m) => m.x_mm + m.width_mm));
			return idsOf(wall.modules.filter((m) => m.x_mm + m.width_mm === maxRight));
		}
	}
}

/** Toggles ids in a selection (shift-click behaviour). */
export function toggleInSelection(selection: readonly string[], ids: readonly string[]): string[] {
	const result = new Set(selection);
	const allSelected = ids.every((id) => result.has(id));
	for (const id of ids) {
		if (allSelected) result.delete(id);
		else result.add(id);
	}
	return [...result];
}

/** Removes duplicate ids while keeping the first occurrence order. */
export function uniqueIds(ids: Iterable<string>): string[] {
	return Array.from(new Set(ids));
}
