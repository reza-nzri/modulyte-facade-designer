<!--
	Left sidebar: project info and one card per facade (thumbnail, finish, price). Cards are also
	drop targets: dropping a material swatch onto a card styles that whole wall.
-->
<script lang="ts">
	import { findSurface, formatCents, mm2ToM2 } from '$lib/domain';
	import { useEditor } from '$lib/features/editor/context';
	import WallElevation from '$lib/features/canvas/WallElevation.svelte';
	import {
		colorHex,
		finishLabel,
		wallDisplayName,
		wallShortName
	} from '$lib/features/appearance/appearance';
	import { FINISH_MIME, readDraggedFinish } from '$lib/features/materials/dragFinish';

	const editor = useEditor();
	let dropWall = $state<string | null>(null);

	const totals = $derived.by(() => {
		const walls = editor.price?.walls ?? [];
		return {
			area: walls.reduce((s, w) => s + w.areas.coveredMm2, 0),
			modules: walls.reduce((s, w) => s + w.areas.standardCount + w.areas.specialCount, 0),
			special: walls.reduce((s, w) => s + w.areas.specialCount, 0)
		};
	});
</script>

{#if editor.project}
	<section class="project" aria-labelledby="project-title">
		<span class="eyebrow">Projekt</span>
		<h2 id="project-title">{editor.project.project}</h2>
		<dl class="facts num">
			<div>
				<dt>Fassaden</dt>
				<dd>{editor.project.walls.length}</dd>
			</div>
			<div>
				<dt>Fläche</dt>
				<dd>{mm2ToM2(totals.area).toLocaleString('de-DE', { maximumFractionDigits: 1 })} m²</dd>
			</div>
			<div>
				<dt>Module</dt>
				<dd>{totals.modules}</dd>
			</div>
		</dl>
	</section>

	<nav aria-label="Fassaden" class="walls">
		<span class="eyebrow">Fassaden</span>
		{#each editor.project.walls as wall (wall.id)}
			{@const price = editor.price?.walls.find((w) => w.wallId === wall.id)}
			{@const finish = editor.design.wallFinishes[wall.id]}
			{@const surface =
				finish && editor.project ? findSurface(editor.project, finish.surfaceId) : undefined}
			{@const overrides = Object.keys(editor.design.moduleOverrides[wall.id] ?? {}).length}
			<button
				class="wall-card"
				class:active={wall.id === editor.activeWallId}
				class:drop={dropWall === wall.id}
				aria-current={wall.id === editor.activeWallId ? 'true' : undefined}
				data-testid="wall-card-{wall.id}"
				onclick={() => editor.setActiveWall(wall.id)}
				ondragover={(event) => {
					if (!event.dataTransfer?.types.includes(FINISH_MIME)) return;
					event.preventDefault();
					dropWall = wall.id;
				}}
				ondragleave={() => (dropWall = null)}
				ondrop={(event) => {
					const dropped = readDraggedFinish(event.dataTransfer);
					dropWall = null;
					if (dropped) {
						event.preventDefault();
						editor.applyFinishToWall(wall.id, dropped);
					}
				}}
			>
				<svg
					class="thumb"
					viewBox="-150 -150 {wall.width_mm + 300} {wall.height_mm + 300}"
					aria-hidden="true"
				>
					<WallElevation {wall} design={editor.design} textured={false} />
				</svg>
				<span class="info">
					<strong>{wallShortName(wall)}</strong>
					<small>{wallDisplayName(wall)}</small>
					{#if finish && surface}
						<span class="finish">
							<i style:background={colorHex(finish.color)}></i>
							{finishLabel(surface, finish.color)}
						</span>
					{/if}
					{#if overrides > 0}<span class="chip">+ {overrides} individuelle Module</span>{/if}
				</span>
				<span class="price num">{price ? formatCents(price.totalCents) : '–'}</span>
			</button>
		{/each}
	</nav>
{/if}

<style>
	.project {
		display: grid;
		gap: 6px;
		padding-bottom: 14px;
		border-bottom: 1px solid var(--line);
	}
	.project h2 {
		font-size: 16px;
	}
	.facts {
		display: flex;
		gap: 14px;
		margin: 4px 0 0;
		font-size: 12px;
	}
	.facts div {
		display: grid;
	}
	.facts dt {
		color: var(--muted);
	}
	.facts dd {
		margin: 0;
		font-weight: 600;
		font-size: 14px;
	}
	.walls {
		display: grid;
		gap: 8px;
		padding-top: 14px;
	}
	.wall-card {
		display: grid;
		grid-template-columns: 74px 1fr;
		grid-template-rows: auto auto;
		gap: 4px 10px;
		width: 100%;
		padding: 8px;
		text-align: left;
		border: 1px solid var(--line);
		border-radius: var(--radius-m);
		background: var(--surface);
		transition:
			border-color 0.12s ease,
			box-shadow 0.12s ease;
	}
	.wall-card:hover {
		border-color: var(--line-strong);
		box-shadow: var(--shadow-s);
	}
	.wall-card.active {
		border-color: var(--brand);
		box-shadow: 0 0 0 1px var(--brand);
	}
	.wall-card.drop {
		border-color: var(--select);
		background: var(--select-soft);
	}
	.thumb {
		grid-row: span 2;
		width: 74px;
		height: 56px;
		background: var(--surface-muted);
		border-radius: 6px;
	}
	.info {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.info strong {
		font-size: 14px;
	}
	.info small {
		color: var(--muted);
		font-size: 12px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.finish {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 12px;
		color: var(--ink-soft);
	}
	.finish i {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
		flex-shrink: 0;
	}
	.chip {
		justify-self: start;
		font-size: 11px;
		background: var(--select-soft);
		color: var(--select);
	}
	.price {
		grid-column: 2;
		font-weight: 600;
		font-size: 14px;
	}
</style>
