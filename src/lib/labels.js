export const SERVICE_TYPES = ['sea_freight', 'air_freight', 'express']

export const SERVICE_TYPE_LABELS = {
  sea_freight: 'Sea Freight',
  air_freight: 'Air Freight',
  express: 'Express',
}

export const ROUTES = ['china_nigeria', 'dubai_nigeria']

export const ROUTE_LABELS = {
  china_nigeria: 'China - Nigeria',
  dubai_nigeria: 'Dubai - Nigeria',
}

export function formatServiceType(value) {
  return SERVICE_TYPE_LABELS[value] || value
}

export function formatRoute(value) {
  return ROUTE_LABELS[value] || value
}

export function formatLoadingDate(value) {
  if (!value) return null
  // Only reformat clean YYYY-MM-DD values (from the date picker) —
  // leave any older free-text notes exactly as they were typed.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
