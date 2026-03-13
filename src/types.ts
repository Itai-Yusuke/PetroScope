import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type {
  CountriesMaster,
  DisplayOverrides,
  OilConsumptionDataset,
  OilOriginMixDataset,
  SourcesCatalog,
} from './lib/schemas';

export type CountryFeature = Feature<Polygon | MultiPolygon, { ct?: [number, number] }>;

export type ToggleState = {
  showCircles: boolean;
  showArrows: boolean;
  showLabels: boolean;
};

export type TooltipState = {
  x: number;
  y: number;
  title: string;
  subtitle?: string;
  lines: string[];
};

export type LoadedData = {
  master: CountriesMaster;
  consumption: OilConsumptionDataset;
  originMix: OilOriginMixDataset;
  sources: SourcesCatalog;
  displayOverrides: DisplayOverrides;
  topology: Record<string, unknown>;
};

export type CountryCatalogEntry = {
  iso3: string;
  nameJa: string;
  nameEn: string;
  geometryId: string;
  region?: string;
  subregion?: string;
  centroid: { lon: number; lat: number };
  displayPoint: { lon: number; lat: number };
  labelOffsetPx?: { x: number; y: number };
  note?: string;
};
