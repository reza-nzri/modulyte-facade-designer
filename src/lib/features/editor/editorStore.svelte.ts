/**
 * Application state of the facade editor (Svelte 5 runes).
 *
 * The store only orchestrates: every rule (pricing, design operations, selection presets,
 * validation) lives in the framework-free domain layer. Components read state from here and
 * call intent methods; they never compute prices themselves.
 */
import {
	applyModuleFinish,
	collapseUniformWalls,
	applyWallFinish,
	countOverrides,
	findSurface,
	findWall,
	getModuleFinish,
	priceProject,
	resetModuleFinish,
	selectPreset,
	toggleInSelection,
	uniqueIds,
	type FacadeDesign,
	type FacadeProject,
	type Finish,
	type SelectionPresetId
} from '$lib/domain';
import type { ImportResult } from '$lib/io/importDocument';
import { computeProjectKey } from '$lib/io/projectKey';
import { nowIso } from '$lib/observability/clock';
import { logger } from '$lib/observability/logger';
import {
	createVariantId,
	type SavedVariant,
	type VariantRepository,
	type WorkspaceRepository
} from '$lib/persistence/variantRepository';
import { finishLabel, wallShortName } from '$lib/features/appearance/appearance';

export type ViewMode = '2d' | '3d';
export type Tool = 'select' | 'pan';
export type SelectionMode = 'replace' | 'add' | 'toggle';
export type NoticeKind = 'info' | 'success' | 'warning' | 'error';

export interface Notice {
	id: number;
	kind: NoticeKind;
	title: string;
	detail?: string;
	deltaCents?: number;
}

type LoadedProject = Extract<ImportResult, { ok: true }>;

const HISTORY_LIMIT = 100;
const EMPTY_DESIGN: FacadeDesign = { wallFinishes: {}, moduleOverrides: {} };

export interface EditorDependencies {
	variants: VariantRepository;
	workspace: WorkspaceRepository;
	persistentStorage: boolean;
}

export class EditorStore {
	project = $state.raw<FacadeProject | null>(null);
	projectKey = $state('');
	design = $state.raw<FacadeDesign>(EMPTY_DESIGN);
	variantName = $state('Mein Fassadenentwurf');

	activeWallId = $state<string | null>(null);
	selection = $state.raw<string[]>([]);
	/** Module whose details are shown (last clicked or keyboard cursor). */
	focusedModuleId = $state<string | null>(null);
	hoveredModuleId = $state<string | null>(null);

	view = $state<ViewMode>('2d');
	tool = $state<Tool>('select');
	showTechnical = $state(true);
	showModuleIds = $state(false);
	showDimensions = $state(true);

	notices = $state<Notice[]>([]);
	lastDeltaCents = $state<number | null>(null);
	canUndo = $state(false);
	canRedo = $state(false);
	lastSavedAt = $state<string | null>(null);

	variants = $state.raw<SavedVariant[]>([]);

	readonly persistentStorage: boolean;
	#deps: EditorDependencies;
	#past: FacadeDesign[] = [];
	#future: FacadeDesign[] = [];
	#noticeId = 0;

	constructor(deps: EditorDependencies) {
		this.#deps = deps;
		this.persistentStorage = deps.persistentStorage;
	}

	// ---------------------------------------------------------------- derived state

	price = $derived(this.project ? priceProject(this.project, this.design) : null);

	activeWall = $derived(
		this.project && this.activeWallId ? findWall(this.project, this.activeWallId) : undefined
	);

	activeWallPrice = $derived(this.price?.walls.find((w) => w.wallId === this.activeWallId));

	/** Where a material click goes: the selected modules or the whole active wall. */
	applyTarget = $derived<'selection' | 'wall'>(this.selection.length > 0 ? 'selection' : 'wall');

	focusedModule = $derived(
		this.activeWall && this.focusedModuleId
			? this.activeWall.modules.find((m) => m.id === this.focusedModuleId)
			: undefined
	);

	overrideCount = $derived(countOverrides(this.design));

	// ---------------------------------------------------------------- project lifecycle

