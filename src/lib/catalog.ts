import catalogJson from '@/data/mugs.json';
import type { CatalogFile, CatalogMug, Place } from '@/types';

export const catalog = catalogJson as CatalogFile;

export function normalizeLocation(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function rankCatalogMatches(text: string): CatalogMug[] {
  const normalizedText = ` ${normalizeLocation(text)} `;

  return catalog.mugs
    .map((mug) => ({
      mug,
      score: mug.aliases.reduce((best, alias) => {
        const normalizedAlias = normalizeLocation(alias);
        return normalizedAlias.length >= 3 && normalizedText.includes(` ${normalizedAlias} `)
          ? Math.max(best, normalizedAlias.length)
          : best;
      }, 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.mug.displayName.localeCompare(b.mug.displayName))
    .map(({ mug }) => mug);
}

export function exactCatalogMatch(value: string): CatalogMug | undefined {
  const normalized = normalizeLocation(value);
  return catalog.mugs.find(
    (mug) =>
      normalizeLocation(mug.displayName) === normalized ||
      mug.aliases.some((alias) => normalizeLocation(alias) === normalized),
  );
}

export function catalogMugsForPlace(place: Place): CatalogMug[] {
  if (place.isoCountryCode && normalizeLocation(place.isoCountryCode) !== 'US') {
    return [];
  }

  const city = normalizeLocation(place.city ?? '');
  const region = normalizeLocation(place.region ?? '');

  return catalog.mugs.filter((mug) => {
    if (!mug.active) return false;
    const stateMatches =
      normalizeLocation(mug.stateCode) === region || normalizeLocation(mug.stateName) === region;
    if (!stateMatches) return false;
    return mug.level === 'state' || normalizeLocation(mug.city ?? '') === city;
  });
}

export function missingMugsForPlace(
  place: Place,
  ownedMugIds: ReadonlySet<string>,
): CatalogMug[] {
  return catalogMugsForPlace(place).filter((mug) => !ownedMugIds.has(mug.id));
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
