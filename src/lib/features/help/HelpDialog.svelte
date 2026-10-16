<!--
	First-visit onboarding (3 steps), a glossary of technical terms in plain German, keyboard
	shortcuts and a "copy diagnostics" button for support requests.
-->
<script lang="ts">
	import Dialog from '$lib/features/ui/Dialog.svelte';
	import Icon from '$lib/features/ui/Icon.svelte';
	import { getLogEntries } from '$lib/observability/logger';
	import { APP_VERSION } from '$lib/io/designDocument';

	let { open = $bindable(false) }: { open?: boolean } = $props();
	let copied = $state(false);

	const steps = [
		{
			title: 'Fassade wählen',
			text: 'Links sehen Sie alle Seiten Ihres Hauses. Klicken Sie auf eine Fassade, um sie zu bearbeiten.'
		},
		{
			title: 'Bereich markieren (optional)',
			text: 'Ohne Auswahl gilt Ihre Wahl für die ganze Wand. Für Akzente klicken Sie Module an, ziehen einen Rahmen auf oder nutzen „Sockelzone“, „Rund um Fenster & Türen“ usw.'
		},
		{
			title: 'Material & Farbe wählen',
			text: 'Rechts auf eine Farbe klicken – oder das Farbfeld direkt auf die Fassade ziehen. Der Preis aktualisiert sich sofort.'
		}
	];

	const glossary = [
		[
			'Modul',
			'Ein vorgefertigtes Dämmelement aus Holz, das an Ihre Hauswand gehängt wird. Auf die Module kommt die sichtbare Oberfläche.'
		],
		[
			'Standardmodul',
			'Modul im Standardformat, in Serie gefertigt. Es deckt den größten Teil der Fassade ab.'
		],
		[
			'Passstück (Sondermodul)',
			'Auf Maß gefertigtes Modul für Stellen, an denen kein Standardmodul passt – an Fenstern, Türen und Hauskanten. In der Ansicht mit einer orangen Ecke markiert.'
		],
		[
			'Oberfläche / Bekleidung',
			'Das sichtbare Material Ihrer Fassade, z. B. Klinkerriemchen, Fassadenplatten oder Holzleisten.'
		],
		[
			'Sockelzone',
			'Der unterste Bereich der Fassade direkt über dem Boden – oft in einem robusten Material abgesetzt.'
		],
		[
			'Verlegeplan',
			'Plan, der zeigt, wo welches Modul sitzt. Er wird von modulyte aus dem 3D-Scan Ihres Hauses erstellt und ist hier bereits enthalten.'
		],
		['Stückliste', 'Liste aller Module mit Maßen – die Grundlage für die Fertigung.']
	] as const;

	const shortcuts = [
		['Strg + Z / Strg + Umschalt + Z', 'Rückgängig / Wiederholen'],
		['Klick, Umschalt + Klick', 'Modul auswählen / hinzufügen'],
		['Ziehen', 'Rahmenauswahl'],
		['Leertaste halten + Ziehen, H', 'Ansicht verschieben'],
		['Mausrad, + / −, 0', 'Zoomen / Einpassen'],
		['Pfeiltasten, Enter', 'Module per Tastatur wählen'],
		['Strg + A, Esc', 'Alles auswählen / Auswahl aufheben'],
		['2 / 3', '2D-Ansicht / 3D-Haus'],
		['Strg + S / O / E / P', 'Variante speichern / Öffnen / Exportieren / Zusammenfassung']
	] as const;

	async function copyDiagnostics() {
		const report = JSON.stringify(
			{
				app: 'modulyte-facade-designer',
				version: APP_VERSION,
				userAgent: navigator.userAgent,
				log: getLogEntries()
			},
			null,
			2
		);
		try {
			await navigator.clipboard.writeText(report);
			copied = true;
			setTimeout(() => (copied = false), 2500);
		} catch {
			copied = false;
		}
	}
</script>

<Dialog
	bind:open
	title="So funktioniert der Fassadendesigner"
	subtitle="In drei Schritten zu Ihrer Wunschfassade."
	width={760}
	testId="help-dialog"
>
	<ol class="steps">
		{#each steps as step, index (step.title)}
			<li>
				<span class="n">{index + 1}</span>
				<div>
					<strong>{step.title}</strong>
					<p>{step.text}</p>
				</div>
			</li>
		{/each}
	</ol>

	<h3>Begriffe einfach erklärt</h3>
	<dl class="glossary">
		{#each glossary as [term, text] (term)}
			<div>
				<dt>{term}</dt>
				<dd>{text}</dd>
			</div>
		{/each}
	</dl>

	<details>
		<summary>Tastenkürzel</summary>
		<table>
			<tbody>
				{#each shortcuts as [keys, action] (keys)}
					<tr><td class="mono">{keys}</td><td>{action}</td></tr>
				{/each}
			</tbody>
		</table>
	</details>

	<p class="note">
		<Icon name="info" size={14} /> Preise sind unverbindliche Schätzungen für die Fassadenoberfläche auf
		Basis der Projektdaten. Ihr Entwurf wird automatisch in diesem Browser gespeichert; mit „Exportieren“
		erhalten Sie eine Datei für modulyte.
	</p>

	{#snippet footer()}
		<button
			class="btn btn-ghost"
			onclick={copyDiagnostics}
			title="Technische Informationen für den Support kopieren"
		>
			<Icon name={copied ? 'check' : 'copy'} />
			{copied ? 'Kopiert' : 'Diagnose kopieren'}
		</button>
		<button class="btn btn-primary" onclick={() => (open = false)} data-testid="help-start"
			>Los geht’s</button
		>
	{/snippet}
</Dialog>

<style>
	.steps {
		list-style: none;
		padding: 0;
		margin: 0 0 20px;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
	}
	.steps li {
		display: flex;
		gap: 10px;
		padding: 12px;
		border: 1px solid var(--line);
		border-radius: var(--radius-m);
		background: var(--surface-muted);
	}
	.n {
		flex-shrink: 0;
		width: 26px;
		height: 26px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: var(--brand);
		color: #fff;
		font-weight: 600;
		font-size: 13px;
	}
	.steps p {
		margin: 4px 0 0;
		font-size: 13px;
		color: var(--ink-soft);
	}
	h3 {
		font-size: 15px;
		margin-bottom: 8px;
	}
	.glossary {
		display: grid;
		gap: 8px;
		margin: 0 0 16px;
	}
	.glossary div {
		display: grid;
		grid-template-columns: 180px 1fr;
		gap: 12px;
		font-size: 13px;
	}
	.glossary dt {
		font-weight: 600;
	}
	.glossary dd {
		margin: 0;
		color: var(--ink-soft);
	}
	details {
		font-size: 13px;
		margin-bottom: 12px;
	}
	summary {
		cursor: pointer;
		font-weight: 600;
	}
	table {
		margin-top: 8px;
		border-collapse: collapse;
		width: 100%;
	}
	td {
		padding: 4px 8px;
		border-bottom: 1px solid var(--line);
	}
	.note {
		display: flex;
		gap: 8px;
		margin: 0;
		font-size: 12px;
		color: var(--muted);
	}
	@media (max-width: 720px) {
		.steps {
			grid-template-columns: 1fr;
		}
		.glossary div {
			grid-template-columns: 1fr;
			gap: 2px;
		}
	}
</style>
