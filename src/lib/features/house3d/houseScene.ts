/**
 * Builds and updates the three.js scene of the house. Geometry is built once per project;
 * design or selection changes only swap materials, which keeps interaction smooth.
 */
import * as THREE from 'three';
import { getModuleFinish, type FacadeDesign, type FacadeProject, type Finish } from '$lib/domain';
import { colorHex, surfacePresentation, wallShortName } from '$lib/features/appearance/appearance';
import { computeHouseLayout, type HouseLayout } from './houseLayout';
import { createFinishTexture, createLabelSprite, type TextureSpec } from './textures';

/** Visual module depth (≈ 21 cm system thickness, see README). */
export const MODULE_DEPTH = 210;
const JOINT = 8;

export interface ModuleMeshData {
	wallId: string;
	moduleId: string;
}

export class HouseScene {
	readonly root = new THREE.Group();
	readonly layout: HouseLayout;
	readonly pickables: THREE.Mesh[] = [];
	#project: FacadeProject;
	#textures = new Map<string, TextureSpec>();
	#materials = new Map<string, THREE.MeshStandardMaterial>();
	#disposables: { dispose(): void }[] = [];
	#modulesById = new Map<string, THREE.Mesh>();
	#wallGroups = new Map<string, THREE.Group>();
	#wallOutlines = new Map<string, THREE.LineSegments>();

	constructor(project: FacadeProject) {
		this.#project = project;
		this.layout = computeHouseLayout(project.walls);
		this.#build();
	}

