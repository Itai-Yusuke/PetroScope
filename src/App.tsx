import { useEffect, useState } from 'react';
import { ControlsPanel } from './components/ControlsPanel';
import { CountryCard } from './components/CountryCard';
import { Legend } from './components/Legend';
import { WorldMap } from './components/WorldMap';
import { loadAppData } from './lib/data';
import { buildCountryCatalog, extractCountryFeatures } from './lib/geo';
import type { LoadedData, ToggleState, TooltipState } from './types';

const YEAR = 2024;
const SELECTION_PALETTE = ['#bf360c', '#146c94', '#2e7d32', '#8e24aa', '#ef6c00', '#455a64', '#0f766e', '#d81b60'];

export default function App() {
  const [selectedIso3s, setSelectedIso3s] = useState<string[]>(readSelectionFromUrl);
  const [searchTerm, setSearchTerm] = useState('');
  const [toggles, setToggles] = useState<ToggleState>({
    showCircles: true,
    showArrows: true,
    showLabels: false,
  });
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [state, setState] = useState<
    | {
        status: 'loading';
      }
    | {
        status: 'error';
        message: string;
      }
    | {
        status: 'ready';
        data: LoadedData;
      }
  >({ status: 'loading' });

  useEffect(() => {
    let isActive = true;

    loadAppData(YEAR)
      .then((data) => {
        if (!isActive) {
          return;
        }

        setState({ status: 'ready', data });
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'データの読み込みに失敗しました。',
        });
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedIso3s.length > 0) {
      url.searchParams.set('countries', selectedIso3s.join(','));
    } else {
      url.searchParams.delete('countries');
    }

    window.history.replaceState({}, '', url);
  }, [selectedIso3s]);

  if (state.status === 'loading') {
    return <div className="app-state">データを読み込んでいます...</div>;
  }

  if (state.status === 'error') {
    return <div className="app-state app-state-error">{state.message}</div>;
  }

  const features = extractCountryFeatures(state.data.topology);
  const catalog = buildCountryCatalog(features, state.data.master, state.data.displayOverrides);
  const validSelectedIso3s = selectedIso3s.filter((iso3) => Boolean(catalog[iso3]));
  const selectionColors = Object.fromEntries(
    validSelectedIso3s.map((iso3, index) => [iso3, SELECTION_PALETTE[index % SELECTION_PALETTE.length]]),
  );
  const consumptionValues = Object.values(state.data.consumption.countries)
    .map((entry) => entry.value)
    .filter((value): value is number => typeof value === 'number');
  const arrowValues = Object.values(state.data.originMix.countries).flatMap((countryMix) => {
    return countryMix.importPartners
      .map((partner) => partner.volume)
      .filter((value): value is number => typeof value === 'number');
  });

  function toggleCountry(iso3: string) {
    setSelectedIso3s((current) => {
      return current.includes(iso3) ? current.filter((candidate) => candidate !== iso3) : [...current, iso3];
    });
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">World crude sourcing explorer</p>
          <h1>PetroScope</h1>
        </div>
        <div className="top-links">
          <span className="year-chip">{YEAR}</span>
          <a href="./docs/data-definition.html" rel="noreferrer" target="_blank">
            データ定義
          </a>
          <a href="./docs/data-sources.html" rel="noreferrer" target="_blank">
            データソース
          </a>
        </div>
      </header>

      <main className="layout">
        <aside className="left-panel">
          <ControlsPanel
            catalog={catalog}
            clearSelection={() => setSelectedIso3s([])}
            searchTerm={searchTerm}
            selectedIso3s={validSelectedIso3s}
            selectionColors={selectionColors}
            setSearchTerm={setSearchTerm}
            setToggles={setToggles}
            toggleCountry={toggleCountry}
            toggles={toggles}
          />
          {validSelectedIso3s.length > 8 ? (
            <div className="warning-banner">8 件を超える選択は視認性が低下します。</div>
          ) : null}
        </aside>

        <section className="main-panel">
          <WorldMap
            catalog={catalog}
            consumption={state.data.consumption}
            features={features}
            originMix={state.data.originMix}
            selectedIso3s={validSelectedIso3s}
            selectionColors={selectionColors}
            setTooltip={setTooltip}
            toggleCountry={toggleCountry}
            toggles={toggles}
          />

          <Legend arrowValues={arrowValues} consumptionValues={consumptionValues} />
        </section>

        <aside className="side-panel">
          {validSelectedIso3s.length === 0 ? (
            <div className="empty-panel">
              国をクリック、または検索から選択すると詳細カードを表示します。
            </div>
          ) : null}
          {validSelectedIso3s.map((iso3) => (
            <CountryCard
              catalog={catalog}
              color={selectionColors[iso3]}
              consumption={state.data.consumption.countries[iso3]}
              consumptionUnit={state.data.consumption.unit}
              country={catalog[iso3]}
              key={iso3}
              mix={state.data.originMix.countries[iso3]}
              sources={state.data.sources}
              year={YEAR}
            />
          ))}
        </aside>
      </main>

      {tooltip ? (
        <div className="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <strong>{tooltip.title}</strong>
          {tooltip.subtitle ? <span>{tooltip.subtitle}</span> : null}
          {tooltip.lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function readSelectionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const countries = params.get('countries');
  if (!countries) {
    return [];
  }

  return countries
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
}
