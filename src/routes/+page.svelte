<script lang="ts">
	import { onMount } from 'svelte';
	import { sanitizeDesign, validateProjectSemantics } from '$lib/domain';
	import MaterialPatternDefs from '$lib/features/appearance/MaterialPatternDefs.svelte';
	import FacadeCanvas from '$lib/features/canvas/FacadeCanvas.svelte';
	import { provideEditor } from '$lib/features/editor/context';
	import { EditorStore } from '$lib/features/editor/editorStore.svelte';
	import { exportDesign, importFile, loadExampleProject } from '$lib/features/files/fileActions';
	import HelpDialog from '$lib/features/help/HelpDialog.svelte';
	import House3D from '$lib/features/house3d/House3D.svelte';
	import AppHeader from '$lib/features/layout/AppHeader.svelte';
	import ImportErrorDialog from '$lib/features/layout/ImportErrorDialog.svelte';
	import MaterialPanel from '$lib/features/materials/MaterialPanel.svelte';
	import PriceSummary from '$lib/features/pricing/PriceSummary.svelte';
	import ModuleInspector from '$lib/features/selection/ModuleInspector.svelte';
	import SelectionPanel from '$lib/features/selection/SelectionPanel.svelte';
	import PrintSummary from '$lib/features/summary/PrintSummary.svelte';
	import SummaryDialog from '$lib/features/summary/SummaryDialog.svelte';
	import Icon from '$lib/features/ui/Icon.svelte';
	import Toasts from '$lib/features/ui/Toasts.svelte';
	import VariantsDialog from '$lib/features/variants/VariantsDialog.svelte';
	import WallList from '$lib/features/walls/WallList.svelte';
	import type { ImportResult } from '$lib/io/importDocument';
	import { logger } from '$lib/observability/logger';
	import { createBrowserStore } from '$lib/persistence/keyValueStore';
	import {
		createVariantRepository,
		createWorkspaceRepository
	} from '$lib/persistence/variantRepository';

	const { store, persistent } = createBrowserStore();
	const onCorrupt = (key: string) => logger.warn('storage.corrupt_entry_ignored', { key });
	const editor = provideEditor(
		new EditorStore({
			variants: createVariantRepository(store, onCorrupt),
			workspace: createWorkspaceRepository(store, onCorrupt),
			persistentStorage: persistent
		})
	);

	const ONBOARDING_KEY = 'modulyte.facade-designer.v1.onboarded';

	let fileInput = $state<HTMLInputElement>();
	let loading = $state(true);
	let importError = $state<Extract<ImportResult, { ok: false }> | null>(null);
	let helpOpen = $state(false);
	let variantsOpen = $state(false);
	let summaryOpen = $state(false);
	let fileDragActive = $state(false);

	onMount(async () => {
		const restored = createWorkspaceRepository(store, onCorrupt).load();
		if (
			restored &&
			!validateProjectSemantics(restored.project).some((i) => i.severity === 'error')
		) {
			const { design, issues } = sanitizeDesign(restored.project, restored.design);
			editor.openProject(
				{
					ok: true,
					kind: 'design',
					project: restored.project,
					design,
					variantName: null,
					warnings: issues.map((i) => i.message)
				},
				'restore'
			);
		} else {
			await openExample();
		}
		loading = false;
		if (store.getItem(ONBOARDING_KEY) !== 'done') helpOpen = true;
	});

	$effect(() => {
		if (!helpOpen && !loading) store.setItem(ONBOARDING_KEY, 'done');
	});

	async function openExample() {
		const result = await loadExampleProject();
		if (result.ok) editor.openProject(result, 'example');
		else importError = result;
	}

	async function openFile(file: File) {
		const result = await importFile(file);
		if (result.ok) editor.openProject(result, 'file');
		else importError = result;
	}

	function onFileChosen(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) void openFile(file);
		input.value = '';
	}

	function doExport() {
		if (!editor.project) return;
		const fileName = exportDesign(editor.project, editor.design, editor.variantName);
		editor.notify('success', 'Entwurf exportiert', fileName);
	}

	function isTyping(target: EventTarget | null) {
		return (
			target instanceof HTMLElement &&
			(target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
		);
	}

	function onGlobalKey(event: KeyboardEvent) {
		if (isTyping(event.target)) return;
		const mod = event.ctrlKey || event.metaKey;
		const key = event.key.toLowerCase();
		if (mod && key === 'z' && !event.shiftKey) {
			event.preventDefault();
			editor.undo();
		} else if (mod && (key === 'y' || (key === 'z' && event.shiftKey))) {
			event.preventDefault();
			editor.redo();
		} else if (mod && key === 's') {
			event.preventDefault();
			variantsOpen = true;
		} else if (mod && key === 'o') {
			event.preventDefault();
			fileInput?.click();
		} else if (mod && key === 'e') {
			event.preventDefault();
			doExport();
		} else if (mod && key === 'p') {
			event.preventDefault();
			summaryOpen = true;
		} else if (!mod && key === 'v') {
			editor.tool = 'select';
		} else if (!mod && key === 'h') {
			editor.tool = 'pan';
		} else if (!mod && key === '2') {
			editor.view = '2d';
		} else if (!mod && key === '3') {
			editor.view = '3d';
		} else if (!mod && key === '?') {
			helpOpen = true;
		}
	}

	// Dropping a JSON file anywhere on the window opens it.
	function onWindowDragOver(event: DragEvent) {
		if (event.dataTransfer?.types.includes('Files')) {
			event.preventDefault();
			fileDragActive = true;
		}
	}
	function onWindowDrop(event: DragEvent) {
		fileDragActive = false;
		const file = event.dataTransfer?.files?.[0];
		if (file) {
			event.preventDefault();
			void openFile(file);
		}
	}
</script>

<svelte:window
	onkeydown={onGlobalKey}
	ondragover={onWindowDragOver}
	ondrop={onWindowDrop}
	ondragleave={(e) => {
		if (!e.relatedTarget) fileDragActive = false;
	}}
/>

<input
	bind:this={fileInput}
	type="file"
	accept=".json,application/json"
	class="visually-hidden"
	onchange={onFileChosen}
	data-testid="file-input"
	tabindex="-1"
/>

{#if editor.project}
	<MaterialPatternDefs surfaces={editor.project.surfaces} />
{/if}

<div class="app-shell">
	<AppHeader
		onOpenFile={() => fileInput?.click()}
		onLoadExample={openExample}
		onExport={doExport}
		onVariants={() => (variantsOpen = true)}
		onSummary={() => (summaryOpen = true)}
		onHelp={() => (helpOpen = true)}
	/>

	{#if loading}
		<div class="loading" role="status"><span class="spinner"></span> Projekt wird geladen …</div>
	{:else if !editor.project}
		<div class="welcome card">
			<Icon name="house" size={32} />
			<h1>Willkommen beim Fassadendesigner</h1>
			<p>Öffnen Sie Ihre Projektdatei von modulyte oder starten Sie mit dem Beispielhaus.</p>
			<div class="row">
				<button class="btn btn-primary" onclick={() => fileInput?.click()}
					><Icon name="upload" /> Datei öffnen</button
				>
				<button class="btn" onclick={openExample}><Icon name="house" /> Beispielprojekt</button>
			</div>
		</div>
	{:else}
		<main class="workspace">
			<aside class="sidebar left" aria-label="Projekt und Fassaden">
				<WallList />
				<p class="saved">
					<Icon name="check" size={13} />
					{editor.persistentStorage
						? 'Wird automatisch im Browser gespeichert'
						: 'Speicher gesperrt – Entwurf bitte exportieren'}
				</p>
			</aside>

			<section class="stage" aria-label="Arbeitsbereich">
				{#if editor.view === '2d'}
					<FacadeCanvas />
				{:else}
					<House3D />
				{/if}
				<ModuleInspector />
			</section>

			<aside class="sidebar right" aria-label="Gestaltung">
				<div class="scroll">
					<SelectionPanel />
					<hr />
					<MaterialPanel />
				</div>
				<div class="sticky-price">
					<PriceSummary />
				</div>
			</aside>
		</main>
	{/if}
</div>

{#if fileDragActive}
	<div class="file-drop" aria-hidden="true">
		<Icon name="upload" size={28} /> Datei loslassen, um sie zu öffnen
	</div>
{/if}

<Toasts />
<HelpDialog bind:open={helpOpen} />
<VariantsDialog bind:open={variantsOpen} />
<SummaryDialog bind:open={summaryOpen} />
<ImportErrorDialog bind:error={importError} />

{#if editor.project}
	<div class="print-root">
		<PrintSummary />
	</div>
{/if}

<style>
	.app-shell {
		height: 100vh;
		display: flex;
		flex-direction: column;
	}
	.workspace {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: var(--sidebar-left) minmax(0, 1fr) var(--sidebar-right);
	}
	.sidebar {
		background: var(--surface);
		min-height: 0;
	}
	.sidebar.left {
		border-right: 1px solid var(--line);
		padding: 16px;
		overflow: auto;
		display: flex;
		flex-direction: column;
	}
	.saved {
		margin: auto 0 0;
		padding-top: 16px;
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--muted);
	}
	.sidebar.right {
		border-left: 1px solid var(--line);
		display: flex;
		flex-direction: column;
	}
	.scroll {
		flex: 1;
		overflow: auto;
		padding: 16px;
		display: grid;
		align-content: start;
		gap: 16px;
	}
	hr {
		border: 0;
		border-top: 1px solid var(--line);
		margin: 0;
		width: 100%;
	}
	.sticky-price {
		border-top: 1px solid var(--line);
		padding: 14px 16px 16px;
		background: var(--surface-muted);
		max-height: 48vh;
		overflow: auto;
	}
	.stage {
		position: relative;
		min-width: 0;
		min-height: 0;
	}
	.loading,
	.welcome {
		margin: auto;
		display: grid;
		gap: 12px;
		justify-items: center;
		text-align: center;
	}
	.loading {
		grid-auto-flow: column;
		align-items: center;
		color: var(--muted);
	}
	.spinner {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		border: 2px solid var(--line-strong);
		border-top-color: var(--brand);
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.welcome {
		padding: 40px;
		max-width: 480px;
		color: var(--brand);
	}
	.welcome h1 {
		color: var(--ink);
		font-size: 22px;
	}
	.welcome p {
		margin: 0;
		color: var(--muted);
	}
	.welcome .row {
		display: flex;
		gap: 8px;
	}
	.file-drop {
		position: fixed;
		inset: 12px;
		z-index: 60;
		display: grid;
		place-items: center;
		align-content: center;
		gap: 10px;
		border: 2px dashed var(--select);
		border-radius: var(--radius-l);
		background: rgba(245, 244, 240, 0.9);
		color: var(--select);
		font-weight: 600;
		pointer-events: none;
	}
	@media (max-width: 1280px) {
		.workspace {
			--sidebar-left: 236px;
			--sidebar-right: 320px;
		}
	}
	@media (max-width: 960px) {
		.app-shell {
			height: auto;
			min-height: 100vh;
		}
		.workspace {
			grid-template-columns: 1fr;
			grid-template-rows: auto 60vh auto;
		}
		.sidebar.left {
			border-right: 0;
			border-bottom: 1px solid var(--line);
		}
		.sidebar.right {
			border-left: 0;
			border-top: 1px solid var(--line);
		}
		.stage {
			grid-row: 2;
		}
		.sticky-price {
			max-height: none;
		}
	}
</style>
