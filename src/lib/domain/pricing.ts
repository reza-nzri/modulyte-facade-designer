/**
 * Price calculation for a customer design.
 *
 * Method ("module-area"): every module contributes its cladding area (module ∩ wall − openings,
 * never counted twice) multiplied by the EUR/m² rate of the finish applied to it. Costs are
 * aggregated per wall and per (surface, colour) line. Rounding happens once per wall line;
 * wall totals and the project total are exact sums of those rounded lines, so the displayed
 * breakdown always adds up.
 *
 * Deliberately NOT included (no data in the project file): insulation modules, substructure,
 * reveals, waste, installation labour, transport, VAT. See docs/PRICING.md.
 */
import { computeModuleCladdingAreas } from './claddingArea';
import { getModuleFinish, isModuleOverridden, type FacadeDesign } from './design';
import { computeWallAreas, type WallAreas } from './geometry';
import { costForArea, type Cents } from './money';
import { findSurface, type FacadeModule, type FacadeProject, type Wall } from './project';

export const PRICING_METHOD = 'module-area' as const;

export interface PriceLine {
	surfaceId: string;
	surfaceName: string;
	color: string;
	eurPerM2: number;
	areaMm2: number;
	moduleCount: number;
	costCents: Cents;
}

export interface ModulePrice {
	moduleId: string;
	type: FacadeModule['type'];
	surfaceId: string | null;
	color: string | null;
	overridden: boolean;
	areaMm2: number;
	/** Unrounded share for display only; totals are computed from rounded lines. */
	costCentsExact: number;
}

export interface WallPrice {
	wallId: string;
	label: string;
	areas: WallAreas;
	lines: PriceLine[];
	modules: ModulePrice[];
	/** Area of modules without a valid finish (should be 0 for sanitised designs). */
	unpricedAreaMm2: number;
	totalCents: Cents;
}

export interface ProjectPrice {
	method: typeof PRICING_METHOD;
	currency: 'EUR';
	walls: WallPrice[];
	/** Lines aggregated over all walls (sum of rounded wall lines). */
	lines: PriceLine[];
	totalAreaMm2: number;
	totalCents: Cents;
}

function lineKey(surfaceId: string, color: string): string {
	return `${surfaceId}\u0000${color}`;
}

export function priceWall(project: FacadeProject, design: FacadeDesign, wall: Wall): WallPrice {
	const claddingAreas = computeModuleCladdingAreas(wall);
	const groups = new Map<string, Omit<PriceLine, 'costCents'>>();
	const modules: ModulePrice[] = [];
	let unpricedAreaMm2 = 0;

	for (const module of wall.modules) {
		const areaMm2 = claddingAreas.get(module.id) ?? 0;
		const finish = getModuleFinish(design, wall.id, module.id);
		const surface = finish ? findSurface(project, finish.surfaceId) : undefined;
		const colorIsValid = !!finish && !!surface && surface.colors.includes(finish.color);
		if (!finish || !surface || !colorIsValid) {
			unpricedAreaMm2 += areaMm2;
			modules.push({
				moduleId: module.id,
				type: module.type,
				surfaceId: null,
				color: null,
				overridden: false,
				areaMm2,
				costCentsExact: 0
			});
			continue;
		}
		const key = lineKey(surface.id, finish.color);
		const group = groups.get(key) ?? {
			surfaceId: surface.id,
			surfaceName: surface.name,
			color: finish.color,
			eurPerM2: surface.eur_per_m2,
			areaMm2: 0,
			moduleCount: 0
		};
		group.areaMm2 += areaMm2;
		group.moduleCount += 1;
		groups.set(key, group);
		modules.push({
			moduleId: module.id,
			type: module.type,
			surfaceId: surface.id,
			color: finish.color,
			overridden: isModuleOverridden(design, wall.id, module.id),
			areaMm2,
			costCentsExact: (areaMm2 * surface.eur_per_m2 * 100) / 1_000_000
		});
	}

	const lines: PriceLine[] = [...groups.values()]
		.map((group) => ({ ...group, costCents: costForArea(group.areaMm2, group.eurPerM2) }))
		.sort((a, b) => b.areaMm2 - a.areaMm2);

	return {
		wallId: wall.id,
		label: wall.label ?? wall.id,
		areas: computeWallAreas(wall),
		lines,
		modules,
		unpricedAreaMm2,
		totalCents: lines.reduce((sum, line) => sum + line.costCents, 0)
	};
}

export function priceProject(project: FacadeProject, design: FacadeDesign): ProjectPrice {
	const walls = project.walls.map((wall) => priceWall(project, design, wall));
	const aggregated = new Map<string, PriceLine>();
	for (const wall of walls) {
		for (const line of wall.lines) {
			const key = lineKey(line.surfaceId, line.color);
			const existing = aggregated.get(key);
			if (existing) {
				existing.areaMm2 += line.areaMm2;
				existing.moduleCount += line.moduleCount;
				existing.costCents += line.costCents;
			} else {
				aggregated.set(key, { ...line });
			}
		}
	}
	return {
		method: PRICING_METHOD,
		currency: 'EUR',
		walls,
		lines: [...aggregated.values()].sort((a, b) => b.costCents - a.costCents),
		totalAreaMm2: walls.reduce((sum, wall) => sum + wall.areas.coveredMm2, 0),
		totalCents: walls.reduce((sum, wall) => sum + wall.totalCents, 0)
	};
}

/** Price of a hypothetical finish on a set of modules, used for "what would it cost" hints. */
export function previewCostForModules(
	project: FacadeProject,
	wall: Wall,
	moduleIds: readonly string[],
	surfaceId: string
): Cents {
	const surface = findSurface(project, surfaceId);
	if (!surface) return 0;
	const areas = computeModuleCladdingAreas(wall);
	const area = moduleIds.reduce((sum, id) => sum + (areas.get(id) ?? 0), 0);
	return costForArea(area, surface.eur_per_m2);
}
