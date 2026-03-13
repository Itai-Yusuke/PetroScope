import { useDeferredValue } from 'react';
import type { CountryCatalogEntry, ToggleState } from '../types';

type ControlsPanelProps = {
  catalog: Record<string, CountryCatalogEntry>;
  selectedIso3s: string[];
  selectionColors: Record<string, string>;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  clearSelection: () => void;
  toggleCountry: (iso3: string) => void;
  toggles: ToggleState;
  setToggles: (value: ToggleState) => void;
};

export function ControlsPanel({
  catalog,
  selectedIso3s,
  selectionColors,
  searchTerm,
  setSearchTerm,
  clearSelection,
  toggleCountry,
  toggles,
  setToggles,
}: ControlsPanelProps) {
  const deferredSearchTerm = useDeferredValue(searchTerm.trim());
  const query = deferredSearchTerm.toLowerCase();
  const results = Object.values(catalog)
    .filter((country) => {
      if (!query) {
        return false;
      }

      return (
        country.iso3.toLowerCase().includes(query) ||
        country.nameJa.includes(deferredSearchTerm) ||
        country.nameEn.toLowerCase().includes(query)
      );
    })
    .slice(0, 12);

  return (
    <section className="controls-panel">
      <div className="control-block">
        <label className="control-label" htmlFor="country-search">
          国検索
        </label>
        <input
          autoComplete="off"
          className="search-input"
          id="country-search"
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="日本 / Japan / JPN"
          value={searchTerm}
        />
        {results.length > 0 ? (
          <div className="search-results" role="listbox">
            {results.map((country) => (
              <button
                className="search-result"
                key={country.iso3}
                onClick={() => {
                  toggleCountry(country.iso3);
                  setSearchTerm('');
                }}
                type="button"
              >
                <span>{country.nameJa}</span>
                <span>
                  {country.nameEn} · {country.iso3}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="control-block">
        <div className="control-row">
          <span className="control-label">選択中</span>
          <button className="ghost-button" onClick={clearSelection} type="button">
            全解除
          </button>
        </div>
        <div className="chip-list">
          {selectedIso3s.length === 0 ? <span className="empty-chip">未選択</span> : null}
          {selectedIso3s.map((iso3) => {
            const country = catalog[iso3];
            return (
              <button
                className="selection-chip"
                key={iso3}
                onClick={() => toggleCountry(iso3)}
                type="button"
              >
                <span className="chip-dot" style={{ backgroundColor: selectionColors[iso3] }} />
                <span>{country?.nameJa ?? iso3}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="control-block">
        <span className="control-label">表示切替</span>
        <label className="toggle-item">
          <input
            checked={toggles.showCircles}
            onChange={(event) => setToggles({ ...toggles, showCircles: event.target.checked })}
            type="checkbox"
          />
          <span>円サイズ表示</span>
        </label>
        <label className="toggle-item">
          <input
            checked={toggles.showArrows}
            onChange={(event) => setToggles({ ...toggles, showArrows: event.target.checked })}
            type="checkbox"
          />
          <span>矢印表示</span>
        </label>
        <label className="toggle-item">
          <input
            checked={toggles.showLabels}
            onChange={(event) => setToggles({ ...toggles, showLabels: event.target.checked })}
            type="checkbox"
          />
          <span>ラベル表示</span>
        </label>
      </div>
    </section>
  );
}
