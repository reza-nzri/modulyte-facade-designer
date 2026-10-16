/**
 * Versioned export contract "modulyte.facade-design" v1.
 *
 * The export embeds the unchanged source project, the customer's design (the only editable
 * state) and a derived, human/machine readable summary (per-wall prices, module assignments).
 * On import only `source` and `design` are trusted; derived data is recomputed and compared.
 */
import { z } from 'zod';
import {
	facadeProjectSchema,
	findSurface,
	formatCents,
	getModuleFinish,
	isModuleOverridden,
	mm2ToM2,
	PRICING_METHOD,
	priceProject,
	type FacadeDesign,
	type FacadeProject
} from '$lib/domain';
import { computeProjectKey } from './projectKey';

export const DESIGN_DOCUMENT_FORMAT = 'modulyte.facade-design';
export const DESIGN_DOCUMENT_VERSION = 1;
export const APP_NAME = 'modulyte-facade-designer';
export const APP_VERSION = '0.1.0';

export const finishSchema = z.object({
	surfaceId: z.string().min(1),
	color: z.string().min(1)
});

export const facadeDesignSchema = z.object({
	wallFinishes: z.record(z.string(), finishSchema),
	moduleOverrides: z.record(z.string(), z.record(z.string(), finishSchema)).default({})
});

const round2 = (value: number) => Math.round(value * 100) / 100;
const round4 = (value: number) => Math.round(value * 10_000) / 10_000;

export const designDocumentSchema = z.object({
	format: z.literal(DESIGN_DOCUMENT_FORMAT),
	formatVersion: z.literal(DESIGN_DOCUMENT_VERSION),
	exportedAt: z.string().optional(),
	app: z.object({ name: z.string(), version: z.string() }).partial().optional(),
	variantName: z.string().optional(),
	customerNote: z.string().optional(),
	projectKey: z.string().optional(),
	source: facadeProjectSchema,
	design: facadeDesignSchema,
	summary: z.looseObject({ totalEur: z.number() }).optional()
});

export type DesignDocument = z.infer<typeof designDocumentSchema>;

export interface ExportOptions {
	variantName?: string;
	customerNote?: string;
	exportedAt?: Date;
}

export const PRICING_ASSUMPTIONS_DE = [
	'Preisbasis: belegte Modulfläche je Wand × m²-Preis der gewählten Oberfläche (laut Projektdaten).',
	'Fenster- und Türflächen werden nicht berechnet; jedes Modul wird genau einmal gezählt.',
	'Rundung auf volle Cent je Wand und Oberfläche; Summen sind exakte Summen dieser Positionen.',
	'Nicht enthalten: Dämmmodule, Unterkonstruktion, Laibungen, Verschnitt, Montage, Transport und Mehrwertsteuer.',
	'Unverbindliche Schätzung auf Basis der Projektdaten, kein Angebot.'
] as const;

/** Builds the complete export document for a project and design. */
export function buildDesignDocument(
	project: FacadeProject,
	design: FacadeDesign,
	options: ExportOptions = {}
) {
	const price = priceProject(project, design);
	return {
		format: DESIGN_DOCUMENT_FORMAT,
		formatVersion: DESIGN_DOCUMENT_VERSION,
		exportedAt: (options.exportedAt ?? new Date()).toISOString(),
		app: { name: APP_NAME, version: APP_VERSION },
		variantName: options.variantName ?? 'Mein Fassadenentwurf',
		...(options.customerNote ? { customerNote: options.customerNote } : {}),
		projectKey: computeProjectKey(project),
		source: project,
		design,
		summary: {
			currency: price.currency,
			pricingMethod: PRICING_METHOD,
			assumptions: [...PRICING_ASSUMPTIONS_DE],
			totalEur: price.totalCents / 100,
			totalFormatted: formatCents(price.totalCents),
			totalCladdingAreaM2: round4(mm2ToM2(price.totalAreaMm2)),
			materials: price.lines.map((line) => ({
				surfaceId: line.surfaceId,
				surfaceName: line.surfaceName,
				color: line.color,
				eurPerM2: line.eurPerM2,
				areaM2: round4(mm2ToM2(line.areaMm2)),
				moduleCount: line.moduleCount,
				costEur: line.costCents / 100
			})),
			walls: price.walls.map((wall) => {
				const finish = design.wallFinishes[wall.wallId];
				return {
					wallId: wall.wallId,
					label: wall.label,
					defaultFinish: finish
						? {
								...finish,
								surfaceName: findSurface(project, finish.surfaceId)?.name ?? finish.surfaceId
							}
						: null,
					grossAreaM2: round4(mm2ToM2(wall.areas.grossMm2)),
					openingsAreaM2: round4(mm2ToM2(wall.areas.openingsMm2)),
					netAreaM2: round4(mm2ToM2(wall.areas.netMm2)),
					claddingAreaM2: round4(mm2ToM2(wall.areas.coveredMm2)),
					uncoveredAreaM2: round4(mm2ToM2(wall.areas.uncoveredMm2)),
					standardModules: wall.areas.standardCount,
					specialModules: wall.areas.specialCount,
					individuallyStyledModules: wall.modules.filter((m) => m.overridden).length,
					lines: wall.lines.map((line) => ({
						surfaceId: line.surfaceId,
						surfaceName: line.surfaceName,
						color: line.color,
						eurPerM2: line.eurPerM2,
						areaM2: round4(mm2ToM2(line.areaMm2)),
						moduleCount: line.moduleCount,
						costEur: line.costCents / 100
					})),
					totalEur: wall.totalCents / 100
				};
			}),
			moduleAssignments: project.walls.flatMap((wall) => {
				const wallPrice = price.walls.find((w) => w.wallId === wall.id);
				return wall.modules.map((module) => {
					const finish = getModuleFinish(design, wall.id, module.id);
					const modulePrice = wallPrice?.modules.find((m) => m.moduleId === module.id);
					return {
						wallId: wall.id,
						moduleId: module.id,
						type: module.type,
						x_mm: module.x_mm,
						y_mm: module.y_mm,
						width_mm: module.width_mm,
						height_mm: module.height_mm,
						areaM2: round4(mm2ToM2(modulePrice?.areaMm2 ?? 0)),
						surfaceId: finish?.surfaceId ?? null,
						color: finish?.color ?? null,
						individuallyStyled: isModuleOverridden(design, wall.id, module.id),
						costEur: round2((modulePrice?.costCentsExact ?? 0) / 100)
					};
				});
			})
		}
	};
}

export function serializeDesignDocument(document: ReturnType<typeof buildDesignDocument>): string {
	return `${JSON.stringify(document, null, 2)}\n`;
}

/** File name like `fassade-single-family-house-musterstrasse-12-2026-10-17.json`. */
export function suggestExportFileName(projectName: string, date = new Date()): string {
	const slug = projectName
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
	return `fassade-${slug || 'projekt'}-${date.toISOString().slice(0, 10)}.json`;
}
