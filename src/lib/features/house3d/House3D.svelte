<!--
	3D house view (three.js). Shares state with the 2D editor: materials, the active wall and the
	selection are synchronised both ways. Clicking a module selects it (Shift adds/removes).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import { useEditor } from '$lib/features/editor/context';
	import Icon from '$lib/features/ui/Icon.svelte';
	import { wallShortName } from '$lib/features/appearance/appearance';
	import { logger } from '$lib/observability/logger';
	import { HouseScene, type ModuleMeshData } from './houseScene';

	const editor = useEditor();

	let host = $state<HTMLDivElement>();
	let canvas = $state<HTMLCanvasElement>();
	let webglError = $state<string | null>(null);
	let autoRotate = $state(false);
	let ready = $state(false);

	let renderer: THREE.WebGLRenderer | undefined;
	let camera: THREE.PerspectiveCamera | undefined;
	let controls: OrbitControls | undefined;
	let scene: THREE.Scene | undefined;
	let house: HouseScene | null = null;
	let builtFor: unknown = null;
	let frame = 0;
	let tween: {
		from: THREE.Vector3;
		to: THREE.Vector3;
		fromTarget: THREE.Vector3;
		toTarget: THREE.Vector3;
		start: number;
	} | null = null;

	function frameHouse() {
		if (!camera || !controls || !house) return;
		const { width, depth, height } = house.layout;
		const size = Math.max(width, depth, height);
		moveCamera(
			new THREE.Vector3(size * 1.25, size * 0.85, size * 1.55),
			new THREE.Vector3(0, height * 0.42, 0)
		);
	}

	function moveCamera(position: THREE.Vector3, target: THREE.Vector3) {
		if (!camera || !controls) return;
		tween = {
			from: camera.position.clone(),
			to: position,
			fromTarget: controls.target.clone(),
			toTarget: target,
			start: performance.now()
		};
	}

	function lookAtWall(wallId: string) {
		const viewpoint = house?.viewpointFor(wallId);
		if (viewpoint) moveCamera(viewpoint.position, viewpoint.target);
	}

	onMount(() => {
		if (!host || !canvas) return;
		try {
			renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
		} catch (error) {
			webglError =
				'Ihr Browser unterstützt keine 3D-Darstellung (WebGL). Die 2D-Ansicht funktioniert weiterhin.';
			logger.warn('webgl.unavailable', { message: String(error) });
			return;
		}
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.05;

		scene = new THREE.Scene();
		scene.background = new THREE.Color('#eef1f2');
		scene.fog = new THREE.Fog('#eef1f2', 60_000, 140_000);

		camera = new THREE.PerspectiveCamera(35, 1, 100, 300_000);
		controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.dampingFactor = 0.08;
		controls.minDistance = 4_000;
		controls.maxDistance = 80_000;
		controls.maxPolarAngle = Math.PI / 2 - 0.04;
		controls.addEventListener('start', () => (tween = null));

		scene.add(new THREE.HemisphereLight('#ffffff', '#b9b2a2', 1.4));
		const sun = new THREE.DirectionalLight('#fff4e6', 2.4);
		sun.position.set(14_000, 22_000, 18_000);
		sun.castShadow = true;
		sun.shadow.mapSize.set(2048, 2048);
		sun.shadow.camera.left = -14_000;
		sun.shadow.camera.right = 14_000;
		sun.shadow.camera.top = 14_000;
		sun.shadow.camera.bottom = -14_000;
		sun.shadow.camera.far = 80_000;
		sun.shadow.bias = -0.0004;
		scene.add(sun);

		const ground = new THREE.Mesh(
			new THREE.CircleGeometry(60_000, 64),
			new THREE.MeshStandardMaterial({ color: '#dcd8cd', roughness: 1 })
		);
		ground.rotation.x = -Math.PI / 2;
		ground.receiveShadow = true;
		scene.add(ground);
		const grid = new THREE.GridHelper(40_000, 40, '#c4bfb2', '#d2cdc1');
		grid.position.y = 2;
		scene.add(grid);

		const resize = () => {
			if (!host || !renderer || !camera) return;
			const { clientWidth, clientHeight } = host;
			renderer.setSize(clientWidth, clientHeight);
			camera.aspect = clientWidth / Math.max(1, clientHeight);
			camera.updateProjectionMatrix();
		};
		const observer = new ResizeObserver(resize);
		observer.observe(host);
		resize();

		// Click-to-select (ignores drags used for orbiting).
		const raycaster = new THREE.Raycaster();
		let downAt: { x: number; y: number } | null = null;
		const onDown = (event: PointerEvent) => (downAt = { x: event.clientX, y: event.clientY });
		const onUp = (event: PointerEvent) => {
			if (!downAt || !renderer || !camera || !house) return;
			const moved = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y);
			downAt = null;
			if (moved > 5) return;
			const rect = renderer.domElement.getBoundingClientRect();
			const pointer = new THREE.Vector2(
				((event.clientX - rect.left) / rect.width) * 2 - 1,
				-((event.clientY - rect.top) / rect.height) * 2 + 1
			);
			raycaster.setFromCamera(pointer, camera);
			const hit = raycaster.intersectObjects(house.pickables, false)[0];
			if (hit) {
				const data = hit.object.userData as ModuleMeshData;
				editor.focusModule(data.wallId, data.moduleId, event.shiftKey ? 'toggle' : 'replace');
			} else if (!event.shiftKey) {
				editor.clearSelection();
			}
		};
		renderer.domElement.addEventListener('pointerdown', onDown);
		renderer.domElement.addEventListener('pointerup', onUp);

		const loop = (time: number) => {
			frame = requestAnimationFrame(loop);
			if (!renderer || !scene || !camera || !controls) return;
			if (tween) {
				const t = Math.min(1, (time - tween.start) / 650);
				const eased = 1 - Math.pow(1 - t, 3);
				camera.position.lerpVectors(tween.from, tween.to, eased);
				controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
				if (t >= 1) tween = null;
			}
			controls.autoRotate = autoRotate;
			controls.autoRotateSpeed = 0.8;
			controls.update();
			renderer.render(scene, camera);
		};
		frame = requestAnimationFrame(loop);
		ready = true;

		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			renderer?.domElement.removeEventListener('pointerdown', onDown);
			renderer?.domElement.removeEventListener('pointerup', onUp);
			controls?.dispose();
			house?.dispose();
			ground.geometry.dispose();
			(ground.material as THREE.Material).dispose();
			grid.dispose();
			renderer?.dispose();
		};
	});

	// (Re)build geometry when the project changes.
	$effect(() => {
		const project = editor.project;
		if (!ready || !scene || !project || builtFor === project) return;
		if (house) {
			scene.remove(house.root);
			house.dispose();
		}
		house = new HouseScene(project);
		scene.add(house.root);
		builtFor = project;
		house.update(editor.design, editor.activeWallId, new Set(editor.selection));
		frameHouse();
	});

	// Cheap material/selection updates on every design change.
	$effect(() => {
		const design = editor.design;
		const activeWallId = editor.activeWallId;
		const selection = new Set(editor.selection);
		if (ready && house && builtFor === editor.project)
			house.update(design, activeWallId, selection);
	});
