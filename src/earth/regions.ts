export interface MapRegion {
  id: 'world' | 'europe';
  label: string;
  west: number;
  east: number;
  south: number;
  north: number;
  /** Periodic climate noise (dateline). Only the globe. */
  wrapX: boolean;
  /** Globe stays equirectangular; Europe is Lambert azimuthal equal-area. */
  projection: 'lonlat' | 'laea';
}

export const EUROPE: MapRegion = {
  id: 'europe',
  label: 'Europe',
  west: -24.5,
  east: 40,
  south: 34.5,
  north: 71.5,
  wrapX: false,
  projection: 'laea',
};

export const WORLD: MapRegion = {
  id: 'world',
  label: 'World',
  west: -180,
  east: 180,
  south: -90,
  north: 90,
  wrapX: true,
  projection: 'lonlat',
};

export const REGIONS: MapRegion[] = [EUROPE, WORLD];

export const DEFAULT_REGION: MapRegion['id'] = 'europe';

export function regionById(id: string): MapRegion {
  return REGIONS.find((r) => r.id === id) ?? EUROPE;
}

export function lonSpan(region: MapRegion): number {
  return region.east - region.west;
}

export function latSpan(region: MapRegion): number {
  return region.north - region.south;
}

export function regionContains(region: MapRegion, lon: number, lat: number): boolean {
  return lon >= region.west && lon <= region.east && lat >= region.south && lat <= region.north;
}
