import type { HandleClientError } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { errorToData, logger, setLogLevel } from '$lib/observability/logger';

if (dev) setLogLevel('debug');

export const handleError: HandleClientError = ({ error, status, message }) => {
	const errorId = Math.random().toString(36).slice(2, 10);
	logger.error('app.unhandled_error', { errorId, status, ...errorToData(error) });
	return {
		message:
			status === 404
				? 'Seite nicht gefunden'
				: `Ein unerwarteter Fehler ist aufgetreten. (${message})`,
		errorId
	};
};

if (typeof window !== 'undefined') {
	window.addEventListener('unhandledrejection', (event) => {
		logger.error('app.unhandled_rejection', errorToData(event.reason));
	});
}
