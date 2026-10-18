/**
 * Places the 2D walls of a project in 3D (pure math, no three.js), so it can be unit tested.
 *
 * Assumption (documented in README): walls with ids south/east/north/west form a rectangular
 * footprint and each wall's x axis runs from left to right as seen from outside (standard
 * elevation drawing convention). Projects without such ids are shown as a row of walls.
 *
 * World axes: x = east, y = up, z = south. Units: millimetres.
 */
import type { Wall } from '$lib/domain';

export interface WallPlacement {
	wallId: string;
	/** Position of the wall's local origin (bottom-left corner seen from outside). */
	origin: { x: number; z: number };
	/** Rotation around the y axis (radians) applied to a wall drawn in the local XY plane facing +Z. */
	rotationY: number;
	/** Outward normal in world space. */
	normal: { x: number; z: number };
}

export interface HouseLayout {
	mode: 'footprint' | 'row';
	placements: WallPlacement[];
	/** Footprint extent (x: east–west length, z: north–south depth). */
	width: number;
	depth: number;
	height: number;
}

const ORIENTATION_ALIASES: Record<string, 'south' | 'east' | 'north' | 'west'> = {
	south: 'south',
	sued: 'south',
	süd: 'south',
	sud: 'south',
	s: 'south',
	east: 'east',
	ost: 'east',
	o: 'east',
	e: 'east',
	north: 'north',
	nord: 'north',
	n: 'north',
	west: 'west',
	w: 'west'
};

export function wallOrientation(
	wall: Pick<Wall, 'id'>
): 'south' | 'east' | 'north' | 'west' | null {
	return ORIENTATION_ALIASES[wall.id.trim().toLowerCase()] ?? null;
}

export function computeHouseLayout(walls: readonly Wall[]): HouseLayout {
	const byOrientation = new Map<string, Wall>();
	for (const wall of walls) {
		const orientation = wallOrientation(wall);
		if (orientation && !byOrientation.has(orientation)) byOrientation.set(orientation, wall);
	}
	const height = Math.max(...walls.map((w) => w.height_mm));

	if (byOrientation.size === 4 && walls.length === 4) {
		const south = byOrientation.get('south')!;
		const north = byOrientation.get('north')!;
		const east = byOrientation.get('east')!;
		const west = byOrientation.get('west')!;
		const width = Math.max(south.width_mm, north.width_mm);
		const depth = Math.max(east.width_mm, west.width_mm);
		const hw = width / 2;
		const hd = depth / 2;
		return {
			mode: 'footprint',
			width,
			depth,
			height,
			placements: [
				{ wallId: south.id, origin: { x: -hw, z: hd }, rotationY: 0, normal: { x: 0, z: 1 } },
				{
					wallId: east.id,
					origin: { x: hw, z: hd },
					rotationY: Math.PI / 2,
					normal: { x: 1, z: 0 }
				},
				{
					wallId: north.id,
					origin: { x: hw, z: -hd },
					rotationY: Math.PI,
					normal: { x: 0, z: -1 }
				},
				{
					wallId: west.id,
					origin: { x: -hw, z: -hd },
					rotationY: -Math.PI / 2,
					normal: { x: -1, z: 0 }
				}
			]
		};
	}

	// Fallback: show all walls side by side, facing the viewer.
	const gap = 1500;
	const total = walls.reduce((sum, w) => sum + w.width_mm, 0) + gap * (walls.length - 1);
	let x = -total / 2;
	const placements = walls.map((wall) => {
		const placement: WallPlacement = {
			wallId: wall.id,
			origin: { x, z: 0 },
			rotationY: 0,
			normal: { x: 0, z: 1 }
		};
		x += wall.width_mm + gap;
		return placement;
	});
	return { mode: 'row', placements, width: total, depth: 2000, height };
}

/**
 * Maps a point on a wall (local x along the wall, seen from outside) to world coordinates.
 * Used by tests to verify the orientation convention.
 */
export function wallPointToWorld(
	placement: WallPlacement,
	localX: number
): { x: number; z: number } {
	const cos = Math.cos(placement.rotationY);
	const sin = Math.sin(placement.rotationY);
	// Rotation around y: x' = x·cos + z·sin, z' = −x·sin + z·cos (local z = 0).
	return {
		x: placement.origin.x + localX * cos,
		z: placement.origin.z - localX * sin
	};
}
