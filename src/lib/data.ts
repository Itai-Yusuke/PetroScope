import {
  countriesMasterSchema,
  displayOverridesSchema,
  oilConsumptionSchema,
  oilOriginMixSchema,
  sourcesSchema,
} from './schemas';
import type { LoadedData } from '../types';

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`${path} の取得に失敗しました: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function loadAppData(year: number): Promise<LoadedData> {
  const [masterRaw, consumptionRaw, originMixRaw, sourcesRaw, displayOverridesRaw, topology] =
    await Promise.all([
      fetchJson<unknown>('./data/countries.master.json'),
      fetchJson<unknown>(`./data/oil-consumption-${year}.json`),
      fetchJson<unknown>(`./data/oil-origin-mix-${year}.json`),
      fetchJson<unknown>('./data/sources.json'),
      fetchJson<unknown>('./data/display-overrides.json'),
      fetchJson<Record<string, unknown>>('./map/world-countries.topo.json'),
    ]);

  return {
    master: countriesMasterSchema.parse(masterRaw),
    consumption: oilConsumptionSchema.parse(consumptionRaw),
    originMix: oilOriginMixSchema.parse(originMixRaw),
    sources: sourcesSchema.parse(sourcesRaw),
    displayOverrides: displayOverridesSchema.parse(displayOverridesRaw),
    topology,
  };
}
