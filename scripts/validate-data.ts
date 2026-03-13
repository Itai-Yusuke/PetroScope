import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  countriesMasterSchema,
  displayOverridesSchema,
  oilConsumptionSchema,
  oilOriginMixSchema,
  sourcesSchema,
} from '../src/lib/schemas';

type ValidationIssue = {
  file: string;
  message: string;
};

const root = process.cwd();
const dataDir = path.join(root, 'public', 'data');

async function main() {
  const issues: ValidationIssue[] = [];

  const master = countriesMasterSchema.parse(
    JSON.parse(await fs.readFile(path.join(dataDir, 'countries.master.json'), 'utf8')),
  );
  const sources = sourcesSchema.parse(
    JSON.parse(await fs.readFile(path.join(dataDir, 'sources.json'), 'utf8')),
  );
  const displayOverrides = displayOverridesSchema.parse(
    JSON.parse(await fs.readFile(path.join(dataDir, 'display-overrides.json'), 'utf8')),
  );

  const masterIso3 = new Set(master.countries.map((country) => country.iso3));
  const sourceIds = new Set(sources.sources.map((source) => source.id));

  for (const iso3 of Object.keys(displayOverrides.countries)) {
    if (!masterIso3.has(iso3)) {
      issues.push({ file: 'display-overrides.json', message: `${iso3} が countries.master.json に存在しません。` });
    }
  }

  const files = await fs.readdir(dataDir);
  const consumptionFiles = files.filter((file) => /^oil-consumption-\d{4}\.json$/.test(file));

  for (const consumptionFile of consumptionFiles) {
    const year = Number(consumptionFile.match(/\d{4}/)?.[0]);
    const mixFile = `oil-origin-mix-${year}.json`;
    const consumption = oilConsumptionSchema.parse(
      JSON.parse(await fs.readFile(path.join(dataDir, consumptionFile), 'utf8')),
    );
    const mix = oilOriginMixSchema.parse(JSON.parse(await fs.readFile(path.join(dataDir, mixFile), 'utf8')));

    if (consumption.year !== mix.year) {
      issues.push({
        file: `${consumptionFile}, ${mixFile}`,
        message: `year が一致しません (${consumption.year} / ${mix.year})。`,
      });
    }

    for (const [iso3, country] of Object.entries(consumption.countries)) {
      if (!masterIso3.has(iso3)) {
        issues.push({ file: consumptionFile, message: `${iso3} が countries.master.json に存在しません。` });
      }

      for (const sourceRefId of country.sourceRefIds) {
        if (!sourceIds.has(sourceRefId)) {
          issues.push({ file: consumptionFile, message: `${iso3} が未知の sourceRefIds ${sourceRefId} を参照しています。` });
        }
      }
    }

    for (const [iso3, country] of Object.entries(mix.countries)) {
      if (!masterIso3.has(iso3)) {
        issues.push({ file: mixFile, message: `${iso3} が countries.master.json に存在しません。` });
      }

      const seenPartners = new Set<string>();
      let partnerShareTotal = 0;
      for (const partner of country.importPartners) {
        if (!masterIso3.has(partner.sourceIso3)) {
          issues.push({ file: mixFile, message: `${iso3} が未登録国 ${partner.sourceIso3} を輸入元に持っています。` });
        }
        if (seenPartners.has(partner.sourceIso3)) {
          issues.push({ file: mixFile, message: `${iso3} の importPartners に ${partner.sourceIso3} が重複しています。` });
        }
        seenPartners.add(partner.sourceIso3);
        partnerShareTotal += partner.sharePct;

        for (const sourceRefId of partner.sourceRefIds) {
          if (!sourceIds.has(sourceRefId)) {
            issues.push({ file: mixFile, message: `${iso3} -> ${partner.sourceIso3} が未知の sourceRefIds ${sourceRefId} を参照しています。` });
          }
        }
      }

      for (const sourceRefId of country.sourceRefIds) {
        if (!sourceIds.has(sourceRefId)) {
          issues.push({ file: mixFile, message: `${iso3} が未知の sourceRefIds ${sourceRefId} を参照しています。` });
        }
      }

      if (country.status === 'missing' && !country.missingReason) {
        issues.push({ file: mixFile, message: `${iso3} は missing ですが missingReason がありません。` });
      }

      if (typeof country.domesticSharePct === 'number') {
        const total = country.domesticSharePct + partnerShareTotal;
        if (Math.abs(total - 100) > 0.5) {
          issues.push({
            file: mixFile,
            message: `${iso3} の domesticSharePct + importPartners.sharePct 合計が 100 から外れています (${total.toFixed(2)})。`,
          });
        }
      }

      if (typeof country.importSharePct === 'number' && Math.abs(country.importSharePct - partnerShareTotal) > 0.5) {
        issues.push({
          file: mixFile,
          message: `${iso3} の importSharePct と partner share 合計が一致しません (${country.importSharePct.toFixed(2)} / ${partnerShareTotal.toFixed(2)})。`,
        });
      }
    }
  }

  if (issues.length > 0) {
    console.error('Data validation failed:');
    for (const issue of issues) {
      console.error(`- [${issue.file}] ${issue.message}`);
    }
    process.exitCode = 1;
  } else {
    console.log('Data validation passed.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
