const UNIT_LABELS: Record<string, string> = {
  exajoules: 'エクサジュール',
  million_tonnes: '百万トン',
  million_tonnes_oil_equ: '百万トン石油換算',
  million_tonnes_oil_equivalent: '百万トン石油換算',
};

export function formatUnitLabel(unit?: string) {
  if (!unit) {
    return '';
  }

  return UNIT_LABELS[unit] ?? unit;
}
