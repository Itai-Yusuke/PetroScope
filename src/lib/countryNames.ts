import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';
import ja from 'i18n-iso-countries/langs/ja.json';

countries.registerLocale(en);
countries.registerLocale(ja);

export function getCountryNames(iso3: string) {
  const nameJa = countries.getName(iso3, 'ja') ?? iso3;
  const nameEn = countries.getName(iso3, 'en') ?? iso3;

  return { nameJa, nameEn };
}
