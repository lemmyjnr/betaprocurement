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
