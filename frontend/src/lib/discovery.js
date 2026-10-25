const valid = (slug) =>
  typeof slug === 'string' && /^[a-z0-9-]{1,160}$/.test(slug)
export function parseSaved(raw, limit = 100) {
  try {
    if (!raw || raw.length > 20000) return []
    const value = JSON.parse(raw)
    return Array.isArray(value)
      ? [...new Set(value.filter(valid))].slice(0, limit)
      : []
  } catch {
    return []
  }
}
export function toggleSlug(items, slug, limit = 100) {
  if (!valid(slug)) return { items, full: false }
  if (items.includes(slug))
    return { items: items.filter((item) => item !== slug), full: false }
  return items.length >= limit
    ? { items, full: true }
    : { items: [...items, slug], full: false }
}
