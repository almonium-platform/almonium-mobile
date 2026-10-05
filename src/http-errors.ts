import { t } from './i18n';

export function errorMessageFromBody(body: unknown, status: number) {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message) return record.message;
    const validationMessages = Object.values(record).filter(
      (value): value is string => typeof value === 'string',
    );
    if (validationMessages.length) return validationMessages.join('\n');
  }
  if (status === 401) return t('Your session expired. Sign in again.');
  return t('Request failed ({status})', { status });
}

export function decodeJsonBody<T>(text: string): T {
  return (text ? JSON.parse(text) : undefined) as T;
}

/** The HTTP status a failed request carried, or null when it never reached the server. */
export function httpStatus(error: unknown): number | null {
  if (error && typeof error === 'object' && typeof (error as { status?: unknown }).status === 'number') {
    const status = (error as { status: number }).status;
    return status > 0 ? status : null;
  }
  return null;
}

/**
 * 451 Unavailable For Legal Reasons: the book is still under copyright in the reader's country.
 * It is a plain state of the screen, never an error notice.
 */
export function isUnavailableInCountry(error: unknown): boolean {
  return httpStatus(error) === 451;
}
