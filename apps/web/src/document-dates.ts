// Unqualified document dates and times use Beijing time, independent of the host.
// Explicit offsets remain readable for existing records.
export function documentTime(value: unknown) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value)
  )
    return NaN;
  const day = value.slice(0, 10);
  const dayTime = Date.parse(day);
  if (!Number.isFinite(dayTime) || new Date(dayTime).toISOString().slice(0, 10) !== day) return NaN;
  if (value.length === 10) return Date.parse(`${value}T00:00:00+08:00`);
  const normalized = value.replace(' ', 'T');
  return Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(normalized) ? normalized : `${normalized}+08:00`);
}

// Retain milliseconds so rapid events within one second stay ordered.
export function beijingTimestamp(now = Date.now()) {
  return new Date(now + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace('Z', '');
}

export const stateChangeTimestamp = beijingTimestamp;
