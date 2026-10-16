/** Builds a comparison table of designs (pure, unit tested). */
import { findSurface, priceProject, type FacadeDesign, type FacadeProject } from '$lib/domain';

export interface ComparedWall {
	wallId: string;
	surfaceId: string | null;
	surfaceName: string | null;
	color: string | null;
	individualModules: number;
	totalCents: number;
}

export interface ComparedDesign {
	key: string;
	name: string;
	totalCents: number;
	walls: ComparedWall[];
}

export interface Comparison {
	designs: ComparedDesign[];
	/** Wall ids whose finish or price differs between at least two designs. */
	differingWalls: Set<string>;
	cheapestKey: string | null;
}

export function compareDesigns(
	project: FacadeProject,
	entries: readonly { key: string; name: string; design: FacadeDesign }[]
): Comparison {
	const designs = entries.map(({ key, name, design }) => {
		const price = priceProject(project, design);
		return {
			key,
			name,
			totalCents: price.totalCents,
			walls: project.walls.map((wall) => {
				const finish = design.wallFinishes[wall.id];
				const surface = finish ? findSurface(project, finish.surfaceId) : undefined;
				return {
					wallId: wall.id,
					surfaceId: finish?.surfaceId ?? null,
					surfaceName: surface?.name ?? null,
					color: finish?.color ?? null,
					individualModules: Object.keys(design.moduleOverrides[wall.id] ?? {}).length,
					totalCents: price.walls.find((w) => w.wallId === wall.id)?.totalCents ?? 0
				};
			})
		};
	});

	const differingWalls = new Set<string>();
	for (const wall of project.walls) {
		const signatures = new Set(
			designs.map((d) => {
				const w = d.walls.find((x) => x.wallId === wall.id);
				return `${w?.surfaceId}|${w?.color}|${w?.individualModules}|${w?.totalCents}`;
			})
		);
		if (signatures.size > 1) differingWalls.add(wall.id);
	}

	const cheapest =
		designs.length > 1 ? [...designs].sort((a, b) => a.totalCents - b.totalCents)[0] : undefined;
	return { designs, differingWalls, cheapestKey: cheapest?.key ?? null };
}
