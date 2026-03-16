import { promises as fs } from 'node:fs';
import path from 'node:path';
import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';
import ja from 'i18n-iso-countries/langs/ja.json';
import { feature } from 'topojson-client';

countries.registerLocale(en);
countries.registerLocale(ja);

const root = process.cwd();
const importFile = path.join(root, 'data', 'import', 'deepresearch-2024.tsv');
const dataDir = path.join(root, 'public', 'data');
const topologyFile = path.join(root, 'public', 'map', 'world-countries.topo.json');

const MANUAL_POINTS: Record<string, { lon: number; lat: number }> = {
  HKG: { lon: 114.17, lat: 22.32 },
  SGP: { lon: 103.82, lat: 1.35 },
};

type RawRow = Record<string, string>;
type ParsedSections = Record<'SOURCES' | 'CONSUMPTION' | 'ORIGIN_MIX' | 'IMPORT_PARTNERS', RawRow[]>;

type ExistingCountry = {
  iso3: string;
  nameJa: string;
  nameEn: string;
  geometryId: string;
  centroid: { lon: number; lat: number };
  displayPoint: { lon: number; lat: number };
  region?: string;
  subregion?: string;
};

type TopologyFeature = {
  id?: string | number;
  properties?: {
    ct?: [number, number];
  };
};

