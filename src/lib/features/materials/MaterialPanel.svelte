<!--
	Material library. One click on a colour applies "material + colour" to the current target:
	the selected modules, or — if nothing is selected — the whole active wall. Swatches can also
	be dragged onto the facade. Hovering shows what the change would cost before applying it.
-->
<script lang="ts">
	import { formatCents, formatCentsDelta, type Finish, type Surface } from '$lib/domain';
	import { useEditor } from '$lib/features/editor/context';
	import Icon from '$lib/features/ui/Icon.svelte';
	import {
		colorHex,
		colorLabel,
		finishLabel,
		patternId,
		surfacePresentation,
		wallShortName
	} from '$lib/features/appearance/appearance';
	import { writeDraggedFinish } from './dragFinish';

	const editor = useEditor();
	let preview = $state<Finish | null>(null);

	const wall = $derived(editor.activeWall);
	const surfaces = $derived(editor.project?.surfaces ?? []);
	const currentFinish = $derived.by(() => {
		if (!wall) return undefined;
		if (editor.selection.length > 0) {
			const finishes = editor.selection.map((id) => editor.moduleFinish(id));
			const first = finishes[0];
			return finishes.every(
				(f) => f && first && f.surfaceId === first.surfaceId && f.color === first.color
			)
				? first
				: undefined;
		}
		return editor.design.wallFinishes[wall.id];
	});

	const previewDelta = $derived.by(() => {
		if (!preview || !editor.price) return null;
		const total = editor.previewTotal(editor.designWithFinish(preview));
		return total === null ? null : total - editor.price.totalCents;
	});

	function isActive(surface: Surface, color: string) {
		return currentFinish?.surfaceId === surface.id && currentFinish.color === color;
	}

	function apply(surface: Surface, color: string) {
		editor.applyFinish({ surfaceId: surface.id, color });
	}

	function pickSurface(surface: Surface) {
		// Keep the colour if the new material offers it, otherwise take its first colour.
		const color =
			currentFinish && surface.colors.includes(currentFinish.color)
				? currentFinish.color
				: (surface.colors[0] ?? '');
		if (color) apply(surface, color);
	}
</script>

