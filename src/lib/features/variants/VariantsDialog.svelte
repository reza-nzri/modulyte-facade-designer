<!--
	Save the current design as a named variant, load or delete variants and compare several
	side by side (appearance per wall, materials, wall prices, totals and differences).
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { formatCents, formatCentsDelta, priceProject } from '$lib/domain';
	import { useEditor } from '$lib/features/editor/context';
	import WallElevation from '$lib/features/canvas/WallElevation.svelte';
	import Dialog from '$lib/features/ui/Dialog.svelte';
	import Icon from '$lib/features/ui/Icon.svelte';
	import {
		colorHex,
		colorLabel,
		surfacePresentation,
		wallShortName
	} from '$lib/features/appearance/appearance';
	import { downloadText } from '$lib/features/files/fileActions';
	import {
		buildDesignDocument,
		serializeDesignDocument,
		suggestExportFileName
	} from '$lib/io/designDocument';
	import type { SavedVariant } from '$lib/persistence/variantRepository';
	import { compareDesigns } from './variantComparison';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const editor = useEditor();
	let name = $state('');
	let compareIds = $state<string[]>([]);
	let renaming = $state<string | null>(null);
	let renameValue = $state('');

	// Runs only when the dialog opens; untrack prevents a loop (refresh writes `variants`).
	$effect(() => {
		if (!open) return;
		untrack(() => {
			name = suggestName();
			void editor.refreshVariants();
		});
	});

	function suggestName() {
		const base = editor.variantName.trim() || 'Variante';
		return editor.variants.some((v) => v.name === base)
			? `Variante ${editor.variants.length + 1}`
			: base;
	}

	const CURRENT = '__current__';

	const comparison = $derived.by(() => {
		if (!editor.project || compareIds.length === 0) return null;
		const entries = [
			{ key: CURRENT, name: 'Aktueller Entwurf', design: editor.design },
			...editor.variants
				.filter((v) => compareIds.includes(v.id))
				.map((v) => ({ key: v.id, name: v.name, design: v.design }))
		];
		return compareDesigns(editor.project, entries);
	});

	function designFor(key: string) {
		return key === CURRENT ? editor.design : editor.variants.find((v) => v.id === key)?.design;
	}

	async function save() {
		const saved = await editor.saveVariant(name);
		if (saved) name = suggestName();
	}

	function toggleCompare(id: string) {
		compareIds = compareIds.includes(id) ? compareIds.filter((x) => x !== id) : [...compareIds, id];
	}

	function exportVariant(variant: SavedVariant) {
		if (!editor.project) return;
		const document = buildDesignDocument(editor.project, variant.design, {
			variantName: variant.name
		});
		downloadText(
			suggestExportFileName(`${editor.project.project}-${variant.name}`),
			serializeDesignDocument(document)
		);
	}

	function variantTotal(variant: SavedVariant) {
		return editor.project ? priceProject(editor.project, variant.design).totalCents : 0;
	}

	const formatDate = (iso: string) =>
		new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
</script>

<Dialog
	bind:open
	title="Varianten"
	subtitle="Entwürfe speichern, wieder laden und miteinander vergleichen."
	width={1040}
	testId="variants-dialog"
