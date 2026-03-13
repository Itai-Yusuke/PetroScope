import { arc, pie } from 'd3';
import type { PieArcDatum } from 'd3';
import { useState } from 'react';
import { formatUnitLabel } from '../lib/format';
import type { DataStatus, OilConsumptionDataset, OilOriginMixDataset, SourcesCatalog } from '../lib/schemas';
import type { CountryCatalogEntry } from '../types';

type CountryCardProps = {
  country: CountryCatalogEntry;
  consumption: OilConsumptionDataset['countries'][string] | undefined;
  consumptionUnit: string;
  mix: OilOriginMixDataset['countries'][string] | undefined;
  year: number;
  color: string;
  catalog: Record<string, CountryCatalogEntry>;
  sources: SourcesCatalog;
};

type PieSlice = {
  label: string;
  value: number;
  color: string;
};

type PartnerRow = {
  sourceIso3: string;
  sourceNameJa: string;
  sharePct: number;
  volume?: number;
  volumeUnit?: string;
  sourceRefIds: string[];
};

export function CountryCard({
  country,
  consumption,
  consumptionUnit,
  mix,
  year,
  color,
  catalog,
  sources,
}: CountryCardProps) {
  const [showAllPartners, setShowAllPartners] = useState(false);
  const status = resolveCountryStatus(consumption?.status, mix?.status);
  const partners: PartnerRow[] = (mix?.importPartners ?? []).map((partner) => ({
    sourceIso3: partner.sourceIso3,
    sourceNameJa: partner.sourceNameJa ?? catalog[partner.sourceIso3]?.nameJa ?? partner.sourceIso3,
    sharePct: partner.sharePct,
    volume: partner.volume,
    volumeUnit: partner.volumeUnit,
    sourceRefIds: partner.sourceRefIds,
  }));
  const visiblePartners = showAllPartners ? partners : collapsePartners(partners, 5);
  const pieData = createPieData(mix, visiblePartners);
  const pieGenerator = pie<PieSlice>()
    .sort(null)
    .value((entry) => entry.value);
  const arcGenerator = arc<PieArcDatum<PieSlice>>().innerRadius(34).outerRadius(74);
  const sourceMap = Object.fromEntries(sources.sources.map((source) => [source.id, source]));

  return (
    <article className="country-card" style={{ borderTopColor: color }}>
      <header className="card-header">
        <div>
          <h3>{country.nameJa}</h3>
          <p>
            {country.nameEn} · {country.iso3} · {year}
          </p>
        </div>
        <span className={`status-badge status-${status}`}>{status}</span>
      </header>

      <div className="metric-grid">
        <Metric
          label="年間消費量"
          value={consumption?.value ? `${formatValue(consumption.value)} ${formatUnitLabel(consumptionUnit)}` : 'N/A'}
        />
        <Metric label="国内由来比率" value={mix?.domesticSharePct != null ? `${mix.domesticSharePct.toFixed(1)}%` : 'N/A'} />
        <Metric label="輸入依存比率" value={mix?.importSharePct != null ? `${mix.importSharePct.toFixed(1)}%` : 'N/A'} />
        <Metric label="輸入元国数" value={String(partners.length)} />
      </div>

      <div className="card-visuals">
        <div className="pie-panel">
          <svg aria-label={`${country.nameJa} の調達構成`} viewBox="0 0 180 180">
            <g transform="translate(90 90)">
              {pieGenerator(pieData).map((slice) => (
                <path d={arcGenerator(slice) ?? ''} fill={slice.data.color} key={slice.data.label} />
              ))}
              <circle cx="0" cy="0" fill="#fffdf7" r="26" />
              <text className="pie-center-text" textAnchor="middle" x="0" y="-2">
                Mix
              </text>
              <text className="pie-center-subtext" textAnchor="middle" x="0" y="16">
                {country.iso3}
              </text>
            </g>
          </svg>
          <div className="pie-legend">
            {pieData.map((entry) => (
              <div className="pie-legend-row" key={entry.label}>
                <span className="chip-dot" style={{ backgroundColor: entry.color }} />
                <span>{entry.label}</span>
                <span>{entry.value.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="table-panel">
          <div className="card-subheader">
            <h4>輸入元一覧</h4>
            {partners.length > 5 ? (
              <button className="ghost-button" onClick={() => setShowAllPartners((current) => !current)} type="button">
                {showAllPartners ? '上位表示' : '全件表示'}
              </button>
            ) : null}
          </div>
          <table className="partner-table">
            <thead>
              <tr>
                <th>輸入元</th>
                <th>シェア</th>
                <th>輸入量</th>
                <th>出典</th>
              </tr>
            </thead>
            <tbody>
              {visiblePartners.length === 0 ? (
                <tr>
                  <td className="muted" colSpan={4}>
                    輸入元データなし
                  </td>
                </tr>
              ) : (
                visiblePartners.map((partner) => (
                  <tr key={`${country.iso3}-${partner.sourceIso3}`}>
                    <td>{partner.sourceNameJa}</td>
                    <td>{partner.sharePct.toFixed(1)}%</td>
                    <td>
                      {partner.volume != null
                        ? `${formatValue(partner.volume)} ${formatUnitLabel(partner.volumeUnit)}`.trim()
                        : 'N/A'}
                    </td>
                    <td>
                      <SourceList sourceIds={partner.sourceRefIds} sourceMap={sourceMap} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="notes-panel">
        <h4>注記</h4>
        <ul>
          <li>定義: 年間 oil consumption を円サイズに使用</li>
          <li>欠損: {mix?.missingReason ?? consumption?.missingReason ?? '明示的な欠損理由なし'}</li>
          <li>丸め: 表示は小数 1 桁、内部値は JSON の原値を使用</li>
          <li>備考: {mix?.notes ?? country.note ?? '特記事項なし'}</li>
        </ul>
        <div className="source-section">
          <h5>関連出典</h5>
          <SourceList
            sourceIds={[...(consumption?.sourceRefIds ?? []), ...(mix?.sourceRefIds ?? [])]}
            sourceMap={sourceMap}
          />
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SourceList({
  sourceIds,
  sourceMap,
}: {
  sourceIds: string[];
  sourceMap: Record<string, SourcesCatalog['sources'][number]>;
}) {
  if (sourceIds.length === 0) {
    return <span className="muted">なし</span>;
  }

  return (
    <div className="source-list">
      {sourceIds.map((id) => {
        const source = sourceMap[id];
        if (!source) {
          return (
            <span className="source-pill" key={id}>
              {id}
            </span>
          );
        }

        return (
          <a className="source-pill" href={source.url} key={id} rel="noreferrer" target="_blank">
            {source.publisher} {source.year}
          </a>
        );
      })}
    </div>
  );
}

function createPieData(
  mix: OilOriginMixDataset['countries'][string] | undefined,
  visiblePartners: PartnerRow[],
) {
  const palette = ['#0e7490', '#f59e0b', '#ef4444', '#10b981', '#7c3aed', '#f97316', '#64748b'];
  const data: PieSlice[] = [];
  if (mix?.domesticSharePct != null && mix.domesticSharePct > 0) {
    data.push({ label: '自国由来', value: mix.domesticSharePct, color: '#111827' });
  }
  visiblePartners.forEach((partner, index) => {
    data.push({
      label: partner.sourceNameJa,
      value: partner.sharePct,
      color: palette[index % palette.length],
    });
  });

  if (data.length === 0) {
    data.push({ label: '欠損', value: 100, color: '#cbd5e1' });
  }

  return data;
}

function collapsePartners(partners: PartnerRow[], limit: number) {
  if (partners.length <= limit) {
    return partners;
  }

  const topPartners = partners.slice(0, limit);
  const remainingShare = partners.slice(limit).reduce((total, partner) => total + partner.sharePct, 0);
  return [
    ...topPartners,
    {
      sourceIso3: 'OTH',
      sourceNameJa: 'その他',
      sharePct: remainingShare,
      volume: undefined,
      volumeUnit: undefined,
      sourceRefIds: [],
    },
  ];
}

function resolveCountryStatus(
  consumptionStatus: DataStatus | undefined,
  mixStatus: DataStatus | undefined,
): DataStatus {
  if (consumptionStatus === 'complete' && mixStatus === 'complete') {
    return 'complete';
  }
  if (!consumptionStatus && !mixStatus) {
    return 'missing';
  }
  if (consumptionStatus === 'missing' && (mixStatus === 'missing' || !mixStatus)) {
    return 'missing';
  }
  return 'partial';
}

function formatValue(value: number) {
  return new Intl.NumberFormat('ja-JP', {
    maximumFractionDigits: 1,
  }).format(value);
}
