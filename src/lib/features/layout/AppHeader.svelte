<script lang="ts">
	import { useEditor } from '$lib/features/editor/context';
	import Icon from '$lib/features/ui/Icon.svelte';

	let {
		onOpenFile,
		onLoadExample,
		onExport,
		onVariants,
		onSummary,
		onHelp
	}: {
		onOpenFile: () => void;
		onLoadExample: () => void;
		onExport: () => void;
		onVariants: () => void;
		onSummary: () => void;
		onHelp: () => void;
	} = $props();

	const editor = useEditor();
	let menuOpen = $state(false);

	function closeMenuOnOutside(event: MouseEvent) {
		if (!(event.target as Element).closest('.open-menu')) menuOpen = false;
	}
</script>

<svelte:window onclick={closeMenuOnOutside} />

<header class="app-header">
	<div class="brand">
		<span class="logo" aria-hidden="true">
			<svg viewBox="0 0 32 32" width="28" height="28"
				><rect width="32" height="32" rx="7" fill="#24433a" /><g fill="#f5f4f0"
					><rect x="7" y="7" width="8" height="5.5" rx="1" /><rect
						x="17"
						y="7"
						width="8"
						height="5.5"
						rx="1"
					/><rect x="7" y="14.5" width="8" height="5.5" rx="1" /><rect
						x="17"
						y="14.5"
						width="8"
						height="5.5"
						rx="1"
						fill="#c79b6a"
					/><rect x="7" y="22" width="8" height="3" rx="1" /><rect
						x="17"
						y="22"
						width="8"
						height="3"
						rx="1"
					/></g
				></svg
			>
		</span>
		<div class="titles">
			<span class="product">modulyte <b>Fassadendesigner</b></span>
			<label class="variant">
				<span class="visually-hidden">Name des Entwurfs</span>
				<input bind:value={editor.variantName} maxlength="60" aria-label="Name des Entwurfs" />
				<Icon name="pencil" size={12} />
			</label>
		</div>
	</div>

	<div class="actions">
		<div class="history" role="group" aria-label="Verlauf">
			<button
				class="btn btn-ghost btn-icon"
				onclick={() => editor.undo()}
				disabled={!editor.canUndo}
				title="Rückgängig (Strg+Z)"
				aria-label="Rückgängig"
			>
				<Icon name="undo" />
			</button>
			<button
				class="btn btn-ghost btn-icon"
				onclick={() => editor.redo()}
				disabled={!editor.canRedo}
				title="Wiederholen (Strg+Umschalt+Z)"
				aria-label="Wiederholen"
			>
				<Icon name="redo" />
			</button>
		</div>

		<div class="segmented" role="group" aria-label="Ansicht">
			<button
				class:active={editor.view === '2d'}
				onclick={() => (editor.view = '2d')}
				aria-pressed={editor.view === '2d'}
				data-testid="view-2d"
			>
				<Icon name="facade" size={16} /> 2D-Ansicht
			</button>
			<button
				class:active={editor.view === '3d'}
				onclick={() => (editor.view = '3d')}
				aria-pressed={editor.view === '3d'}
				data-testid="view-3d"
			>
				<Icon name="cube" size={16} /> 3D-Haus
			</button>
		</div>

		<div class="open-menu">
			<button
				class="btn"
				onclick={() => (menuOpen = !menuOpen)}
				aria-expanded={menuOpen}
				aria-haspopup="menu"
				data-testid="open-menu"
			>
				<Icon name="open" /> Öffnen <Icon name="chevronDown" size={14} />
			</button>
			{#if menuOpen}
				<div class="menu card" role="menu">
					<button
						role="menuitem"
						onclick={() => {
							menuOpen = false;
							onOpenFile();
						}}
						data-testid="open-file"
					>
						<Icon name="upload" />
						<span
							><strong>Datei öffnen …</strong><small
								>Projekt oder gespeicherten Entwurf (.json)</small
							></span
						>
					</button>
					<button
						role="menuitem"
						onclick={() => {
							menuOpen = false;
							onLoadExample();
						}}
					>
						<Icon name="house" />
						<span
							><strong>Beispielprojekt laden</strong><small>Einfamilienhaus Musterstraße 12</small
							></span
						>
					</button>
				</div>
			{/if}
		</div>
		<button class="btn" onclick={onVariants} data-testid="variants-button">
			<Icon name="compare" /> Varianten{#if editor.variants.length > 0}<span class="count"
					>{editor.variants.length}</span
				>{/if}
		</button>
		<button class="btn" onclick={onSummary} data-testid="summary-button"
			><Icon name="print" /> Zusammenfassung</button
		>
		<button class="btn btn-primary" onclick={onExport} data-testid="export-button"
			><Icon name="download" /> Exportieren</button
		>
		<button
			class="btn btn-ghost btn-icon"
			onclick={onHelp}
			title="Hilfe & Tastenkürzel"
			aria-label="Hilfe"><Icon name="help" /></button
		>
	</div>
</header>

<style>
	.app-header {
		height: var(--header-h);
		display: grid;
		grid-template-columns: minmax(240px, 1fr) auto;
		grid-template-areas: 'brand actions';
		align-items: center;
		gap: 16px;
		padding: 0 16px;
		background: var(--surface);
		border-bottom: 1px solid var(--line);
		position: relative;
		z-index: 10;
	}
	.brand {
		grid-area: brand;
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}
	.titles {
		display: grid;
		min-width: 0;
	}
	.product {
		font-size: 12px;
		color: var(--muted);
		letter-spacing: 0.01em;
	}
	.product b {
		color: var(--ink);
		font-weight: 600;
	}
	.variant {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--faint);
	}
	.variant input {
		border: 1px solid transparent;
		background: transparent;
		font-weight: 600;
		font-size: 15px;
		padding: 0 4px;
		margin-left: -5px;
		border-radius: 4px;
		min-width: 0;
		width: 22ch;
		color: var(--ink);
	}
	.variant input:hover {
		border-color: var(--line);
	}
	.variant input:focus {
		outline: none;
		border-color: var(--select);
		box-shadow: var(--focus);
	}
	.actions {
		grid-area: actions;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.history {
		display: flex;
		padding-right: 8px;
		border-right: 1px solid var(--line);
	}
	.segmented {
		display: flex;
		padding: 3px;
		gap: 2px;
		background: var(--paper);
		border: 1px solid var(--line);
		border-radius: var(--radius-m);
	}
	.segmented button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: 0;
		background: transparent;
		padding: 5px 11px;
		border-radius: 7px;
		font-size: 13px;
		font-weight: 500;
		color: var(--ink-soft);
	}
	.segmented button.active {
		background: var(--surface);
		color: var(--ink);
		box-shadow: var(--shadow-s);
	}
	.open-menu {
		position: relative;
	}
	.menu {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		width: 300px;
		padding: 6px;
		display: grid;
		gap: 2px;
		box-shadow: var(--shadow-m);
	}
	.menu button {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 10px;
		border: 0;
		border-radius: var(--radius-s);
		background: transparent;
		text-align: left;
	}
	.menu button:hover {
		background: var(--paper);
	}
	.menu span {
		display: grid;
	}
	.menu small {
		color: var(--muted);
		font-size: 12px;
	}
	.count {
		font-size: 11px;
		background: var(--brand-soft);
		color: var(--brand);
		border-radius: 999px;
		padding: 0 6px;
		font-weight: 600;
	}
	@media (max-width: 1280px) {
		.actions .btn:not(.btn-primary):not(.btn-icon) :global(svg) {
			display: none;
		}
	}
	@media (max-width: 1080px) {
		.app-header {
			height: auto;
			grid-template-columns: 1fr;
			grid-template-areas: 'brand' 'actions';
			padding: 10px 12px;
			gap: 8px;
		}
		.actions {
			flex-wrap: wrap;
		}
	}
</style>