<section class="panel" aria-labelledby="materials-title">
	<h2 id="materials-title" class="step"><span>2</span> Material & Farbe wählen</h2>
	<div
		class="target"
		class:selection={editor.applyTarget === 'selection'}
		data-testid="apply-target"
	>
		<Icon name="brush" size={16} />
		<div>
			<span class="eyebrow">Änderungen gelten für</span>
			<strong>
				{#if editor.applyTarget === 'selection'}
					{editor.selection.length === 1
						? '1 ausgewähltes Modul'
						: `${editor.selection.length} ausgewählte Module`}
				{:else if wall}
					die ganze {wallShortName(wall)}
				{/if}
			</strong>
		</div>
		{#if editor.applyTarget === 'selection'}
			<button class="btn btn-ghost btn-small" onclick={() => editor.clearSelection()}
				>Ganze Wand</button
			>
		{/if}
	</div>

	<div class="materials">
		{#each surfaces as surface (surface.id)}
			{@const info = surfacePresentation(surface)}
			{@const surfaceActive = currentFinish?.surfaceId === surface.id}
			<article class="material" class:active={surfaceActive} data-testid="material-{surface.id}">
				<button
					class="material-head"
					onclick={() => pickSurface(surface)}
					aria-pressed={surfaceActive}
				>
					<svg class="texture" viewBox="0 0 400 260" aria-hidden="true">
						<rect
							width="400"
							height="260"
							fill="url(#{patternId(
								surface.id,
								(surfaceActive && currentFinish ? currentFinish.color : surface.colors[0]) ?? ''
							)})"
						/>
					</svg>
					<span class="material-text">
						<strong>{info.label}</strong>
						<small>{info.description}</small>
					</span>
					<span class="rate num"
						>{formatCents(Math.round(surface.eur_per_m2 * 100))}<small>/m²</small></span
					>
				</button>
				<div class="swatches" role="group" aria-label="Farben für {info.label}">
					{#each surface.colors as color (color)}
						<button
							class="swatch"
							class:active={isActive(surface, color)}
							style:--swatch={colorHex(color)}
							draggable="true"
							title="{finishLabel(surface, color)} – klicken oder auf die Fassade ziehen"
							aria-label="{finishLabel(surface, color)} anwenden"
							aria-pressed={isActive(surface, color)}
							data-testid="swatch-{surface.id}-{color}"
							onclick={() => apply(surface, color)}
							onmouseenter={() => (preview = { surfaceId: surface.id, color })}
							onmouseleave={() => (preview = null)}
							onfocus={() => (preview = { surfaceId: surface.id, color })}
							onblur={() => (preview = null)}
							ondragstart={(event) =>
								writeDraggedFinish(event.dataTransfer, { surfaceId: surface.id, color })}
						>
							<span class="dot"></span>
							<span class="name">{colorLabel(color)}</span>
							{#if isActive(surface, color)}<Icon name="check" size={14} />{/if}
						</button>
					{/each}
				</div>
			</article>
		{/each}
	</div>

	<p class="preview" aria-live="polite">
		{#if preview && previewDelta !== null}
			{@const surface = surfaces.find((s) => s.id === preview?.surfaceId)}
			{#if surface}
				<span>{finishLabel(surface, preview.color)}:</span>
				<strong class="num" class:delta-up={previewDelta > 0} class:delta-down={previewDelta < 0}>
					{formatCentsDelta(previewDelta)}
				</strong>
			{/if}
		{:else}
			<span class="hint">Tipp: Farbfelder lassen sich direkt auf einzelne Module ziehen.</span>
		{/if}
	</p>

	{#if wall}
		<div class="wall-actions">
			<button
				class="btn btn-small"
				onclick={() => editor.applyActiveWallToAll()}
				title="Material und Farbe dieser Wand für alle Fassaden übernehmen"
			>
				<Icon name="layers" size={15} /> Auf alle Fassaden übertragen
			</button>
			{#if Object.keys(editor.design.moduleOverrides[wall.id] ?? {}).length > 0}
				<button
					class="btn btn-small"
					onclick={() => editor.resetModules(wall.id)}
					title="Alle individuell gestalteten Module dieser Wand zurücksetzen"
				>
					<Icon name="reset" size={15} /> Bereiche zurücksetzen
				</button>
			{/if}
		</div>
	{/if}
</section>

<style>
	.panel {
		display: grid;
		gap: 12px;
	}
	.target {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-radius: var(--radius-m);
		background: var(--brand-soft);
		color: var(--brand-strong);
	}
	.target.selection {
		background: var(--select-soft);
		color: var(--select);
	}
	.target > div {
		display: grid;
		flex: 1;
		min-width: 0;
	}
	.target strong {
		font-size: 14px;
		color: var(--ink);
	}
	.target .eyebrow {
		color: inherit;
		opacity: 0.85;
		font-size: 10px;
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
	.materials {
		display: grid;
		gap: 10px;
	}
	.material {
		border: 1px solid var(--line);
		border-radius: var(--radius-m);
		background: var(--surface);
		overflow: hidden;
		transition:
			border-color 0.12s ease,
			box-shadow 0.12s ease;
	}
	.material.active {
		border-color: var(--brand);
		box-shadow: 0 0 0 1px var(--brand);
	}
	.material-head {
		display: grid;
		grid-template-columns: 56px 1fr auto;
		gap: 12px;
		align-items: center;
		width: 100%;
		padding: 10px 12px;
		border: 0;
		background: transparent;
		text-align: left;
	}
	.material-head:hover {
		background: var(--surface-muted);
	}
	.texture {
		width: 56px;
		height: 40px;
		border-radius: 6px;
		border: 1px solid rgba(0, 0, 0, 0.12);
		display: block;
	}
	.material-text {
		display: grid;
		min-width: 0;
	}
	.material-text strong {
		font-size: 14px;
	}
	.material-text small {
		color: var(--muted);
		font-size: 12px;
		line-height: 1.3;
	}
	.rate {
		font-weight: 600;
		font-size: 14px;
	}
	.rate small {
		color: var(--muted);
		font-weight: 400;
	}
	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 0 12px 12px;
	}
	.swatch {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px 4px 5px;
		border-radius: 999px;
		border: 1px solid var(--line-strong);
		background: var(--surface);
		font-size: 13px;
		cursor: grab;
	}
	.swatch:hover {
		border-color: var(--faint);
		background: var(--surface-muted);
	}
	.swatch.active {
		border-color: var(--ink);
		background: var(--ink);
		color: #fff;
	}
	.dot {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--swatch);
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.18);
	}
	.preview {
		margin: 0;
		min-height: 22px;
		display: flex;
		gap: 6px;
		font-size: 13px;
		color: var(--ink-soft);
	}
	.preview .hint {
		color: var(--muted);
	}
	.wall-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
</style>
