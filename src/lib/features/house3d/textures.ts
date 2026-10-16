/**
 * Procedural canvas textures for the 3D view, matching the 2D SVG patterns. Each texture
 * represents a known real-world size so UVs can be scaled per module (see houseScene.ts).
 */
import * as THREE from 'three';
import { shade, type TextureKind } from '$lib/features/appearance/appearance';

export interface TextureSpec {
	texture: THREE.CanvasTexture;
	/** Real-world size covered by one texture repeat (mm). */
	worldWidth: number;
	worldHeight: number;
}

const PX_PER_MM = 0.5;

function makeCanvas(worldWidth: number, worldHeight: number) {
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(worldWidth * PX_PER_MM);
	canvas.height = Math.round(worldHeight * PX_PER_MM);
	const context = canvas.getContext('2d');
	if (!context) throw new Error('2D canvas context not available');
	context.scale(PX_PER_MM, PX_PER_MM);
	return { canvas, context };
}

function drawBrick(context: CanvasRenderingContext2D, base: string, width: number, height: number) {
	const brickW = 240;
	const brickH = 71;
	const joint = 10;
	context.fillStyle = shade(base, 0.45);
	context.fillRect(0, 0, width, height);
	const rows = Math.round(height / (brickH + joint));
	for (let row = 0; row < rows; row++) {
		const offset = row % 2 === 0 ? 0 : (brickW + joint) / 2;
		for (let x = -brickW; x < width + brickW; x += brickW + joint) {
			const variation = (((row * 7 + Math.round(x / 10)) % 5) - 2) * 0.03;
			context.fillStyle = shade(base, variation);
			context.fillRect(x + offset, row * (brickH + joint) + joint / 2, brickW, brickH);
		}
	}
}

function drawBattens(
	context: CanvasRenderingContext2D,
	base: string,
	width: number,
	height: number
) {
	context.fillStyle = shade(base, -0.55);
	context.fillRect(0, 0, width, height);
	for (let x = 0; x < width; x += 80) {
		context.fillStyle = base;
		context.fillRect(x + 7, 0, 66, height);
		context.fillStyle = shade(base, 0.18);
		context.fillRect(x + 7, 0, 10, height);
		context.fillStyle = shade(base, -0.18);
		context.fillRect(x + 61, 0, 12, height);
	}
}

function drawPanel(context: CanvasRenderingContext2D, base: string, width: number, height: number) {
	context.fillStyle = base;
	context.fillRect(0, 0, width, height);
	context.fillStyle = shade(base, 0.04);
	context.fillRect(0, 0, width, height / 2);
	context.fillStyle = shade(base, -0.3);
	context.fillRect(width - 5, 0, 5, height);
	context.fillRect(0, height - 5, width, 5);
}

const SIZES: Record<TextureKind, [number, number]> = {
	brick: [1000, 972], // 4 bricks wide, 12 courses high
	battens: [1040, 1000], // 13 battens
	panel: [1250, 1250],
	plain: [500, 500]
};

export function createFinishTexture(kind: TextureKind, base: string): TextureSpec {
	const [worldWidth, worldHeight] = SIZES[kind];
	const { canvas, context } = makeCanvas(worldWidth, worldHeight);
	if (kind === 'brick') drawBrick(context, base, worldWidth, worldHeight);
	else if (kind === 'battens') drawBattens(context, base, worldWidth, worldHeight);
	else if (kind === 'panel') drawPanel(context, base, worldWidth, worldHeight);
	else {
		context.fillStyle = base;
		context.fillRect(0, 0, worldWidth, worldHeight);
	}
	const texture = new THREE.CanvasTexture(canvas);
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.anisotropy = 4;
	// Geometry UVs are in metres; one repeat covers worldWidth × worldHeight millimetres.
	texture.repeat.set(1000 / worldWidth, 1000 / worldHeight);
	return { texture, worldWidth, worldHeight };
}

/** Text label rendered to a sprite (compass directions). */
export function createLabelSprite(text: string): THREE.Sprite {
	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = 128;
	const context = canvas.getContext('2d');
	if (context) {
		context.fillStyle = 'rgba(255,255,255,0.92)';
		context.beginPath();
		context.roundRect(8, 24, 496, 80, 40);
		context.fill();
		context.fillStyle = '#1c1f1d';
		context.font = '600 44px "IBM Plex Sans", system-ui, sans-serif';
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.fillText(text, 256, 66);
	}
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
	sprite.scale.set(2400, 600, 1);
	return sprite;
}