	openProject(result: LoadedProject, origin: 'example' | 'file' | 'restore') {
		this.project = result.project;
		this.projectKey = computeProjectKey(result.project);
		this.design = result.design;
		this.variantName = result.variantName ?? 'Mein Fassadenentwurf';
		this.activeWallId = result.project.walls[0]?.id ?? null;
		this.selection = [];
		this.focusedModuleId = null;
		this.#past = [];
		this.#future = [];
		this.#syncHistoryFlags();
		this.lastDeltaCents = null;
		logger.info('project.opened', {
			origin,
			kind: result.kind,
			walls: result.project.walls.length,
			modules: result.project.walls.reduce((sum, w) => sum + w.modules.length, 0),
			warnings: result.warnings.length
		});
		if (origin === 'file') {
			this.notify(
				'success',
				result.kind === 'design' ? 'Entwurf geöffnet' : 'Projekt geöffnet',
				result.project.project
			);
		}
		for (const warning of result.warnings.slice(0, 3)) this.notify('warning', 'Hinweis', warning);
		void this.refreshVariants();
		this.persist();
	}

	persist() {
		if (!this.project) return;
		try {
			this.#deps.workspace.save(this.project, this.design);
			this.lastSavedAt = nowIso();
		} catch (error) {
			logger.warn('workspace.save_failed', { message: String(error) });
		}
	}

	// ---------------------------------------------------------------- navigation & selection

	setActiveWall(wallId: string) {
		if (wallId === this.activeWallId) return;
		this.activeWallId = wallId;
		this.selection = [];
		this.focusedModuleId = null;
	}

	selectModules(ids: readonly string[], mode: SelectionMode = 'replace') {
		if (mode === 'replace') this.selection = uniqueIds(ids);
		else if (mode === 'add') this.selection = uniqueIds([...this.selection, ...ids]);
		else this.selection = toggleInSelection(this.selection, ids);
		if (ids.length === 1) this.focusedModuleId = ids[0] ?? null;
		else if (ids.length > 1 && !this.selection.includes(this.focusedModuleId ?? '')) {
			this.focusedModuleId = null;
		}
	}

	selectPreset(preset: SelectionPresetId) {
		if (!this.activeWall) return;
		this.selectModules(selectPreset(this.activeWall, preset));
		this.focusedModuleId = null;
	}

	clearSelection() {
		this.selection = [];
		this.focusedModuleId = null;
	}

	/** Selects a wall and module from outside the 2D canvas (e.g. the 3D view). */
	focusModule(wallId: string, moduleId: string, mode: SelectionMode = 'replace') {
		if (wallId !== this.activeWallId) this.setActiveWall(wallId);
		this.selectModules([moduleId], mode);
		this.focusedModuleId = moduleId;
	}

	// ---------------------------------------------------------------- design edits

	/** Applies a finish to the current target (selection or whole wall). */
	applyFinish(finish: Finish) {
		if (!this.activeWallId) return;
		if (this.selection.length > 0)
			this.applyFinishToModules(this.activeWallId, this.selection, finish);
		else this.applyFinishToWall(this.activeWallId, finish);
	}

