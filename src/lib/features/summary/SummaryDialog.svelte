<script lang="ts">
	import { useEditor } from '$lib/features/editor/context';
	import { exportDesign } from '$lib/features/files/fileActions';
	import Dialog from '$lib/features/ui/Dialog.svelte';
	import Icon from '$lib/features/ui/Icon.svelte';
	import { logger } from '$lib/observability/logger';
	import PrintSummary from './PrintSummary.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();
	const editor = useEditor();

	function print() {
		logger.info('summary.print');
		// The dialog is hidden in print CSS; the print-only root renders the document.
		open = false;
		setTimeout(() => window.print(), 50);
	}
</script>

<Dialog
	bind:open
	title="Kundenzusammenfassung"
	subtitle="Übersicht zum Ausdrucken oder als PDF – für Sie und für modulyte."
	width={900}
	testId="summary-dialog"
>
	<div class="preview">
		<div class="page"><PrintSummary /></div>
	</div>
	{#snippet footer()}
		<button
			class="btn"
			onclick={() =>
				editor.project && exportDesign(editor.project, editor.design, editor.variantName)}
		>
			<Icon name="download" /> Entwurfsdaten (JSON)
		</button>
		<button class="btn btn-primary" onclick={print} data-testid="print-button"
			><Icon name="print" /> Drucken / Als PDF speichern</button
		>
	{/snippet}
</Dialog>

<style>
	.preview {
		background: var(--paper-deep);
		padding: 20px;
		border-radius: var(--radius-m);
	}
	.page {
		background: #fff;
		padding: 14mm;
		box-shadow: var(--shadow-m);
		max-width: 210mm;
		margin: 0 auto;
	}
</style>
