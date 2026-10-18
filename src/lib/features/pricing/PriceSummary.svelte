<!--
	Live price breakdown: the active wall line by line and the project total. All numbers come
	from the domain pricing function; this component only formats them.
-->
<script lang="ts">
	import { formatCents, formatCentsDelta, mm2ToM2 } from '$lib/domain';
	import { useEditor } from '$lib/features/editor/context';
	import Icon from '$lib/features/ui/Icon.svelte';
	import {
		colorHex,
		colorLabel,
		surfacePresentation,
		wallShortName
	} from '$lib/features/appearance/appearance';

	const editor = useEditor();
	let showInfo = $state(false);

	const wallPrice = $derived(editor.activeWallPrice);
	const m2 = (mm2: number) =>
		mm2ToM2(mm2).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
</script>

{#if editor.price && wallPrice && editor.activeWall}
	<section class="price" aria-labelledby="price-title" data-testid="price-summary">
		<div class="wall-block">
			<div class="head">
				<h2 id="price-title" class="eyebrow">Preis {wallShortName(editor.activeWall)}</h2>
				<strong class="num" data-testid="wall-total">{formatCents(wallPrice.totalCents)}</strong>
			</div>
			<ul class="lines">
				{#each wallPrice.lines as line (line.surfaceId + line.color)}
					<li>
						<i style:background={colorHex(line.color)}></i>
						<span class="label">
							{surfacePresentation({ id: line.surfaceId, name: line.surfaceName }).label} · {colorLabel(
								line.color
							)}
							<small class="num"
								>{m2(line.areaMm2)} m² × {formatCents(Math.round(line.eurPerM2 * 100))}</small
							>
						</span>
						<span class="num">{formatCents(line.costCents)}</span>
					</li>
				{/each}
			</ul>
			<div class="areas num">
				<span title="Wandfläche gesamt">Wand {m2(wallPrice.areas.grossMm2)} m²</span>
				<span title="Fenster und Türen werden nicht berechnet"
					>− Öffnungen {m2(wallPrice.areas.openingsMm2)} m²</span
				>
				<span title="Mit Modulen belegte Fläche = berechnete Fläche"
					>= {m2(wallPrice.areas.coveredMm2)} m²</span
				>
			</div>
			{#if wallPrice.areas.uncoveredMm2 > 0}
				<p class="warn">
					<Icon name="warning" size={14} />
					{m2(wallPrice.areas.uncoveredMm2)} m² dieser Wand sind nicht mit Modulen belegt und nicht im
					Preis enthalten.
				</p>
			{/if}
		</div>

		<div class="total">
			<div>
				<span class="eyebrow">Gesamt (alle Fassaden)</span>
				<strong class="num" data-testid="project-total"
					>{formatCents(editor.price.totalCents)}</strong
				>
			</div>
			{#if editor.lastDeltaCents !== null && editor.lastDeltaCents !== 0}
				<span
					class="delta num"
					class:delta-up={editor.lastDeltaCents > 0}
					class:delta-down={editor.lastDeltaCents < 0}
					title="Änderung durch die letzte Aktion"
				>
					{formatCentsDelta(editor.lastDeltaCents)}
				</span>
			{/if}
		</div>

		<button class="info-toggle" onclick={() => (showInfo = !showInfo)} aria-expanded={showInfo}>
			<Icon name="info" size={14} /> Was ist im Preis enthalten?
		</button>
		{#if showInfo}
			<div class="info">
				<p>
					<strong>Enthalten:</strong> die gewählte Fassadenoberfläche auf allen Modulflächen (m²-Preise
					laut Projektdaten).
				</p>
				<p>
					<strong>Nicht enthalten:</strong> Dämmmodule, Unterkonstruktion, Fensterlaibungen, Verschnitt,
					Montage, Transport und Mehrwertsteuer. Diese Posten kalkuliert modulyte im Angebot.
				</p>
				<p>Unverbindliche Schätzung – kein Angebot.</p>
			</div>
		{/if}
	</section>
{/if}

<style>
	.price {
		display: grid;
		gap: 10px;
	}
	.wall-block {
		display: grid;
		gap: 8px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.head strong {
		font-size: 17px;
	}
	.lines {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 6px;
		font-size: 13px;
	}
	.lines li {
		display: grid;
		grid-template-columns: 12px 1fr auto;
		gap: 8px;
		align-items: start;
	}
	.lines i {
		width: 12px;
		height: 12px;
		margin-top: 3px;
		border-radius: 3px;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
	}
	.label {
		display: grid;
	}
	.label small {
		color: var(--muted);
		font-size: 12px;
	}
	.areas {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 10px;
		font-size: 12px;
		color: var(--muted);
	}
	.warn {
		display: flex;
		gap: 6px;
		margin: 0;
		padding: 8px;
		border-radius: var(--radius-s);
		background: var(--warning-soft);
		color: var(--warning);
		font-size: 12px;
	}
	.total {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 14px;
		border-radius: var(--radius-m);
		background: var(--ink);
		color: #fff;
	}
	.total > div {
		display: grid;
	}
	.total .eyebrow {
		color: rgba(255, 255, 255, 0.65);
	}
	.total strong {
		font-size: 22px;
		letter-spacing: -0.01em;
	}
	.delta {
		font-size: 13px;
		font-weight: 600;
		padding: 3px 9px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.12);
	}
	.delta.delta-up {
		color: #ffc7b8;
	}
	.delta.delta-down {
		color: #b6f0cf;
	}
	.info-toggle {
		justify-self: start;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: 0;
		background: transparent;
		padding: 0;
		font-size: 12px;
		color: var(--muted);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.info {
		font-size: 12px;
		color: var(--ink-soft);
		background: var(--surface-muted);
		border: 1px solid var(--line);
		border-radius: var(--radius-s);
		padding: 8px 10px;
	}
	.info p {
		margin: 0 0 4px;
	}
</style>
