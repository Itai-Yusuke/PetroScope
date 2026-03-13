import { extent, geoNaturalEarth1, geoPath, scaleSqrt } from 'd3';
import type { GeoProjection } from 'd3';
import { formatUnitLabel } from '../lib/format';
import type { OilConsumptionDataset, OilOriginMixDataset } from '../lib/schemas';
import { buildCurvePath } from '../lib/geo';
import type { CountryCatalogEntry, CountryFeature, ToggleState, TooltipState } from '../types';

const WIDTH = 1120;
const HEIGHT = 620;

type WorldMapProps = {
  features: CountryFeature[];
  catalog: Record<string, CountryCatalogEntry>;
  consumption: OilConsumptionDataset;
  originMix: OilOriginMixDataset;
  selectedIso3s: string[];
  toggleCountry: (iso3: string) => void;
  selectionColors: Record<string, string>;
  toggles: ToggleState;
  setTooltip: (tooltip: TooltipState | null) => void;
};

type ArrowDatum = {
  key: string;
  sourceIso3: string;
  targetIso3: string;
  sourcePoint: [number, number];
  targetPoint: [number, number];
  width: number;
  headScale: number;
  color: string;
  label: string;
  volume?: number;
  volumeUnit?: string;
};

export function WorldMap({
  features,
  catalog,
  consumption,
  originMix,
  selectedIso3s,
  toggleCountry,
  selectionColors,
  toggles,
  setTooltip,
}: WorldMapProps) {
  const projection = geoNaturalEarth1().fitExtent(
    [
      [18, 18],
      [WIDTH - 18, HEIGHT - 18],
    ],
    { type: 'Sphere' },
  );
  const path = geoPath(projection);
  const selectedSet = new Set(selectedIso3s);
  const consumptionValues = Object.values(consumption.countries)
    .map((entry) => entry.value)
    .filter((value): value is number => typeof value === 'number');
  const [minConsumption = 0, maxConsumption = 0] = extent(consumptionValues);
  const circleScale = scaleSqrt<number, number>()
    .domain([Math.max(0, minConsumption), Math.max(maxConsumption, minConsumption + 1)])
    .range([4, 38]);
  const allArrowVolumes = Object.values(originMix.countries).flatMap((countryMix) => {
    return countryMix.importPartners
      .map((partner) => partner.volume)
      .filter((value): value is number => typeof value === 'number');
  });
  const [minArrowVolume = 0, maxArrowVolume = 1] = extent(allArrowVolumes);
  const arrowScale = scaleSqrt<number, number>()
    .domain([Math.max(0, minArrowVolume), Math.max(maxArrowVolume, minArrowVolume + 1)])
    .range([3.5, 18]);
  const legacyHeadScale = scaleSqrt<number, number>()
    .domain([Math.max(0, minArrowVolume), Math.max(maxArrowVolume, minArrowVolume + 1)])
    .range([1.2, 7]);

  const pointByIso3 = Object.fromEntries(
    Object.values(catalog)
      .map((country) => {
        const projected = projectCountryPoint(country, projection);
        return projected ? [country.iso3, projected] : null;
      })
      .filter((entry): entry is [string, [number, number]] => Boolean(entry)),
  );

  const circles = Object.entries(consumption.countries)
    .map(([iso3, entry]) => {
      const point = pointByIso3[iso3];
      if (!point || typeof entry.value !== 'number' || entry.status === 'missing') {
        return null;
      }

      return {
        iso3,
        point,
        radius: circleScale(entry.value),
        value: entry.value,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const arrows = toggles.showArrows
    ? selectedIso3s.reduce<ArrowDatum[]>((accumulator, targetIso3) => {
        const target = pointByIso3[targetIso3];
        const targetMix = originMix.countries[targetIso3];
        if (!target || !targetMix) {
          return accumulator;
        }

        for (const partner of targetMix.importPartners) {
          const source = pointByIso3[partner.sourceIso3];
          if (!source) {
            continue;
          }

          const volume =
            partner.volume ??
            (typeof targetMix.estimatedTotalSupplyVolume === 'number'
              ? targetMix.estimatedTotalSupplyVolume * (partner.sharePct / 100)
              : undefined);

          accumulator.push({
            key: `${targetIso3}-${partner.sourceIso3}`,
            sourceIso3: partner.sourceIso3,
            targetIso3,
            sourcePoint: source,
            targetPoint: target,
            width: arrowScale(volume ?? partner.sharePct),
            headScale: legacyHeadScale(volume ?? partner.sharePct),
            color: selectionColors[targetIso3],
            label: `${partner.sourceNameJa ?? catalog[partner.sourceIso3]?.nameJa ?? partner.sourceIso3} → ${
              catalog[targetIso3]?.nameJa ?? targetIso3
            }`,
            volume,
            volumeUnit: partner.volumeUnit ?? targetMix.estimatedTotalSupplyUnit,
          });
        }

        return accumulator;
      }, [])
    : [];

  return (
    <div className="map-shell">
      <svg aria-label="世界地図" className="world-map" role="img" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <defs>
          <linearGradient id="ocean-gradient" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#dbeafe" />
            <stop offset="100%" stopColor="#c7e7f6" />
          </linearGradient>
          {arrows.map((arrow) => (
            <marker
              key={arrow.key}
              id={`arrow-${arrow.key}`}
              markerUnits="userSpaceOnUse"
              markerWidth={arrow.headScale * 7}
              markerHeight={arrow.headScale * 7}
              orient="auto-start-reverse"
              refX="7"
              refY="3.5"
              viewBox="0 0 7 7"
            >
              <path d="M0,0 L7,3.5 L0,7 Z" fill={arrow.color} />
            </marker>
          ))}
        </defs>

        <rect className="map-ocean" height={HEIGHT} rx="24" width={WIDTH} x="0" y="0" />

        <g className="map-countries">
          {features.map((feature) => {
            const iso3 = String(feature.id);
            const country = catalog[iso3];
            const isSelected = selectedSet.has(iso3);
            const isDataReady = Boolean(consumption.countries[iso3] || originMix.countries[iso3]);
            return (
              <path
                key={iso3}
                className={[
                  'country-shape',
                  isSelected ? 'is-selected' : '',
                  isDataReady ? 'has-data' : 'is-missing',
                ]
                  .filter(Boolean)
                  .join(' ')}
                d={path(feature) ?? ''}
                onClick={() => toggleCountry(iso3)}
                onMouseEnter={(event) => {
                  const consumptionEntry = consumption.countries[iso3];
                  const mixEntry = originMix.countries[iso3];
                  setTooltip({
                    x: event.clientX + 16,
                    y: event.clientY + 16,
                    title: country?.nameJa ?? iso3,
                    subtitle: `${country?.nameEn ?? iso3} · ${iso3}`,
                    lines: [
                      `消費量データ: ${consumptionEntry?.status ?? 'missing'}`,
                      `調達構成データ: ${mixEntry?.status ?? 'missing'}`,
                    ],
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
                style={
                  isSelected
                    ? {
                        stroke: selectionColors[iso3],
                        strokeWidth: 2.4,
                      }
                    : undefined
                }
              />
            );
          })}
        </g>

        {toggles.showCircles ? (
          <g className="map-circles">
            {circles.map((circle) => (
              <circle
                key={circle.iso3}
                className={selectedSet.has(circle.iso3) ? 'consumption-circle is-selected' : 'consumption-circle'}
                cx={circle.point[0]}
                cy={circle.point[1]}
                onClick={() => toggleCountry(circle.iso3)}
                onMouseEnter={(event) => {
                  const country = catalog[circle.iso3];
                  setTooltip({
                    x: event.clientX + 16,
                    y: event.clientY + 16,
                    title: `${country?.nameJa ?? circle.iso3} の年間 oil consumption`,
                    subtitle: `${country?.nameEn ?? circle.iso3} · ${circle.iso3}`,
                    lines: [`${formatCompact(circle.value)} ${formatUnitLabel(consumption.unit)}`],
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
                r={circle.radius}
              />
            ))}
          </g>
        ) : null}

        <g className="map-arrows">
          {arrows.map((arrow) => (
            <path
              key={arrow.key}
              d={buildCurvePath(arrow.sourcePoint, arrow.targetPoint)}
              fill="none"
              markerEnd={`url(#arrow-${arrow.key})`}
              onMouseEnter={(event) => {
                setTooltip({
                  x: event.clientX + 16,
                  y: event.clientY + 16,
                  title: arrow.label,
                  lines: [
                    arrow.volume
                      ? `輸入量: ${formatCompact(arrow.volume)} ${formatUnitLabel(arrow.volumeUnit)}`.trim()
                      : '輸入量: share から派生',
                  ],
                });
              }}
              onMouseLeave={() => setTooltip(null)}
              stroke={arrow.color}
              strokeLinecap="round"
              strokeOpacity="0.72"
              strokeWidth={arrow.width}
            />
          ))}
        </g>

        {toggles.showLabels ? (
          <g className="map-labels">
            {selectedIso3s.map((iso3) => {
              const point = pointByIso3[iso3];
              const country = catalog[iso3];
              if (!point || !country) {
                return null;
              }

              return (
                <text
                  key={iso3}
                  fill={selectionColors[iso3]}
                  fontSize="14"
                  fontWeight="700"
                  x={point[0] + (country.labelOffsetPx?.x ?? 10)}
                  y={point[1] + (country.labelOffsetPx?.y ?? -10)}
                >
                  {country.nameJa}
                </text>
              );
            })}
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function projectCountryPoint(country: CountryCatalogEntry, projection: GeoProjection) {
  const projected = projection([country.displayPoint.lon, country.displayPoint.lat]);
  if (!projected) {
    return null;
  }

  return [projected[0], projected[1]] as [number, number];
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('ja-JP', {
    maximumFractionDigits: 1,
  }).format(value);
}
