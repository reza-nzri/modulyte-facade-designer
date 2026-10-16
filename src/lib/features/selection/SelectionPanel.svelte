<!--
	Region presets ("Sockelzone", "Rund um Fenster & Türen", …), the current selection and the
	details of a single clicked module.
-->
<script lang="ts">
	import {
		isModuleOverridden,
		mm2ToM2,
		SELECTION_PRESETS,
		type SelectionPresetId
	} from '$lib/domain';
	import { useEditor } from '$lib/features/editor/context';
	import Icon from '$lib/features/ui/Icon.svelte';

	const editor = useEditor();

	const wall = $derived(editor.activeWall);
	const selectionArea = $derived.by(() => {
		const prices = editor.activeWallPrice?.modules ?? [];
		const ids = new Set(editor.selection);
		return prices.filter((m) => ids.has(m.moduleId)).reduce((sum, m) => sum + m.areaMm2, 0);
	});
	const selectionSpecialCount = $derived(
		wall
			? wall.modules.filter((m) => m.type === 'special' && editor.selection.includes(m.id)).length
			: 0
	);

	const QUICK: SelectionPresetId[] = [
		'plinth',
		'top-row',
		'around-openings',
		'special-modules',
		'left-edge',
		'right-edge',
		'all'
	];
	const presets = $derived(SELECTION_PRESETS.filter((p) => QUICK.includes(p.id)));

	const m2 = (mm2: number) =>
		mm2ToM2(mm2).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
</script>

<section class="panel" aria-labelledby="regions-title">
	<h2 id="regions-title" class="step"><span>1</span> Bereich wählen <small>(optional)</small></h2>
	<div class="presets">
		{#each presets as preset (preset.id)}
			<button
				class="preset"
				title={preset.description}
				onclick={() => editor.selectPreset(preset.id)}
				data-testid="preset-{preset.id}"
			>
				{preset.label}
			</button>
		{/each}
	</div>
	<p class="hint">
		Oder direkt in der Ansicht: Modul anklicken, mit <span class="kbd">Shift</span> weitere hinzufügen
		oder einen Rahmen aufziehen.
	</p>

	{#if editor.selection.length > 0}
		<div class="selection card" data-testid="selection-summary">
			<div class="row">
				<strong
					>{editor.selection.length}
					{editor.selection.length === 1 ? 'Modul' : 'Module'} ausgewählt</strong
				>
				<button class="btn btn-ghost btn-small" onclick={() => editor.clearSelection()}>
					<Icon name="x" size={14} /> Aufheben
				</button>
			</div>
			<div class="meta num">
				<span>{m2(selectionArea)} m²</span>
				{#if selectionSpecialCount > 0}<span>davon {selectionSpecialCount} Passstücke</span>{/if}
			</div>
			{#if wall && editor.selection.some((id) => isModuleOverridden(editor.design, wall.id, id))}
				<button
					class="btn btn-small"
					onclick={() => wall && editor.resetModules(wall.id, editor.selection)}
				>
					<Icon name="reset" size={14} /> Wie restliche Wand gestalten
				</button>
			{/if}
		</div>
	{/if}
</section>

<style>
	.panel {
		display: grid;
		gap: 10px;
	}
	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.preset {
		border: 1px solid var(--line-strong);
		background: var(--surface);
		border-radius: 999px;
		padding: 5px 11px;
		font-size: 13px;
		color: var(--ink-soft);
	}
	.preset:hover {
		border-color: var(--select);
		color: var(--select);
		background: var(--select-soft);
	}
	.hint {
		margin: 0;
		font-size: 12px;
		color: var(--muted);
	}
	.card {
		padding: 12px;
		display: grid;
		gap: 8px;
	}
	.selection {
		border-color: rgba(36, 87, 214, 0.35);
		background: #f6f8fe;
	}
	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	.meta {
		display: flex;
		gap: 12px;
		font-size: 13px;
		color: var(--muted);
	}
	.step {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
	}
	.step span {
		width: 20px;
		height: 20px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: var(--ink);
		color: #fff;
		font-size: 11px;
	}
	.step small {
		color: var(--muted);
		font-weight: 400;
	}
</style>
