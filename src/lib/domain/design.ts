/**
 * Customer design state: which surface (cladding material) and colour is applied where.
 *
 * Model: every wall has a default finish; individual modules may override it. The model is a
 * plain serialisable object and every operation is a pure function returning a new object,
 * which makes undo/redo, variants and export trivial.
 */
import { findSurface, type FacadeProject } from './project';

export interface Finish {
	surfaceId: string;
	color: string;
}

export interface FacadeDesign {
	/** Default finish per wall id. */
	wallFinishes: Record<string, Finish>;
	/** Per wall id: module id → finish that differs from the wall default. */
	moduleOverrides: Record<string, Record<string, Finish>>;
}

export function finishesEqual(a: Finish | undefined, b: Finish | undefined): boolean {
	return !!a && !!b && a.surfaceId === b.surfaceId && a.color === b.color;
}

export function isValidFinish(project: FacadeProject, finish: Finish): boolean {
	const surface = findSurface(project, finish.surfaceId);
	return !!surface && surface.colors.includes(finish.color);
}

/** The initial design: every wall gets the first surface with its first colour. */
export function createDefaultDesign(project: FacadeProject): FacadeDesign {
	const surface = project.surfaces[0];
	const color = surface?.colors[0];
	const wallFinishes: Record<string, Finish> = {};
	if (surface && color) {
		for (const wall of project.walls) wallFinishes[wall.id] = { surfaceId: surface.id, color };
	}
	return { wallFinishes, moduleOverrides: {} };
}

export function getWallFinish(design: FacadeDesign, wallId: string): Finish | undefined {
	return design.wallFinishes[wallId];
}

/** Effective finish of a module: its override or, if none, the wall default. */
export function getModuleFinish(
	design: FacadeDesign,
	wallId: string,
	moduleId: string
): Finish | undefined {
	return design.moduleOverrides[wallId]?.[moduleId] ?? design.wallFinishes[wallId];
}

export function isModuleOverridden(
	design: FacadeDesign,
	wallId: string,
	moduleId: string
): boolean {
	return !!design.moduleOverrides[wallId]?.[moduleId];
}

/** Removes overrides that equal the wall default and empty wall entries. */
export function normalizeDesign(design: FacadeDesign): FacadeDesign {
	const moduleOverrides: Record<string, Record<string, Finish>> = {};
	for (const [wallId, overrides] of Object.entries(design.moduleOverrides)) {
		const wallFinish = design.wallFinishes[wallId];
		const kept: Record<string, Finish> = {};
		for (const [moduleId, finish] of Object.entries(overrides)) {
			if (!finishesEqual(finish, wallFinish)) kept[moduleId] = { ...finish };
		}
		if (Object.keys(kept).length > 0) moduleOverrides[wallId] = kept;
	}
	const wallFinishes: Record<string, Finish> = {};
	for (const [wallId, finish] of Object.entries(design.wallFinishes)) {
		wallFinishes[wallId] = { ...finish };
	}
	return { wallFinishes, moduleOverrides };
}

/**
 * Applies a finish to a whole wall. Individual module areas keep their own finish unless
 * `resetModules` is set, so a chosen base zone (e.g. clinker plinth) survives a wall change.
 */
export function applyWallFinish(
	design: FacadeDesign,
	wallId: string,
	finish: Finish,
	options: { resetModules?: boolean } = {}
): FacadeDesign {
	const next: FacadeDesign = {
		wallFinishes: { ...design.wallFinishes, [wallId]: { ...finish } },
		moduleOverrides: { ...design.moduleOverrides }
	};
	if (options.resetModules) delete next.moduleOverrides[wallId];
	return normalizeDesign(next);
}

/** Applies a finish to the given modules of one wall. */
export function applyModuleFinish(
	design: FacadeDesign,
	wallId: string,
	moduleIds: readonly string[],
	finish: Finish
): FacadeDesign {
	const overrides = { ...(design.moduleOverrides[wallId] ?? {}) };
	for (const moduleId of moduleIds) overrides[moduleId] = { ...finish };
	return normalizeDesign({
		wallFinishes: design.wallFinishes,
		moduleOverrides: { ...design.moduleOverrides, [wallId]: overrides }
	});
}

