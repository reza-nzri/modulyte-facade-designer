/**
 * Money is handled in integer euro cents to keep sums exact. Rates are given in EUR/m² and
 * areas in mm², so cost_cents = area_mm2 × rate_cents_per_m2 / 1 000 000, rounded half up.
 */
import { MM2_PER_M2 } from './geometry';

export type Cents = number;

/** Converts a EUR rate with up to two decimals to integer cents (e.g. 95.5 → 9550). */
export function eurToCents(eur: number): Cents {
	return Math.round(eur * 100);
}

export function centsToEur(cents: Cents): number {
	return cents / 100;
}

/** Integer division rounded half up (away from zero for negative numbers). */
function roundedDivision(numerator: number, denominator: number): number {
	const quotient = numerator / denominator;
	return Math.sign(quotient) * Math.round(Math.abs(quotient));
}

/** Cost in cents for an area in mm² at a rate in EUR/m². */
export function costForArea(areaMm2: number, eurPerM2: number): Cents {
	return roundedDivision(areaMm2 * eurToCents(eurPerM2), MM2_PER_M2);
}

const eurFormatter = new Intl.NumberFormat('de-DE', {
	style: 'currency',
	currency: 'EUR',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

export function formatCents(cents: Cents): string {
	return eurFormatter.format(centsToEur(cents));
}

/** Signed difference, e.g. "+94,38 €" / "−12,00 €"; zero becomes "±0,00 €". */
export function formatCentsDelta(cents: Cents): string {
	if (cents === 0) return `±${eurFormatter.format(0)}`;
	const formatted = eurFormatter.format(Math.abs(centsToEur(cents)));
	return cents > 0 ? `+${formatted}` : `−${formatted}`;
}
