import { z } from 'zod';

const iso3Schema = z.string().regex(/^[A-Z]{3}$/);
const lonLatSchema = z.object({
  lon: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});
const labelOffsetSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const dataStatusSchema = z.enum(['complete', 'partial', 'missing']);

export const countriesMasterSchema = z.object({
  version: z.string(),
  countries: z.array(
    z.object({
      iso3: iso3Schema,
      nameJa: z.string(),
      nameEn: z.string(),
      geometryId: z.string(),
      centroid: lonLatSchema,
      displayPoint: lonLatSchema,
      region: z.string().optional(),
      subregion: z.string().optional(),
    }),
  ),
});

export const oilConsumptionCountrySchema = z.object({
  value: z.number().nonnegative().optional(),
  sourceRefIds: z.array(z.string()).default([]),
  status: dataStatusSchema,
  missingReason: z.string().optional(),
});

export const oilConsumptionSchema = z.object({
  year: z.number().int(),
  unit: z.string(),
  metricName: z.string(),
  countries: z.record(iso3Schema, oilConsumptionCountrySchema),
});

export const importPartnerSchema = z.object({
  sourceIso3: iso3Schema,
  sourceNameJa: z.string().optional(),
  sourceNameEn: z.string().optional(),
  sharePct: z.number().min(0).max(100),
  volume: z.number().nonnegative().optional(),
  volumeUnit: z.string().optional(),
  sourceRefIds: z.array(z.string()).default([]),
  note: z.string().optional(),
});

export const oilOriginMixCountrySchema = z.object({
  domesticSharePct: z.number().min(0).max(100).optional(),
  importSharePct: z.number().min(0).max(100).optional(),
  estimatedTotalSupplyVolume: z.number().nonnegative().optional(),
  estimatedTotalSupplyUnit: z.string().optional(),
  importPartners: z.array(importPartnerSchema).default([]),
  notes: z.string().optional(),
  status: dataStatusSchema,
  sourceRefIds: z.array(z.string()).default([]),
  missingReason: z.string().optional(),
});

export const oilOriginMixSchema = z.object({
  year: z.number().int(),
  metricName: z.string(),
  countries: z.record(iso3Schema, oilOriginMixCountrySchema),
});

export const sourceItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  publisher: z.string(),
  year: z.number().int(),
  type: z.string(),
  url: z.string().url(),
});

export const sourcesSchema = z.object({
  sources: z.array(sourceItemSchema),
});

export const displayOverridesSchema = z.object({
  version: z.string(),
  countries: z.record(
    iso3Schema,
    z.object({
      nameJa: z.string().optional(),
      nameEn: z.string().optional(),
      displayPoint: lonLatSchema.optional(),
      labelOffsetPx: labelOffsetSchema.optional(),
      note: z.string().optional(),
    }),
  ),
});

export type CountriesMaster = z.infer<typeof countriesMasterSchema>;
export type OilConsumptionDataset = z.infer<typeof oilConsumptionSchema>;
export type OilOriginMixDataset = z.infer<typeof oilOriginMixSchema>;
export type SourcesCatalog = z.infer<typeof sourcesSchema>;
export type DisplayOverrides = z.infer<typeof displayOverridesSchema>;
export type DataStatus = z.infer<typeof dataStatusSchema>;
