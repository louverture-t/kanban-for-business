/**
 * Normalize any Date-ish value to an ISO-8601 string (or null).
 *
 * Background: Mongoose models store dates as native `Date`, but the GraphQL
 * schema declares them as `String`. Apollo's default `String` scalar coerces
 * a `Date` object via `valueOf()` → epoch-ms number → string (e.g.
 * "1775606400000"), which is undocumented and fragile on the client.
 *
 * Use this helper in field resolvers for every date field so the client
 * always receives a predictable ISO-8601 string:
 *
 *   Task: {
 *     dueDate: (task) => toISO(task.dueDate),
 *     createdAt: (task) => toISO(task.createdAt),
 *   }
 */
export function toISO(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString();
  }
  const d = new Date(value as string | number);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Like toISO but returns a non-null fallback for use in non-nullable
 * GraphQL fields (`String!`). If the stored value is missing/invalid,
 * the provided `fallback` callback is called to supply a default Date
 * (e.g. derived from the document's ObjectId timestamp).
 */
export function toISORequired(value: unknown, fallback: () => Date): string {
  if (value == null) return fallback().toISOString();
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? fallback().toISOString() : value.toISOString();
  }
  const d = new Date(value as string | number);
  return isNaN(d.getTime()) ? fallback().toISOString() : d.toISOString();
}