>
	<form
		class="save"
		onsubmit={(event) => {
			event.preventDefault();
			void save();
		}}
	>
		<label for="variant-name">Aktuellen Entwurf speichern als</label>
		<div class="row">
			<input
				id="variant-name"
				class="input"
				bind:value={name}
				maxlength="60"
				placeholder="z. B. Klinker mit Holz-Akzenten"
			/>
			<button class="btn btn-primary" type="submit" data-testid="save-variant"
				><Icon name="save" /> Speichern</button
			>
		</div>
		{#if !editor.persistentStorage}
			<p class="warn">
				Der Browserspeicher ist gesperrt – Varianten gehen beim Schließen verloren. Bitte zusätzlich
				exportieren.
			</p>
		{/if}
	</form>

	{#if editor.variants.length === 0}
		<div class="empty">
			<Icon name="layers" size={28} />
			<p>
				Noch keine Varianten gespeichert. Speichern Sie verschiedene Ideen und vergleichen Sie
				Aussehen und Preis.
			</p>
		</div>
	{:else}
		<ul class="list" aria-label="Gespeicherte Varianten">
			{#each editor.variants as variant (variant.id)}
				<li
					class="variant card"
					class:comparing={compareIds.includes(variant.id)}
					data-testid="variant-item"
				>
					<div class="thumbs" aria-hidden="true">
						{#each editor.project?.walls ?? [] as wall (wall.id)}
							<svg viewBox="-100 -100 {wall.width_mm + 200} {wall.height_mm + 200}">
								<WallElevation {wall} design={variant.design} textured={false} />
							</svg>
						{/each}
					</div>
					<div class="meta">
						{#if renaming === variant.id}
							<form
								onsubmit={(event) => {
									event.preventDefault();
									void editor.renameVariant(variant, renameValue);
									renaming = null;
								}}
							>
								<!-- svelte-ignore a11y_autofocus -->
								<input
									class="input"
									bind:value={renameValue}
									autofocus
									onblur={() => (renaming = null)}
									aria-label="Neuer Name"
								/>
							</form>
						{:else}
							<strong>{variant.name}</strong>
						{/if}
						<small>{formatDate(variant.updatedAt)}</small>
						<span class="num total">{formatCents(variantTotal(variant))}</span>
					</div>
					<div class="actions">
						<label class="compare-toggle">
							<input
								type="checkbox"
								checked={compareIds.includes(variant.id)}
								onchange={() => toggleCompare(variant.id)}
							/>
							Vergleichen
						</label>
						<button
							class="btn btn-small"
							onclick={() => {
								editor.loadVariant(variant);
								open = false;
							}}>Laden</button
						>
						<button
							class="btn btn-ghost btn-icon btn-small"
							title="Umbenennen"
							aria-label="Umbenennen"
							onclick={() => {
								renaming = variant.id;
								renameValue = variant.name;
							}}><Icon name="pencil" size={15} /></button
						>
						<button
							class="btn btn-ghost btn-icon btn-small"
							title="Als Datei exportieren"
							aria-label="Exportieren"
							onclick={() => exportVariant(variant)}><Icon name="download" size={15} /></button
						>
						<button
							class="btn btn-ghost btn-icon btn-small btn-danger"
							title="Löschen"
							aria-label="Löschen"
							onclick={() => {
								if (confirm(`Variante „${variant.name}“ löschen?`))
									void editor.deleteVariant(variant);
								compareIds = compareIds.filter((id) => id !== variant.id);
							}}><Icon name="trash" size={15} /></button
						>
					</div>
				</li>
			{/each}
		</ul>
	{/if}

	{#if comparison && editor.project}
		{@const project = editor.project}
		<section class="compare" aria-labelledby="compare-title" data-testid="variant-comparison">
			<h3 id="compare-title">Vergleich</h3>
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th scope="col">Fassade</th>
							{#each comparison.designs as design (design.key)}
								<th scope="col">
									{design.name}
									{#if comparison.cheapestKey === design.key}<span class="chip best"
											>Günstigste</span
										>{/if}
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each project.walls as wall (wall.id)}
							<tr class:differs={comparison.differingWalls.has(wall.id)}>
								<th scope="row">
									{wallShortName(wall)}
									{#if comparison.differingWalls.has(wall.id)}<small>unterschiedlich</small>{/if}
								</th>
								{#each comparison.designs as design (design.key)}
									{@const cell = design.walls.find((w) => w.wallId === wall.id)}
									{@const d = designFor(design.key)}
									<td>
										{#if d}
											<svg
												class="cell-thumb"
												viewBox="-100 -100 {wall.width_mm + 200} {wall.height_mm + 200}"
												aria-hidden="true"
											>
												<WallElevation {wall} design={d} />
											</svg>
										{/if}
										{#if cell?.surfaceId && cell.color}
											<span class="finish"
												><i style:background={colorHex(cell.color)}></i>{surfacePresentation({
													id: cell.surfaceId,
													name: cell.surfaceName ?? cell.surfaceId
												}).label} · {colorLabel(cell.color)}</span
											>
										{/if}
										{#if cell && cell.individualModules > 0}<small
												>+ {cell.individualModules} individuelle Module</small
											>{/if}
										<span class="num price">{formatCents(cell?.totalCents ?? 0)}</span>
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<th scope="row">Gesamt</th>
							{#each comparison.designs as design (design.key)}
								{@const base = comparison.designs[0]?.totalCents ?? 0}
								<td>
									<strong class="num">{formatCents(design.totalCents)}</strong>
									{#if design.key !== CURRENT}
										<small
											class="num"
											class:delta-up={design.totalCents > base}
											class:delta-down={design.totalCents < base}
											>{formatCentsDelta(design.totalCents - base)} ggü. aktuell</small
										>
									{/if}
								</td>
							{/each}
						</tr>
					</tfoot>
				</table>
			</div>
		</section>
	{:else if editor.variants.length > 0}
		<p class="hint">
			Haken Sie „Vergleichen“ bei einer oder mehreren Varianten an, um sie dem aktuellen Entwurf
			gegenüberzustellen.
		</p>
	{/if}
</Dialog>

<style>
	.save {
		display: grid;
		gap: 6px;
		margin-bottom: 18px;
	}
	.save label {
		font-weight: 500;
		font-size: 14px;
	}
	.row {
		display: flex;
		gap: 8px;
	}
	.warn {
		margin: 0;
		font-size: 12px;
		color: var(--warning);
	}
	.empty {
		display: grid;
		justify-items: center;
		gap: 8px;
		padding: 28px;
		color: var(--muted);
		text-align: center;
		border: 1px dashed var(--line-strong);
		border-radius: var(--radius-m);
	}
	.empty p {
		margin: 0;
		max-width: 420px;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 8px;
	}
	.variant {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 14px;
		align-items: center;
		padding: 10px 12px;
	}
	.variant.comparing {
		border-color: var(--select);
	}
	.thumbs {
		display: grid;
		grid-template-columns: repeat(4, 52px);
		gap: 4px;
	}
	.thumbs svg {
		width: 52px;
		height: 36px;
		background: var(--surface-muted);
		border-radius: 4px;
	}
	.meta {
		display: grid;
		min-width: 0;
	}
	.meta small {
		color: var(--muted);
		font-size: 12px;
	}
	.total {
		font-weight: 600;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.compare-toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		margin-right: 6px;
	}
	.compare-toggle input {
		accent-color: var(--select);
	}
	.compare {
		margin-top: 20px;
	}
	.compare h3 {
		font-size: 16px;
		margin-bottom: 10px;
	}
	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--line);
		border-radius: var(--radius-m);
	}
	table {
		border-collapse: collapse;
		width: 100%;
		font-size: 13px;
	}
	th,
	td {
		padding: 10px 12px;
		border-bottom: 1px solid var(--line);
		text-align: left;
		vertical-align: top;
	}
	thead th {
		background: var(--surface-muted);
		font-weight: 600;
	}
	tbody th small {
		display: block;
		color: var(--select);
		font-weight: 500;
	}
	tr.differs td {
		background: #fafbff;
	}
	td {
		min-width: 170px;
	}
	td > * {
		display: block;
	}
	.cell-thumb {
		width: 150px;
		height: 90px;
		background: var(--surface-muted);
		border-radius: 6px;
		margin-bottom: 6px;
	}
	.finish {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.finish i {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
	}
	td small {
		color: var(--muted);
	}
	.price {
		font-weight: 600;
		margin-top: 4px;
	}
	tfoot td strong {
		font-size: 16px;
	}
	.best {
		background: #e3f3ea;
		color: var(--positive);
		margin-left: 6px;
	}
	.hint {
		color: var(--muted);
		font-size: 13px;
		margin: 14px 0 0;
	}
</style>
