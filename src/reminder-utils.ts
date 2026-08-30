export function normalizeReminderHour(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23
    ? value
    : 20;
}

export function reminderTimeLabel(hour: number) {
  return new Date(2000, 0, 1, normalizeReminderHour(hour)).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
