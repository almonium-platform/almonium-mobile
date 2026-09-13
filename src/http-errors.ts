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
