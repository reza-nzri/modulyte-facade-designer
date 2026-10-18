/**
 * Computes the area of every module that actually receives cladding.
 *
 * Priced area of a module = module ∩ wall − openings − area already claimed by earlier modules.
 * For clean layout plans (like the supplied example) this equals the plain module area; the
 * exact path only runs when the data contains overlaps, which guarantees no double counting.
 */
import { intersectionArea, rectArea, unionArea, wallRect } from './geometry';
import type { Rect, Wall } from './project';

function clip(rect: Rect, bounds: Rect): Rect | null {
	const x0 = Math.max(rect.x_mm, bounds.x_mm);
	const y0 = Math.max(rect.y_mm, bounds.y_mm);
	const x1 = Math.min(rect.x_mm + rect.width_mm, bounds.x_mm + bounds.width_mm);
	const y1 = Math.min(rect.y_mm + rect.height_mm, bounds.y_mm + bounds.height_mm);
	return x1 > x0 && y1 > y0 ? { x_mm: x0, y_mm: y0, width_mm: x1 - x0, height_mm: y1 - y0 } : null;
}

function hasConflicts(wall: Wall): boolean {
	const bounds = wallRect(wall);
	for (let i = 0; i < wall.modules.length; i++) {
		const module = wall.modules[i]!;
		if (intersectionArea(module, bounds) !== rectArea(module)) return true;
		if (wall.openings.some((opening) => intersectionArea(opening, module) > 0)) return true;
		for (let j = i + 1; j < wall.modules.length; j++) {
			if (intersectionArea(module, wall.modules[j]!) > 0) return true;
		}
	}
	return false;
}

/** Returns a map moduleId → cladding area in mm². */
export function computeModuleCladdingAreas(wall: Wall): Map<string, number> {
	const areas = new Map<string, number>();
	if (!hasConflicts(wall)) {
		for (const module of wall.modules) areas.set(module.id, rectArea(module));
		return areas;
	}
	const bounds = wallRect(wall);
	const claimed: Rect[] = wall.openings.map((o) => clip(o, bounds)).filter((r): r is Rect => !!r);
	let claimedArea = unionArea(claimed);
	for (const module of wall.modules) {
		const clipped = clip(module, bounds);
		if (!clipped) {
			areas.set(module.id, 0);
			continue;
		}
		claimed.push(clipped);
		const nextArea = unionArea(claimed);
		areas.set(module.id, (areas.get(module.id) ?? 0) + (nextArea - claimedArea));
		claimedArea = nextArea;
	}
	return areas;
}