/** Lets the given modules inherit the wall finish again. Omit ids to reset the whole wall. */
export function resetModuleFinish(
	design: FacadeDesign,
	wallId: string,
	moduleIds?: readonly string[]
): FacadeDesign {
	const overrides = { ...(design.moduleOverrides[wallId] ?? {}) };
	if (moduleIds) {
		for (const moduleId of moduleIds) delete overrides[moduleId];
	}
	return normalizeDesign({
		wallFinishes: design.wallFinishes,
		moduleOverrides: { ...design.moduleOverrides, [wallId]: moduleIds ? overrides : {} }
	});
}

/** Applies one finish to every wall of the project and clears all module overrides. */
export function applyFinishToAllWalls(
	design: FacadeDesign,
	project: FacadeProject,
	finish: Finish
): FacadeDesign {
	let next = design;
	for (const wall of project.walls)
		next = applyWallFinish(next, wall.id, finish, { resetModules: true });
	return next;
}

export interface DesignIssue {
	message: string;
}

/**
 * Checks a design against a project and returns a cleaned copy. Unknown walls/modules and
 * finishes that are not offered by the project are dropped and reported; walls without a
 * finish get the project default. Used when importing designs from files or storage.
 */
export function sanitizeDesign(
	project: FacadeProject,
	design: FacadeDesign
): { design: FacadeDesign; issues: DesignIssue[] } {
	const issues: DesignIssue[] = [];
	const fallback = createDefaultDesign(project);
	const wallFinishes: Record<string, Finish> = {};
	const moduleOverrides: Record<string, Record<string, Finish>> = {};

	for (const wall of project.walls) {
		const finish = design.wallFinishes?.[wall.id];
		if (finish && isValidFinish(project, finish)) {
			wallFinishes[wall.id] = { surfaceId: finish.surfaceId, color: finish.color };
		} else {
			if (finish) {
				issues.push({
					message: `Die Auswahl für die Wand „${wall.label ?? wall.id}“ ist im Projekt nicht verfügbar und wurde zurückgesetzt.`
				});
			}
			const defaultFinish = fallback.wallFinishes[wall.id];
			if (defaultFinish) wallFinishes[wall.id] = defaultFinish;
		}

		const overrides = design.moduleOverrides?.[wall.id] ?? {};
		const moduleIds = new Set(wall.modules.map((m) => m.id));
		let dropped = 0;
		const kept: Record<string, Finish> = {};
		for (const [moduleId, finish] of Object.entries(overrides)) {
			if (moduleIds.has(moduleId) && isValidFinish(project, finish)) {
				kept[moduleId] = { surfaceId: finish.surfaceId, color: finish.color };
			} else {
				dropped++;
			}
		}
		if (dropped > 0) {
			issues.push({
				message: `${dropped} Modul-Zuweisung(en) auf der Wand „${wall.label ?? wall.id}“ passen nicht zum Projekt und wurden entfernt.`
			});
		}
		moduleOverrides[wall.id] = kept;
	}

	const unknownWalls = Object.keys(design.wallFinishes ?? {}).filter(
		(wallId) => !project.walls.some((wall) => wall.id === wallId)
	);
	if (unknownWalls.length > 0) {
		issues.push({ message: `Unbekannte Wände ignoriert: ${unknownWalls.join(', ')}.` });
	}

	return {
		design: collapseUniformWalls(project, normalizeDesign({ wallFinishes, moduleOverrides })),
		issues
	};
}

/**
 * When every module of a wall carries the same individual finish, that finish becomes the
 * wall finish and the overrides are dropped. The price is unchanged, but the design then
 * describes what the customer actually sees ("whole wall in clinker") instead of an
 * invisible wall default plus hundreds of overrides.
 */
export function collapseUniformWalls(project: FacadeProject, design: FacadeDesign): FacadeDesign {
	let changed = false;
	const wallFinishes = { ...design.wallFinishes };
	const moduleOverrides = { ...design.moduleOverrides };
	for (const wall of project.walls) {
		const overrides = moduleOverrides[wall.id];
		if (!overrides || wall.modules.length === 0) continue;
		const first = overrides[wall.modules[0]!.id];
		if (!first) continue;
		const uniform = wall.modules.every((module) => finishesEqual(overrides[module.id], first));
		if (!uniform) continue;
		wallFinishes[wall.id] = { ...first };
		delete moduleOverrides[wall.id];
		changed = true;
	}
	return changed ? normalizeDesign({ wallFinishes, moduleOverrides }) : design;
}

/** Number of individually styled modules across the whole design. */
export function countOverrides(design: FacadeDesign): number {
	return Object.values(design.moduleOverrides).reduce(
		(sum, overrides) => sum + Object.keys(overrides).length,
		0
	);
}
