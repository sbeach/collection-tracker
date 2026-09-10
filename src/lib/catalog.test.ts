import assert from 'node:assert/strict';
import test from 'node:test';

import {
  catalogMugsForPlace,
  exactCatalogMatch,
  localDateKey,
  missingMugsForPlace,
  rankCatalogMatches,
} from './catalog';

test('OCR ranking prefers the longest location match', () => {
  assert.equal(rankCatalogMatches('STARBUCKS NEW YORK CITY')[0]?.id, 'city-new-york-ny');
  assert.equal(exactCatalogMatch('TN')?.id, 'state-tn');
});

test('a city can offer both city and state mugs', () => {
  const place = { city: 'Nashville', region: 'Tennessee', isoCountryCode: 'US' };
  assert.deepEqual(
    catalogMugsForPlace(place).map((mug) => mug.id),
    ['state-tn', 'city-nashville-tn'],
  );
  assert.deepEqual(
    missingMugsForPlace(place, new Set(['state-tn'])).map((mug) => mug.id),
    ['city-nashville-tn'],
  );
});

test('location matching excludes non-US places and date keys use local dates', () => {
  assert.deepEqual(
    catalogMugsForPlace({ city: 'Nashville', region: 'Tennessee', isoCountryCode: 'CA' }),
    [],
  );
  assert.equal(localDateKey(new Date(2026, 7, 30, 23, 59)), '2026-08-30');
});
