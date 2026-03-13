import { geoCentroid } from 'd3';
import type { GeoPermissibleObjects } from 'd3';
import type { FeatureCollection } from 'geojson';
import { feature } from 'topojson-client';
import { getCountryNames } from './countryNames';
import type { CountriesMaster, DisplayOverrides } from './schemas';
import type { CountryCatalogEntry, CountryFeature } from '../types';

type GenericTopology = {
  objects?: Record<string, unknown>;
};

export function extractCountryFeatures(topology: Record<string, unknown>): CountryFeature[] {
  const typedTopology = topology as GenericTopology;
  const countriesObject =
    typedTopology.objects?.countries ??
    Object.values(typedTopology.objects ?? {}).find((candidate) => {
      return typeof candidate === 'object' && candidate !== null;
    });

  if (!countriesObject) {
    throw new Error('TopoJSON 内に countries オブジェクトが見つかりません。');
  }

  const collection = feature(
    topology as unknown as Parameters<typeof feature>[0],
    countriesObject as Parameters<typeof feature>[1],
  ) as FeatureCollection;

  return collection.features.filter((candidate): candidate is CountryFeature => Boolean(candidate.id));
}

export function buildCountryCatalog(
  features: CountryFeature[],
  master: CountriesMaster,
  displayOverrides: DisplayOverrides,
): Record<string, CountryCatalogEntry> {
  const catalog: Record<string, CountryCatalogEntry> = {};

  for (const feature of features) {
    const iso3 = String(feature.id);
    const centroid = feature.properties?.ct
      ? { lon: feature.properties.ct[0], lat: feature.properties.ct[1] }
      : toLonLat(geoCentroid(feature as GeoPermissibleObjects));
    const localizedNames = getCountryNames(iso3);

    catalog[iso3] = {
      iso3,
      nameJa: localizedNames.nameJa,
      nameEn: localizedNames.nameEn,
      geometryId: iso3,
      centroid,
      displayPoint: centroid,
    };
  }

  for (const country of master.countries) {
    catalog[country.iso3] = {
      ...catalog[country.iso3],
      iso3: country.iso3,
      nameJa: country.nameJa,
      nameEn: country.nameEn,
      geometryId: country.geometryId,
      region: country.region,
      subregion: country.subregion,
      centroid: country.centroid,
      displayPoint: country.displayPoint,
    };
  }

  for (const [iso3, override] of Object.entries(displayOverrides.countries)) {
    const baseNames = getCountryNames(iso3);
    const existing = catalog[iso3] ?? {
      iso3,
      geometryId: iso3,
      centroid: { lon: 0, lat: 0 },
      displayPoint: { lon: 0, lat: 0 },
      nameJa: baseNames.nameJa,
      nameEn: baseNames.nameEn,
    };

    catalog[iso3] = {
      ...existing,
      nameJa: override.nameJa ?? existing.nameJa,
      nameEn: override.nameEn ?? existing.nameEn,
      displayPoint: override.displayPoint ?? existing.displayPoint,
      labelOffsetPx: override.labelOffsetPx ?? existing.labelOffsetPx,
      note: override.note ?? existing.note,
    };
  }

  return catalog;
}

export function buildCurvePath(source: [number, number], target: [number, number]) {
  const [sx, sy] = source;
  const [tx, ty] = target;
  const dx = tx - sx;
  const dy = ty - sy;
  const distance = Math.hypot(dx, dy) || 1;
  const bend = Math.min(90, distance * 0.25);
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const controlX = (sx + tx) / 2 + normalX * bend;
  const controlY = (sy + ty) / 2 + normalY * bend;

  return `M ${sx} ${sy} Q ${controlX} ${controlY} ${tx} ${ty}`;
}

function toLonLat([lon, lat]: [number, number]) {
  return { lon, lat };
}
