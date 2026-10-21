import { beijingTimestamp, documentTime } from '../document-dates.ts';

export function formatDocumentTime(value: string | null | undefined) {
  if (!value) return null;
  const time = documentTime(value);
  if (!Number.isFinite(time)) return null;
  // Old day-only metadata has no known clock time to display.
  if (value.length === 10) return value;
  return beijingTimestamp(time).slice(0, 19);
}