</script>

<div class="view3d">
	<div class="host" bind:this={host}>
		<canvas bind:this={canvas} data-testid="house-3d-canvas" aria-label="3D-Ansicht des Hauses"
		></canvas>
	</div>

	{#if webglError}
		<div class="fallback card"><Icon name="warning" /> {webglError}</div>
	{:else}
		<div class="overlay top-left">
			<div class="views" role="group" aria-label="Kameraposition">
				<button onclick={frameHouse} title="Ganzes Haus"
					><Icon name="house" size={15} /> Übersicht</button
				>
				{#each editor.project?.walls ?? [] as wall (wall.id)}
					<button
						class:active={wall.id === editor.activeWallId}
						onclick={() => {
							editor.setActiveWall(wall.id);
							lookAtWall(wall.id);
						}}>{wallShortName(wall)}</button
					>
				{/each}
			</div>
		</div>
		<div class="overlay top-right">
			<label class="toggle"
				><input type="checkbox" bind:checked={autoRotate} /> Automatisch drehen</label
			>
		</div>
		<div class="overlay bottom-left">
			<div class="hint card">
				<p>
					<strong>Ziehen</strong> drehen · <strong>Rechtsklick + Ziehen</strong> verschieben ·
					<strong>Mausrad</strong> zoomen · <strong>Klick</strong> wählt ein Modul
				</p>
				<p class="note">
					Vereinfachtes Modell: Das Dach ist nicht Teil der Projektdaten und nur angedeutet.
				</p>
			</div>
		</div>
	{/if}
</div>

<style>
	.view3d {
		position: relative;
		height: 100%;
		min-height: 320px;
		background: #eef1f2;
	}
	.host {
		position: absolute;
		inset: 0;
	}
	.host :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
		touch-action: none;
	}
	.overlay {
		position: absolute;
		display: flex;
		gap: 8px;
	}
	.top-left {
		top: 12px;
		left: 12px;
		right: 200px;
	}
	.top-right {
		top: 12px;
		right: 12px;
	}
	.bottom-left {
		bottom: 12px;
		left: 12px;
	}
	.views {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		padding: 3px;
		background: rgba(255, 255, 255, 0.94);
		border: 1px solid var(--line);
		border-radius: var(--radius-m);
		box-shadow: var(--shadow-s);
	}
	.views button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: 0;
		background: transparent;
		padding: 6px 10px;
		border-radius: 7px;
		font-size: 13px;
		color: var(--ink-soft);
	}
	.views button:hover {
		background: var(--paper-deep);
	}
	.views button.active {
		background: var(--ink);
		color: #fff;
	}
	.toggle {
		display: inline-flex;
		gap: 6px;
		align-items: center;
		padding: 7px 12px;
		font-size: 13px;
		background: rgba(255, 255, 255, 0.94);
		border: 1px solid var(--line);
		border-radius: var(--radius-m);
	}
	.toggle input {
		accent-color: var(--brand);
	}
	.hint {
		padding: 7px 12px;
		font-size: 12px;
		color: var(--muted);
	}
	.hint p {
		margin: 0;
	}
	.note {
		font-size: 11px;
		color: var(--faint);
	}
	.fallback {
		position: absolute;
		inset: auto 24px 24px;
		display: flex;
		gap: 8px;
		padding: 14px;
		color: var(--warning);
	}
	@media (max-width: 1100px) {
		.bottom-left {
			display: none;
		}
	}
</style>
