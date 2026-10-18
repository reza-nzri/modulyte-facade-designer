/**
 * Pure geometry helpers. All inputs and outputs are millimetres (lengths) or square millimetres
 * (areas). Conversion to m² happens only at the edges (pricing output, UI formatting) to avoid
 * floating point drift in intermediate sums.
 */
import type { Rect, Wall } from './project';

export const MM2_PER_M2 = 1_000_000;

export function rectArea(rect: Rect): number {
	return rect.width_mm * rect.height_mm;
}

export function mm2ToM2(areaMm2: number): number {
	return areaMm2 / MM2_PER_M2;
}

/** Area of the intersection of two rectangles (0 when they only touch or are disjoint). */
export function intersectionArea(a: Rect, b: Rect): number {
	const width = Math.min(a.x_mm + a.width_mm, b.x_mm + b.width_mm) - Math.max(a.x_mm, b.x_mm);
	const height = Math.min(a.y_mm + a.height_mm, b.y_mm + b.height_mm) - Math.max(a.y_mm, b.y_mm);
	return width > 0 && height > 0 ? width * height : 0;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
	return intersectionArea(a, b) > 0;
}

/** True when `inner` lies completely inside `outer` (edges may coincide). */
export function rectContains(outer: Rect, inner: Rect): boolean {
	return (
		inner.x_mm >= outer.x_mm &&
		inner.y_mm >= outer.y_mm &&
		inner.x_mm + inner.width_mm <= outer.x_mm + outer.width_mm &&
		inner.y_mm + inner.height_mm <= outer.y_mm + outer.height_mm
	);
}

/** True when two rectangles share at least part of an edge or overlap. */
export function rectsTouch(a: Rect, b: Rect): boolean {
	const horizontalGap =
		Math.max(a.x_mm, b.x_mm) - Math.min(a.x_mm + a.width_mm, b.x_mm + b.width_mm);
	const verticalGap =
		Math.max(a.y_mm, b.y_mm) - Math.min(a.y_mm + a.height_mm, b.y_mm + b.height_mm);
	// Corner-only contact (both gaps exactly 0) is not considered touching.
	if (horizontalGap === 0 && verticalGap === 0) return false;
	return horizontalGap <= 0 && verticalGap <= 0;
}

/** Normalises a rectangle defined by two arbitrary corner points. */
export function rectFromPoints(ax: number, ay: number, bx: number, by: number): Rect {
	return {
		x_mm: Math.min(ax, bx),
		y_mm: Math.min(ay, by),
		width_mm: Math.abs(bx - ax),
		height_mm: Math.abs(by - ay)
	};
}

export function wallRect(wall: Wall): Rect {
	return { x_mm: 0, y_mm: 0, width_mm: wall.width_mm, height_mm: wall.height_mm };
}

export interface WallAreas {
	/** Full wall rectangle. */
	grossMm2: number;
	/** Sum of opening areas clipped to the wall (overlapping openings are counted once). */
	openingsMm2: number;
	/** Gross minus openings: the area that could be clad. */
	netMm2: number;
	/** Area covered by modules (clipped to the wall, minus overlaps with openings). */
	coveredMm2: number;
	/** Net area not covered by any module (gaps in the supplied layout plan). */
	uncoveredMm2: number;
	standardMm2: number;
	specialMm2: number;
	standardCount: number;
	specialCount: number;
}

/**
 * Exact area of the union of rectangles via coordinate compression. Sufficient for the small
 * rectangle counts of a facade (a few hundred) and immune to double counting of overlaps.
 */
export function unionArea(rects: readonly Rect[]): number {
	const valid = rects.filter((r) => r.width_mm > 0 && r.height_mm > 0);
	if (valid.length === 0) return 0;
	const xs = [...new Set(valid.flatMap((r) => [r.x_mm, r.x_mm + r.width_mm]))].sort(
		(a, b) => a - b
	);
	let area = 0;
	for (let i = 0; i < xs.length - 1; i++) {
		const x0 = xs[i]!;
		const x1 = xs[i + 1]!;
		const intervals = valid
			.filter((r) => r.x_mm <= x0 && r.x_mm + r.width_mm >= x1)
			.map((r) => [r.y_mm, r.y_mm + r.height_mm] as const)
			.sort((a, b) => a[0] - b[0]);
		let covered = 0;
		let currentStart = Number.NEGATIVE_INFINITY;
		let currentEnd = Number.NEGATIVE_INFINITY;
		for (const [start, end] of intervals) {
			if (start > currentEnd) {
				if (currentEnd > currentStart) covered += currentEnd - currentStart;
				currentStart = start;
				currentEnd = end;
			} else if (end > currentEnd) {
				currentEnd = end;
			}
		}
		if (currentEnd > currentStart) covered += currentEnd - currentStart;
		area += covered * (x1 - x0);
	}
	return area;
}

function clipToWall(rect: Rect, wall: Rect): Rect | null {
	const x0 = Math.max(rect.x_mm, wall.x_mm);
	const y0 = Math.max(rect.y_mm, wall.y_mm);
	const x1 = Math.min(rect.x_mm + rect.width_mm, wall.x_mm + wall.width_mm);
	const y1 = Math.min(rect.y_mm + rect.height_mm, wall.y_mm + wall.height_mm);
	return x1 > x0 && y1 > y0 ? { x_mm: x0, y_mm: y0, width_mm: x1 - x0, height_mm: y1 - y0 } : null;
}

export function computeWallAreas(wall: Wall): WallAreas {
	const bounds = wallRect(wall);
	const grossMm2 = rectArea(bounds);
	const clippedOpenings = wall.openings
		.map((opening) => clipToWall(opening, bounds))
		.filter((r): r is Rect => r !== null);
	const openingsMm2 = unionArea(clippedOpenings);
	const clippedModules = wall.modules
		.map((module) => clipToWall(module, bounds))
		.filter((r): r is Rect => r !== null);
	const coveredMm2 = unionArea([...clippedModules, ...clippedOpenings]) - openingsMm2;
	let standardMm2 = 0;
	let specialMm2 = 0;
	let standardCount = 0;
	let specialCount = 0;
	for (const module of wall.modules) {
		if (module.type === 'standard') {
			standardMm2 += rectArea(module);
			standardCount++;
		} else {
			specialMm2 += rectArea(module);
			specialCount++;
		}
	}
	const netMm2 = grossMm2 - openingsMm2;
	return {
		grossMm2,
		openingsMm2,
		netMm2,
		coveredMm2,
		uncoveredMm2: Math.max(0, netMm2 - coveredMm2),
		standardMm2,
		specialMm2,
		standardCount,
		specialCount
	};
}

/** Share of standard modules on the covered module area (0..1). */
export function standardShare(areas: WallAreas): number {
	const total = areas.standardMm2 + areas.specialMm2;
	return total === 0 ? 0 : areas.standardMm2 / total;
}
