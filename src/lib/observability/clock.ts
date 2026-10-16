/** Current time as ISO string; a single seam that tests or a server clock can replace later. */
export function nowIso(): string {
	return new Date().toISOString();
}