	#track<T extends { dispose(): void }>(item: T): T {
		this.#disposables.push(item);
		return item;
	}

	#textureFor(finish: Finish): TextureSpec {
		const key = `${finish.surfaceId}|${finish.color}`;
		let spec = this.#textures.get(key);
		if (!spec) {
			const surface = this.#project.surfaces.find((s) => s.id === finish.surfaceId);
			const kind = surface ? surfacePresentation(surface).texture : 'plain';
			spec = createFinishTexture(kind, colorHex(finish.color));
			this.#textures.set(key, spec);
		}
		return spec;
	}

	#materialFor(finish: Finish | undefined, selected: boolean): THREE.MeshStandardMaterial {
		const key = `${finish?.surfaceId}|${finish?.color}|${selected ? 'sel' : ''}`;
		let material = this.#materials.get(key);
		if (!material) {
			material = finish
				? new THREE.MeshStandardMaterial({
						map: this.#textureFor(finish).texture,
						roughness: 0.85,
						metalness: 0
					})
				: new THREE.MeshStandardMaterial({ color: '#d9d6ce', roughness: 0.9 });
			if (selected) {
				material.emissive = new THREE.Color('#2457d6');
				material.emissiveIntensity = 0.45;
			}
			this.#materials.set(key, material);
		}
		return material;
	}

	#build() {
		const glass = this.#track(
			new THREE.MeshStandardMaterial({ color: '#5f7f93', roughness: 0.15, metalness: 0.35 })
		);
		const frame = this.#track(new THREE.MeshStandardMaterial({ color: '#f1f0eb', roughness: 0.6 }));
		const door = this.#track(new THREE.MeshStandardMaterial({ color: '#5d4d40', roughness: 0.7 }));
		const masonry = this.#track(new THREE.MeshStandardMaterial({ color: '#cfcac0', roughness: 1 }));

		for (const placement of this.layout.placements) {
			const wall = this.#project.walls.find((w) => w.id === placement.wallId);
			if (!wall) continue;
			const group = new THREE.Group();
			group.position.set(placement.origin.x, 0, placement.origin.z);
			group.rotation.y = placement.rotationY;
			group.name = `wall:${wall.id}`;

			// Existing masonry behind the new facade.
			const baseGeometry = this.#track(new THREE.BoxGeometry(wall.width_mm, wall.height_mm, 300));
			const base = new THREE.Mesh(baseGeometry, masonry);
			base.position.set(wall.width_mm / 2, wall.height_mm / 2, -150);
			base.receiveShadow = true;
			group.add(base);

			for (const module of wall.modules) {
				const geometry = this.#track(
					new THREE.BoxGeometry(
						Math.max(1, module.width_mm - JOINT),
						Math.max(1, module.height_mm - JOINT),
						MODULE_DEPTH
					)
				);
				// UVs in metres of the wall plane, so textures continue seamlessly across modules;
				// each texture scales itself to its real-world size via texture.repeat.
				const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
				for (let i = 0; i < uv.count; i++) {
					uv.setXY(
						i,
						(module.x_mm + uv.getX(i) * module.width_mm) / 1000,
						(module.y_mm + uv.getY(i) * module.height_mm) / 1000
					);
				}
				uv.needsUpdate = true;
				const mesh = new THREE.Mesh(geometry, this.#materialFor(undefined, false));
				mesh.position.set(
					module.x_mm + module.width_mm / 2,
					module.y_mm + module.height_mm / 2,
					MODULE_DEPTH / 2
				);
				mesh.castShadow = true;
				mesh.receiveShadow = true;
				mesh.userData = { wallId: wall.id, moduleId: module.id } satisfies ModuleMeshData;
				group.add(mesh);
				this.pickables.push(mesh);
				this.#modulesById.set(`${wall.id}/${module.id}`, mesh);
			}

			for (const opening of wall.openings) {
				const isDoor = opening.type === 'door';
				const recess = 70;
				const pane = new THREE.Mesh(
					this.#track(new THREE.BoxGeometry(opening.width_mm, opening.height_mm, 40)),
					isDoor ? door : glass
				);
				pane.position.set(
					opening.x_mm + opening.width_mm / 2,
					opening.y_mm + opening.height_mm / 2,
					recess
				);
				group.add(pane);
				// Frame
				const frameShape = new THREE.Shape();
				frameShape.moveTo(0, 0);
				frameShape.lineTo(opening.width_mm, 0);
				frameShape.lineTo(opening.width_mm, opening.height_mm);
				frameShape.lineTo(0, opening.height_mm);
				const hole = new THREE.Path();
				const inset = 70;
				hole.moveTo(inset, isDoor ? 0 : inset);
				hole.lineTo(opening.width_mm - inset, isDoor ? 0 : inset);
				hole.lineTo(opening.width_mm - inset, opening.height_mm - inset);
				hole.lineTo(inset, opening.height_mm - inset);
				frameShape.holes.push(hole);
				const frameMesh = new THREE.Mesh(
					this.#track(new THREE.ExtrudeGeometry(frameShape, { depth: 60, bevelEnabled: false })),
					frame
				);
				frameMesh.position.set(opening.x_mm, opening.y_mm, recess + 10);
				group.add(frameMesh);
			}

			// Outline used to highlight the active wall.
			const outlineGeometry = this.#track(
				new THREE.EdgesGeometry(
					new THREE.BoxGeometry(wall.width_mm + 40, wall.height_mm + 40, MODULE_DEPTH + 40)
				)
			);
			const outline = new THREE.LineSegments(
				outlineGeometry,
				this.#track(
					new THREE.LineBasicMaterial({ color: '#2457d6', transparent: true, opacity: 0.9 })
				)
			);
			outline.position.set(wall.width_mm / 2, wall.height_mm / 2, MODULE_DEPTH / 2);
			outline.visible = false;
			group.add(outline);
			this.#wallOutlines.set(wall.id, outline);

			// Compass label in front of the wall.
			const label = createLabelSprite(wallShortName(wall));
			this.#track(label.material);
			if (label.material.map) this.#track(label.material.map);
			label.position.set(wall.width_mm / 2, 300, 2600);
			group.add(label);

			this.root.add(group);
			this.#wallGroups.set(wall.id, group);
		}

		if (this.layout.mode === 'footprint') {
			const { width, depth, height } = this.layout;
			// House body (keeps windows from looking into the void).
			const body = new THREE.Mesh(
				this.#track(new THREE.BoxGeometry(width - 600, height, depth - 600)),
				this.#track(new THREE.MeshStandardMaterial({ color: '#3a3d3b', roughness: 1 }))
			);
			body.position.y = height / 2;
			this.root.add(body);
			// Simplified flat roof cap – roof data is not part of the project file.
			const roof = new THREE.Mesh(
				this.#track(
					new THREE.BoxGeometry(width + 2 * MODULE_DEPTH + 300, 220, depth + 2 * MODULE_DEPTH + 300)
				),
				this.#track(new THREE.MeshStandardMaterial({ color: '#5b5f5c', roughness: 0.8 }))
			);
			roof.position.y = height + 110;
			roof.castShadow = true;
			this.root.add(roof);
		}
	}

	/** Re-applies materials for the current design and selection (cheap, no geometry rebuild). */
	update(design: FacadeDesign, activeWallId: string | null, selection: ReadonlySet<string>) {
		for (const mesh of this.pickables) {
			const { wallId, moduleId } = mesh.userData as ModuleMeshData;
			const finish = getModuleFinish(design, wallId, moduleId);
			const selected = wallId === activeWallId && selection.has(moduleId);
			mesh.material = this.#materialFor(finish, selected);
		}
		for (const [wallId, outline] of this.#wallOutlines) outline.visible = wallId === activeWallId;
	}

	/** Camera position looking at a wall from outside. */
	viewpointFor(wallId: string): { position: THREE.Vector3; target: THREE.Vector3 } | null {
		const placement = this.layout.placements.find((p) => p.wallId === wallId);
		const wall = this.#project.walls.find((w) => w.id === wallId);
		if (!placement || !wall) return null;
		const center = new THREE.Vector3(wall.width_mm / 2, wall.height_mm / 2, 0).applyAxisAngle(
			new THREE.Vector3(0, 1, 0),
			placement.rotationY
		);
		center.x += placement.origin.x;
		center.z += placement.origin.z;
		const distance = Math.max(wall.width_mm, wall.height_mm) * 1.9;
		const position = center
			.clone()
			.add(
				new THREE.Vector3(
					placement.normal.x * distance,
					wall.height_mm * 0.35,
					placement.normal.z * distance
				)
			);
		return { position, target: center };
	}

	dispose() {
		for (const item of this.#disposables) item.dispose();
		for (const material of this.#materials.values()) material.dispose();
		for (const spec of this.#textures.values()) spec.texture.dispose();
		this.#disposables = [];
		this.#materials.clear();
		this.#textures.clear();
	}
}
