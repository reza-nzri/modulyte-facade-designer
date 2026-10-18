/**
 * Source project contract (input data supplied by Modulyte).
 *
 * The schema mirrors `fassadendesigner_house.json` exactly. Field names stay in snake_case so
 * that the original document round-trips without any renaming. Units are millimetres, the
 * origin of every wall is its bottom-left corner (x to the right, y upwards).
 */
import { z } from 'zod';

const millimetres = z.number().finite().nonnegative();
const positiveMillimetres = z.number().finite().positive();
const identifier = z.string().trim().min(1);

export const openingTypeSchema = z.enum(['window', 'door']);
export const moduleTypeSchema = z.enum(['standard', 'special']);

export const openingSchema = z.looseObject({
	id: identifier.optional(),
	type: openingTypeSchema,
	x_mm: millimetres,
	y_mm: millimetres,
	width_mm: positiveMillimetres,
	height_mm: positiveMillimetres
});

export const facadeModuleSchema = z.looseObject({
	id: identifier,
	type: moduleTypeSchema,
	x_mm: millimetres,
	y_mm: millimetres,
	width_mm: positiveMillimetres,
	height_mm: positiveMillimetres
});

export const wallSchema = z.looseObject({
	id: identifier,
	label: z.string().optional(),
	width_mm: positiveMillimetres,
	height_mm: positiveMillimetres,
	openings: z.array(openingSchema).default([]),
	modules: z.array(facadeModuleSchema)
});

export const surfaceSchema = z.looseObject({
	id: identifier,
	name: z.string().trim().min(1),
	colors: z.array(z.string().trim().min(1)).min(1),
	eur_per_m2: z.number().finite().nonnegative()
});

export const facadeProjectSchema = z.looseObject({
	project: z.string().trim().min(1),
	walls: z.array(wallSchema).min(1),
	surfaces: z.array(surfaceSchema).min(1)
});

export type OpeningType = z.infer<typeof openingTypeSchema>;
export type ModuleType = z.infer<typeof moduleTypeSchema>;
export type Opening = z.infer<typeof openingSchema>;
export type FacadeModule = z.infer<typeof facadeModuleSchema>;
export type Wall = z.infer<typeof wallSchema>;
export type Surface = z.infer<typeof surfaceSchema>;
export type FacadeProject = z.infer<typeof facadeProjectSchema>;

/** Axis-aligned rectangle in wall coordinates (mm, origin bottom-left). */
export interface Rect {
	x_mm: number;
	y_mm: number;
	width_mm: number;
	height_mm: number;
}

export function findWall(project: FacadeProject, wallId: string): Wall | undefined {
	return project.walls.find((wall) => wall.id === wallId);
}

export function findSurface(project: FacadeProject, surfaceId: string): Surface | undefined {
	return project.surfaces.find((surface) => surface.id === surfaceId);
}

export function findModule(wall: Wall, moduleId: string): FacadeModule | undefined {
	return wall.modules.find((module) => module.id === moduleId);
}