async function main() {
  const raw = await fs.readFile(importFile, 'utf8');
  const sections = parseSections(raw);
  const existingMaster = JSON.parse(
    await fs.readFile(path.join(dataDir, 'countries.master.json'), 'utf8'),
  ) as { version: string; countries: ExistingCountry[] };
  const topology = JSON.parse(await fs.readFile(topologyFile, 'utf8')) as {
    objects?: Record<string, unknown>;
  };

  const sources = {
    sources: sections.SOURCES.map((row) => ({
      id: row.id,
      title: row.title,
      publisher: row.publisher,
      year: parseRequiredNumber(row.year, `SOURCES:${row.id}:year`),
      type: row.type,
      url: row.url,
    })),
  };

  const consumptionRows = sections.CONSUMPTION;
  const consumptionYear = extractYear(consumptionRows.map((row) => row.year), 'CONSUMPTION');
  const consumptionUnit = consumptionRows.find((row) => row.consumption_unit)?.consumption_unit ?? '';
  const consumption = {
    year: consumptionYear,
    unit: consumptionUnit,
    metricName: 'oil_consumption',
    countries: Object.fromEntries(
      consumptionRows.map((row) => [
        row.iso3,
        compact({
          value: parseOptionalNumber(row.consumption_value),
          sourceRefIds: splitRefIds(row.source_ref_ids),
          status: row.status,
          missingReason: takeText(row.missing_reason),
        }),
      ]),
    ),
  };

  const partnerRows = sections.IMPORT_PARTNERS;
  const partnersByTarget = new Map<string, Array<Record<string, unknown>>>();
  for (const row of partnerRows) {
    const sharePct = parseOptionalNumber(row.share_pct);
    if (sharePct == null) {
      continue;
    }

    const targetPartners = partnersByTarget.get(row.target_iso3) ?? [];
    targetPartners.push(
      compact({
        sourceIso3: row.source_iso3,
        sourceNameJa: takeText(row.source_name_ja),
        sourceNameEn: takeText(row.source_name_en),
        sharePct,
        volume: parseOptionalNumber(row.volume),
        volumeUnit: takeText(row.volume_unit),
        note: takeText(row.note),
        sourceRefIds: splitRefIds(row.source_ref_ids),
      }),
    );
    partnersByTarget.set(row.target_iso3, targetPartners);
  }

  for (const partners of partnersByTarget.values()) {
    partners.sort((left, right) => Number(right.sharePct) - Number(left.sharePct));
  }

  const originRows = sections.ORIGIN_MIX;
  const originYear = extractYear(originRows.map((row) => row.year), 'ORIGIN_MIX');
  const originMix = {
    year: originYear,
    metricName: 'crude_supply_mix',
    countries: Object.fromEntries(
      originRows.map((row) => [
        row.target_iso3,
        compact({
          domesticSharePct: parseOptionalNumber(row.domestic_share_pct),
          importSharePct: parseOptionalNumber(row.import_share_pct),
          estimatedTotalSupplyVolume: parseOptionalNumber(row.estimated_total_supply_volume),
          estimatedTotalSupplyUnit: takeText(row.estimated_total_supply_unit),
          importPartners: partnersByTarget.get(row.target_iso3) ?? [],
          notes: takeText(row.notes),
          status: row.status,
          missingReason: takeText(row.missing_reason),
          sourceRefIds: splitRefIds(row.source_ref_ids),
        }),
      ]),
    ),
  };

  const requiredIso3s = new Set<string>();
  for (const row of consumptionRows) {
    requiredIso3s.add(row.iso3);
  }
  for (const row of originRows) {
    requiredIso3s.add(row.target_iso3);
  }
  for (const row of partnerRows) {
    requiredIso3s.add(row.target_iso3);
    requiredIso3s.add(row.source_iso3);
  }

  const master = {
    version: existingMaster.version,
    countries: buildCountryMaster({
      iso3s: [...requiredIso3s].sort(),
      existingCountries: existingMaster.countries,
      topology,
      consumptionRows,
      originRows,
      partnerRows,
    }),
  };

  await fs.mkdir(path.join(root, 'data', 'import'), { recursive: true });
  await fs.writeFile(path.join(dataDir, 'sources.json'), `${JSON.stringify(sources, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    path.join(dataDir, `oil-consumption-${consumptionYear}.json`),
    `${JSON.stringify(consumption, null, 2)}\n`,
    'utf8',
  );
  await fs.writeFile(
    path.join(dataDir, `oil-origin-mix-${originYear}.json`),
    `${JSON.stringify(originMix, null, 2)}\n`,
    'utf8',
  );
  await fs.writeFile(path.join(dataDir, 'countries.master.json'), `${JSON.stringify(master, null, 2)}\n`, 'utf8');

  console.log(
    `Imported ${sources.sources.length} sources, ${Object.keys(consumption.countries).length} consumption rows, ${Object.keys(originMix.countries).length} mix rows.`,
  );
}

function buildCountryMaster({
  iso3s,
  existingCountries,
  topology,
  consumptionRows,
  originRows,
  partnerRows,
}: {
  iso3s: string[];
  existingCountries: ExistingCountry[];
  topology: { objects?: Record<string, unknown> };
  consumptionRows: RawRow[];
  originRows: RawRow[];
  partnerRows: RawRow[];
}) {
  const existingByIso3 = new Map(existingCountries.map((country) => [country.iso3, country]));
  const namesByIso3 = new Map<string, { nameJa?: string; nameEn?: string }>();

  for (const row of consumptionRows) {
    namesByIso3.set(row.iso3, {
      nameJa: takeText(row.name_ja),
      nameEn: takeText(row.name_en),
    });
  }

  for (const row of originRows) {
    namesByIso3.set(row.target_iso3, {
      nameJa: takeText(row.name_ja) ?? namesByIso3.get(row.target_iso3)?.nameJa,
      nameEn: takeText(row.name_en) ?? namesByIso3.get(row.target_iso3)?.nameEn,
    });
  }

  for (const row of partnerRows) {
    namesByIso3.set(row.source_iso3, {
      nameJa: takeText(row.source_name_ja) ?? namesByIso3.get(row.source_iso3)?.nameJa,
      nameEn: takeText(row.source_name_en) ?? namesByIso3.get(row.source_iso3)?.nameEn,
    });
  }

  const topoPoints = extractTopologyPoints(topology);

  return iso3s.map((iso3) => {
    const existing = existingByIso3.get(iso3);
    const names = namesByIso3.get(iso3);
    const centroid = existing?.centroid ?? topoPoints.get(iso3) ?? MANUAL_POINTS[iso3];
    if (!centroid) {
      throw new Error(`No centroid available for ${iso3}`);
    }

    return compact({
      iso3,
      nameJa: names?.nameJa ?? existing?.nameJa ?? countries.getName(iso3, 'ja') ?? iso3,
      nameEn: names?.nameEn ?? existing?.nameEn ?? countries.getName(iso3, 'en') ?? iso3,
      geometryId: existing?.geometryId ?? iso3,
      centroid,
      displayPoint: existing?.displayPoint ?? MANUAL_POINTS[iso3] ?? centroid,
      region: existing?.region,
      subregion: existing?.subregion,
    });
  });
}

function extractTopologyPoints(topology: { objects?: Record<string, unknown> }) {
  const countriesObject =
    topology.objects?.countries ??
    Object.values(topology.objects ?? {}).find((candidate) => {
      return typeof candidate === 'object' && candidate !== null;
    });

  if (!countriesObject) {
    throw new Error('No countries object found in topology');
  }

  const collection = feature(
    topology as Parameters<typeof feature>[0],
    countriesObject as Parameters<typeof feature>[1],
  ) as { features?: TopologyFeature[] };

  const points = new Map<string, { lon: number; lat: number }>();
  for (const entry of collection.features ?? []) {
    const iso3 = typeof entry.id === 'string' || typeof entry.id === 'number' ? String(entry.id) : undefined;
    const centroid = entry.properties?.ct;
    if (!iso3 || !centroid) {
      continue;
    }

    points.set(iso3, { lon: centroid[0], lat: centroid[1] });
  }

  return points;
}

function parseSections(raw: string): ParsedSections {
  const sections: Partial<ParsedSections> = {};
  const headersBySection = new Map<keyof ParsedSections, string[]>();
  let currentSection: keyof ParsedSections | null = null;

  for (const line of raw.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const sectionMatch = line.match(/^=== (SOURCES|CONSUMPTION|ORIGIN_MIX|IMPORT_PARTNERS) ===$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1] as keyof ParsedSections;
      sections[currentSection] = [];
      headersBySection.delete(currentSection);
      continue;
    }

    if (!currentSection || line.trim() === '') {
      continue;
    }

    const headers = headersBySection.get(currentSection);
    if (!headers) {
      headersBySection.set(currentSection, line.split('\t'));
      continue;
    }

    const cells = line.split('\t');
    const row: RawRow = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    sections[currentSection]?.push(row);
  }

  return {
    SOURCES: sections.SOURCES ?? [],
    CONSUMPTION: sections.CONSUMPTION ?? [],
    ORIGIN_MIX: sections.ORIGIN_MIX ?? [],
    IMPORT_PARTNERS: sections.IMPORT_PARTNERS ?? [],
  };
}

function extractYear(values: string[], sectionName: string) {
  const years = [...new Set(values.map((value) => parseRequiredNumber(value, `${sectionName}:year`)))];
  if (years.length !== 1) {
    throw new Error(`${sectionName} has multiple years: ${years.join(', ')}`);
  }

  return years[0];
}

function parseRequiredNumber(value: string, label: string) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected number for ${label}, received "${value}"`);
  }

  return parsed;
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected optional number, received "${value}"`);
  }

  return parsed;
}

function splitRefIds(value: string) {
  return value
    .split('|')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function takeText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
