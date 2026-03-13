import { extent, scaleSqrt } from 'd3';

type LegendProps = {
  consumptionValues: number[];
  arrowValues: number[];
};

export function Legend({ consumptionValues, arrowValues }: LegendProps) {
  const [minConsumption = 0, maxConsumption = 1] = extent(consumptionValues);
  const circleScale = scaleSqrt<number, number>()
    .domain([minConsumption, Math.max(minConsumption + 1, maxConsumption)])
    .range([4, 24]);
  const [minArrow = 0, maxArrow = 1] = extent(arrowValues);
  const arrowScale = scaleSqrt<number, number>()
    .domain([minArrow, Math.max(minArrow + 1, maxArrow)])
    .range([1.2, 6]);
  const samples = [minConsumption, (minConsumption + maxConsumption) / 2, maxConsumption];
  const arrowSamples = [minArrow, (minArrow + maxArrow) / 2, maxArrow];

  return (
    <section className="legend-panel">
      <div className="legend-block">
        <h3>円サイズ</h3>
        <div className="legend-circles">
          {samples.map((sample, index) => (
            <div className="legend-circle-item" key={`${sample}-${index}`}>
              <span
                className="legend-circle"
                style={{
                  width: `${circleScale(sample) * 2}px`,
                  height: `${circleScale(sample) * 2}px`,
                }}
              />
              <span>{formatValue(sample)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="legend-block">
        <h3>矢印太さ</h3>
        <div className="legend-lines">
          {arrowSamples.map((sample, index) => (
            <div className="legend-line-item" key={`${sample}-${index}`}>
              <span className="legend-line" style={{ height: `${arrowScale(sample)}px` }} />
              <span>{formatValue(sample)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="legend-block">
        <h3>状態</h3>
        <div className="status-legend">
          <span className="status-badge status-complete">complete</span>
          <span className="status-badge status-partial">partial</span>
          <span className="status-badge status-missing">missing</span>
        </div>
      </div>
    </section>
  );
}

function formatValue(value: number) {
  return new Intl.NumberFormat('ja-JP', {
    maximumFractionDigits: 1,
  }).format(value);
}
