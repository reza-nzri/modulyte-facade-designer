<!--
	Printable customer summary (A4). Rendered inside the summary dialog as a preview and in a
	print-only root, so "Drucken / Als PDF speichern" prints exactly this document.
-->
<script lang="ts">
	import { findSurface, formatCents, mm2ToM2 } from '$lib/domain';
	import { useEditor } from '$lib/features/editor/context';
	import WallElevation from '$lib/features/canvas/WallElevation.svelte';
	import {
		colorHex,
		colorLabel,
		finishLabel,
		surfacePresentation,
		wallDisplayName,
		wallShortName
	} from '$lib/features/appearance/appearance';
	import { PRICING_ASSUMPTIONS_DE } from '$lib/io/designDocument';

	const editor = useEditor();
	const today = new Date().toLocaleDateString('de-DE', {
		day: '2-digit',
		month: 'long',
		year: 'numeric'
	});
	const m2 = (mm2: number) =>
		mm2ToM2(mm2).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
</script>

{#if editor.project && editor.price}
	{@const project = editor.project}
	{@const price = editor.price}
	<article class="summary" data-testid="print-summary">
		<header>
			<div>
				<p class="brand">modulyte · Fassadendesigner</p>
				<h1>Ihre Fassadengestaltung</h1>
				<p class="sub">{project.project}</p>
			</div>
			<dl class="meta">
				<div>
					<dt>Entwurf</dt>
					<dd>{editor.variantName}</dd>
				</div>
				<div>
					<dt>Datum</dt>
					<dd>{today}</dd>
				</div>
				<div>
					<dt>Referenz</dt>
					<dd class="mono">{editor.projectKey}</dd>
				</div>
			</dl>
		</header>

		<section class="overview">
			<div class="kpi">
				<span>Geschätzter Materialpreis Fassadenoberfläche</span><strong class="num"
					>{formatCents(price.totalCents)}</strong
				>
			</div>
			<div class="kpi">
				<span>Gestaltete Fläche</span><strong class="num">{m2(price.totalAreaMm2)} m²</strong>
			</div>
			<div class="kpi">
				<span>Fassaden</span><strong class="num">{project.walls.length}</strong>
			</div>
		</section>

		<section>
			<h2>Materialien im Überblick</h2>
			<table>
				<thead
					><tr
						><th>Material</th><th>Farbe</th><th class="r">Fläche</th><th class="r">Preis/m²</th><th
							class="r">Betrag</th
						></tr
					></thead
				>
				<tbody>
					{#each price.lines as line (line.surfaceId + line.color)}
						<tr>
							<td>{surfacePresentation({ id: line.surfaceId, name: line.surfaceName }).label}</td>
							<td
								><i class="dot" style:background={colorHex(line.color)}></i>{colorLabel(
									line.color
								)}</td
							>
							<td class="r num">{m2(line.areaMm2)} m²</td>
							<td class="r num">{formatCents(Math.round(line.eurPerM2 * 100))}</td>
							<td class="r num">{formatCents(line.costCents)}</td>
						</tr>
					{/each}
				</tbody>
				<tfoot
					><tr><td colspan="4">Summe</td><td class="r num">{formatCents(price.totalCents)}</td></tr
					></tfoot
				>
			</table>
		</section>

		{#each project.walls as wall (wall.id)}
			{@const wallPrice = price.walls.find((w) => w.wallId === wall.id)}
			{@const finish = editor.design.wallFinishes[wall.id]}
			{@const surface = finish ? findSurface(project, finish.surfaceId) : undefined}
			{@const overrides = Object.keys(editor.design.moduleOverrides[wall.id] ?? {}).length}
			<section class="wall">
				<div class="wall-head">
					<h2>{wallShortName(wall)} <small>{wallDisplayName(wall)}</small></h2>
					<strong class="num">{formatCents(wallPrice?.totalCents ?? 0)}</strong>
				</div>
				<div class="wall-body">
					<svg
						viewBox="-150 -150 {wall.width_mm + 300} {wall.height_mm + 300}"
						aria-label="Ansicht {wallShortName(wall)}"
					>
						<WallElevation {wall} design={editor.design} />
					</svg>
					<div class="facts">
						<p>
							<strong>Grundgestaltung:</strong>
							{finish && surface ? finishLabel(surface, finish.color) : '–'}
						</p>
						{#if overrides > 0}<p>
								<strong>Individuell gestaltet:</strong>
								{overrides} Module
							</p>{/if}
						<p class="num">
							Wand {(wall.width_mm / 1000).toLocaleString('de-DE')} × {(
								wall.height_mm / 1000
							).toLocaleString('de-DE')} m · {wall.openings.length} Fenster/Türen
						</p>
						{#if wallPrice}
							<p class="num">
								Fläche {m2(wallPrice.areas.grossMm2)} m² − Öffnungen {m2(
									wallPrice.areas.openingsMm2
								)} m² = {m2(wallPrice.areas.coveredMm2)} m²
							</p>
							<p class="num">
								{wallPrice.areas.standardCount} Standardmodule · {wallPrice.areas.specialCount} Passstücke
							</p>
							<ul>
								{#each wallPrice.lines as line (line.surfaceId + line.color)}
									<li class="num">
										{surfacePresentation({ id: line.surfaceId, name: line.surfaceName }).label}
										{colorLabel(line.color)}: {m2(line.areaMm2)} m² · {formatCents(line.costCents)}
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</div>
			</section>
		{/each}

		<section class="notes">
			<h2>Grundlagen der Berechnung</h2>
			<ul>
				{#each PRICING_ASSUMPTIONS_DE as assumption (assumption)}<li>{assumption}</li>{/each}
			</ul>
			<p class="footer">
				Erstellt mit dem modulyte Fassadendesigner. Die vollständigen Entwurfsdaten (JSON-Export)
				enthalten jede Modulzuweisung und ermöglichen modulyte die exakte Nachvollziehbarkeit dieser
				Gestaltung.
			</p>
		</section>
	</article>
{/if}

<style>
	.summary {
		font-family: var(--font-sans);
		color: #1c1f1d;
		background: #fff;
		max-width: 190mm;
		margin: 0 auto;
		font-size: 10.5pt;
	}
	header {
		display: flex;
		justify-content: space-between;
		gap: 24px;
		padding-bottom: 12px;
		border-bottom: 2px solid #24433a;
	}
	.brand {
		margin: 0;
		font-size: 9pt;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #24433a;
		font-weight: 600;
	}
	h1 {
		font-size: 20pt;
		margin: 4px 0 2px;
	}
	.sub {
		margin: 0;
		color: #555;
	}
	.meta {
		margin: 0;
		display: grid;
		gap: 4px;
		font-size: 9pt;
		text-align: right;
	}
	.meta dt {
		color: #777;
	}
	.meta dd {
		margin: 0;
		font-weight: 600;
	}
	.overview {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr;
		gap: 10px;
		margin: 14px 0;
	}
	.kpi {
		border: 1px solid #ddd;
		border-radius: 6px;
		padding: 8px 10px;
		display: grid;
	}
	.kpi span {
		font-size: 8.5pt;
		color: #666;
	}
	.kpi strong {
		font-size: 15pt;
	}
	h2 {
		font-size: 12pt;
		margin: 14px 0 6px;
	}
	h2 small {
		font-weight: 400;
		color: #777;
		font-size: 9pt;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 9.5pt;
	}
	th,
	td {
		padding: 5px 6px;
		border-bottom: 1px solid #e5e5e5;
		text-align: left;
	}
	th {
		color: #666;
		font-weight: 500;
	}
	.r {
		text-align: right;
	}
	tfoot td {
		font-weight: 700;
		border-top: 1.5px solid #1c1f1d;
	}
	.dot {
		display: inline-block;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		margin-right: 5px;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25);
	}
	.wall {
		break-inside: avoid;
		border-top: 1px solid #e5e5e5;
		margin-top: 10px;
	}
	.wall-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.wall-body {
		display: grid;
		grid-template-columns: 95mm 1fr;
		gap: 12px;
		align-items: start;
	}
	.wall-body svg {
		width: 100%;
		height: auto;
		max-height: 62mm;
		background: #f7f6f2;
		border-radius: 4px;
	}
	.facts p {
		margin: 0 0 3px;
		font-size: 9.5pt;
	}
	.facts ul {
		margin: 4px 0 0;
		padding-left: 16px;
		font-size: 9pt;
	}
	.notes {
		break-inside: avoid;
		margin-top: 14px;
		font-size: 9pt;
		color: #444;
	}
	.notes ul {
		padding-left: 16px;
		margin: 0;
	}
	.footer {
		margin-top: 10px;
		color: #777;
		font-size: 8.5pt;
	}
</style>
