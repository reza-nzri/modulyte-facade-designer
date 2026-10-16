/**
 * Presentation mapping: how surfaces and colours from the project data are shown to customers.
 *
 * The project file only contains ids/names (e.g. "rockpanel", "grey glaze"). Display colours,
 * textures and German labels are UI assumptions documented in README.md. Unknown ids always
 * get a deterministic fallback, so new materials in the data work without code changes.
 */
import type { Surface } from '$lib/domain';

export type TextureKind = 'brick' | 'panel' | 'battens' | 'plain';

interface SurfacePresentation {
	label: string;
	description: string;
	texture: TextureKind;
}

const SURFACES: Record<string, SurfacePresentation> = {
	clinker: {
		label: 'Klinkerriemchen',
		description: 'Klassische Ziegeloptik aus dünnen Klinkerplatten',
		texture: 'brick'
	},
	rockpanel: {
		label: 'Rockpanel-Platten',
		description: 'Glatte, großformatige Fassadenplatten',
		texture: 'panel'
	},
	rhombus: {
		label: 'Rhombusleisten (Holz)',
		description: 'Senkrechte Holzleisten mit schmalen Schattenfugen',
		texture: 'battens'
	}
};

const COLORS: Record<string, { label: string; hex: string }> = {
	red: { label: 'Rot', hex: '#9b4a36' },
	anthracite: { label: 'Anthrazit', hex: '#3d4045' },
	sand: { label: 'Sand', hex: '#d4bf98' },
	white: { label: 'Weiß', hex: '#eeede8' },
	grey: { label: 'Grau', hex: '#9a9ea0' },
	black: { label: 'Schwarz', hex: '#26282c' },
	natural: { label: 'Natur', hex: '#c39a6b' },
	'grey glaze': { label: 'Grau lasiert', hex: '#8f8c84' }
};

/** Guess a texture from free-text names for surfaces not listed above. */
function guessTexture(surface: Pick<Surface, 'id' | 'name'>): TextureKind {
	const text = `${surface.id} ${surface.name}`.toLowerCase();
	if (/(clinker|klinker|brick|ziegel|riemchen)/.test(text)) return 'brick';
	if (/(batten|leiste|holz|wood|timber|rhomb|lärche|larch)/.test(text)) return 'battens';
	if (/(panel|platte|hpl|fiber|faser|ceramic|keramik)/.test(text)) return 'panel';
	return 'plain';
}

export function surfacePresentation(surface: Pick<Surface, 'id' | 'name'>): SurfacePresentation {
	return (
		SURFACES[surface.id] ?? {
			label: surface.name,
			description: 'Oberfläche laut Projektdaten',
			texture: guessTexture(surface)
		}
	);
}

function hashHue(text: string): number {
	let hash = 0;
	for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
	return hash % 360;
}

function hslToHex(h: number, s: number, l: number): string {
	const a = s * Math.min(l, 1 - l);
	const channel = (n: number) => {
		const k = (n + h / 30) % 12;
		const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
		return Math.round(value * 255)
			.toString(16)
			.padStart(2, '0');
	};
	return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** Display colour for a colour name. CSS colour names and hex values are used directly. */
export function colorHex(color: string): string {
	const known = COLORS[color.toLowerCase()];
	if (known) return known.hex;
	if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) return color;
	return hslToHex(hashHue(color), 0.25, 0.55);
}

export function colorLabel(color: string): string {
	const known = COLORS[color.toLowerCase()];
	if (known) return known.label;
	return color.charAt(0).toUpperCase() + color.slice(1);
}

/** Relative luminance (0 dark … 1 light), used to pick readable text and joint colours. */
export function luminance(hex: string): number {
	const value = hex.replace('#', '');
	const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value;
	const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [
		number,
		number,
		number
	];
	const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
	return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Lightens (amount > 0) or darkens (amount < 0) a hex colour. */
export function shade(hex: string, amount: number): string {
	const value = hex.replace('#', '');
	const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value;
	const channels = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
	const adjusted = channels.map((c) =>
		Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))
	);
	return `#${adjusted.map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('')}`;
}

/** Stable DOM id for the SVG pattern of a finish. */
export function patternId(surfaceId: string, color: string): string {
	const safe = `${surfaceId}--${color}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
	return `finish-${safe}`;
}

/** Human readable "Klinkerriemchen · Anthrazit". */
export function finishLabel(surface: Pick<Surface, 'id' | 'name'>, color: string): string {
	return `${surfacePresentation(surface).label} · ${colorLabel(color)}`;
}

/** German labels for wall ids/labels from the data, e.g. "South (garden side)" → "Süden (Gartenseite)". */
const WALL_WORDS: [RegExp, string][] = [
	[/\bsouth\b/i, 'Süden'],
	[/\bnorth\b/i, 'Norden'],
	[/\beast\b/i, 'Osten'],
	[/\bwest\b/i, 'Westen'],
	[/\bgarden side\b/i, 'Gartenseite'],
	[/\bstreet side with entrance\b/i, 'Straßenseite mit Eingang'],
	[/\bstreet side\b/i, 'Straßenseite'],
	[/\bentrance\b/i, 'Eingang']
];

export function wallDisplayName(wall: { id: string; label?: string | undefined }): string {
	let text = wall.label ?? wall.id;
	for (const [pattern, replacement] of WALL_WORDS) text = text.replace(pattern, replacement);
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Short heading, e.g. "Süd-Fassade" for id "south". */
export function wallShortName(wall: { id: string; label?: string | undefined }): string {
	const map: Record<string, string> = {
		south: 'Südfassade',
		north: 'Nordfassade',
		east: 'Ostfassade',
		west: 'Westfassade'
	};
	return map[wall.id.toLowerCase()] ?? wallDisplayName(wall);
}

export function openingLabel(type: 'window' | 'door'): string {
	return type === 'window' ? 'Fenster' : 'Tür';
}

export function moduleTypeLabel(type: 'standard' | 'special'): string {
	return type === 'standard' ? 'Standardmodul' : 'Passstück (Sondermodul)';
}
