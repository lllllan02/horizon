/** Initial preferences; user changes live in the application database. */
export const defaultReviewPriorities: Record<string, number> = {
  interviews: 3,
  notes: 2,
  readings: 1,
  glossary: 1,
};

export function parseReviewPriorities(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('复习目录优先级必须是目录与数值的映射。');
  const result: Record<string, number> = {};
  for (const [collection, priority] of Object.entries(value)) {
    if (
      !/^[a-z][a-z0-9-]*$/.test(collection) ||
      typeof priority !== 'number' ||
      !Number.isSafeInteger(priority) ||
      priority < 0
    )
      throw Error('复习目录优先级必须使用有效目录名与非负安全整数。');
    Object.defineProperty(result, collection, { value: priority, enumerable: true });
  }
  return result;
}