	applyFinishToWall(wallId: string, finish: Finish, resetModules = false) {
		if (!this.project) return;
		const wall = findWall(this.project, wallId);
		const surface = findSurface(this.project, finish.surfaceId);
		if (!wall || !surface || !surface.colors.includes(finish.color)) return;
		this.#commit(
			applyWallFinish(this.design, wallId, finish, { resetModules }),
			`${wallShortName(wall)}: ${finishLabel(surface, finish.color)}`
		);
	}

	applyFinishToModules(wallId: string, moduleIds: readonly string[], finish: Finish) {
		if (!this.project || moduleIds.length === 0) return;
		const surface = findSurface(this.project, finish.surfaceId);
		if (!surface || !surface.colors.includes(finish.color)) return;
		const label = moduleIds.length === 1 ? `Modul ${moduleIds[0]}` : `${moduleIds.length} Module`;
		this.#commit(
			applyModuleFinish(this.design, wallId, moduleIds, finish),
			`${label}: ${finishLabel(surface, finish.color)}`
		);
	}

	/** Drops individual finishes so the modules follow the wall finish again. */
	resetModules(wallId: string, moduleIds?: readonly string[]) {
		const next = resetModuleFinish(this.design, wallId, moduleIds);
		this.#commit(
			next,
			moduleIds ? 'Auswahl übernimmt wieder die Wandgestaltung' : 'Wandbereiche zurückgesetzt'
		);
	}

	/** Copies the active wall's finish to every other wall. */
	applyActiveWallToAll() {
		if (!this.project || !this.activeWallId) return;
		const finish = this.design.wallFinishes[this.activeWallId];
		if (!finish) return;
		let next = this.design;
		for (const wall of this.project.walls) {
			next = applyWallFinish(next, wall.id, finish);
		}
		this.#commit(next, 'Wandgestaltung auf alle Fassaden übertragen');
	}

	moduleFinish(moduleId: string, wallId = this.activeWallId): Finish | undefined {
		return wallId ? getModuleFinish(this.design, wallId, moduleId) : undefined;
	}

	/** Total price if `design` were applied (for hover previews). */
	previewTotal(design: FacadeDesign): number | null {
		return this.project ? priceProject(this.project, design).totalCents : null;
	}

	/** Design that would result from applying a finish to the current target. */
	designWithFinish(finish: Finish): FacadeDesign {
		if (!this.activeWallId) return this.design;
		return this.selection.length > 0
			? applyModuleFinish(this.design, this.activeWallId, this.selection, finish)
			: applyWallFinish(this.design, this.activeWallId, finish);
	}

	undo() {
		const previous = this.#past.pop();
		if (!previous) return;
		this.#future.push(this.design);
		this.#setDesign(previous, 'Rückgängig gemacht');
	}

	redo() {
		const next = this.#future.pop();
		if (!next) return;
		this.#past.push(this.design);
		this.#setDesign(next, 'Wiederhergestellt');
	}

	/** Replaces the whole design (e.g. when loading a variant), undoable. */
	replaceDesign(design: FacadeDesign, label: string) {
		this.#commit(design, label);
	}

	#commit(proposed: FacadeDesign, label: string) {
		if (proposed === this.design) return;
		const next = this.project ? collapseUniformWalls(this.project, proposed) : proposed;
		this.#past.push(this.design);
		if (this.#past.length > HISTORY_LIMIT) this.#past.shift();
		this.#future = [];
		this.#setDesign(next, label);
	}

	#setDesign(next: FacadeDesign, label: string) {
		const before = this.price?.totalCents ?? 0;
		this.design = next;
		const after = this.price?.totalCents ?? 0;
		this.lastDeltaCents = after - before;
		this.#syncHistoryFlags();
		this.notify('info', label, undefined, after - before);
		this.persist();
	}

	#syncHistoryFlags() {
		this.canUndo = this.#past.length > 0;
		this.canRedo = this.#future.length > 0;
	}

	// ---------------------------------------------------------------- variants

	async refreshVariants() {
		if (!this.projectKey) return;
		try {
			this.variants = await this.#deps.variants.list(this.projectKey);
		} catch (error) {
			logger.error('variants.list_failed', { message: String(error) });
		}
	}

	async saveVariant(name: string): Promise<SavedVariant | null> {
		if (!this.project) return null;
		const now = nowIso();
		const variant: SavedVariant = {
			id: createVariantId(),
			name: name.trim() || `Variante ${this.variants.length + 1}`,
			projectKey: this.projectKey,
			createdAt: now,
			updatedAt: now,
			design: this.design
		};
		try {
			await this.#deps.variants.save(variant);
			this.variantName = variant.name;
			await this.refreshVariants();
			this.notify('success', 'Variante gespeichert', variant.name);
			logger.info('variant.saved', { count: this.variants.length });
			return variant;
		} catch (error) {
			logger.error('variant.save_failed', { message: String(error) });
			this.notify(
				'error',
				'Variante konnte nicht gespeichert werden',
				'Der Browserspeicher ist voll oder gesperrt.'
			);
			return null;
		}
	}

	async renameVariant(variant: SavedVariant, name: string) {
		const trimmed = name.trim();
		if (!trimmed) return;
		await this.#deps.variants.save({
			...variant,
			name: trimmed,
			updatedAt: nowIso()
		});
		await this.refreshVariants();
	}

	async deleteVariant(variant: SavedVariant) {
		await this.#deps.variants.remove(variant.projectKey, variant.id);
		await this.refreshVariants();
		this.notify('info', 'Variante gelöscht', variant.name);
	}

	loadVariant(variant: SavedVariant) {
		this.variantName = variant.name;
		this.replaceDesign(variant.design, `Variante „${variant.name}“ geladen`);
		this.clearSelection();
	}

	// ---------------------------------------------------------------- notices

	notify(kind: NoticeKind, title: string, detail?: string, deltaCents?: number) {
		const notice: Notice = { id: ++this.#noticeId, kind, title };
		if (detail) notice.detail = detail;
		if (deltaCents !== undefined) notice.deltaCents = deltaCents;
		this.notices = [...this.notices.slice(-3), notice];
	}

	dismissNotice(id: number) {
		this.notices = this.notices.filter((n) => n.id !== id);
	}
}
