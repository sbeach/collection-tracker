export type LocationLevel = 'city' | 'state';
export type IngestionSource = 'camera' | 'photo_import' | 'album_scan';

export type MugSeries = {
  id: string;
  name: string;
};

export type CatalogMug = {
  id: string;
  displayName: string;
  locationKey: string;
  level: LocationLevel;
  stateCode: string;
  stateName: string;
  city?: string;
  aliases: string[];
  seriesId: string;
  active: boolean;
  inventoryStatus: 'unverified';
};

export type CatalogFile = {
  version: number;
  series: MugSeries[];
  mugs: CatalogMug[];
};

export type CollectionItem = {
  id: number;
  catalogMugId: string | null;
  mugName: string | null;
  confirmedLocation: string;
  photoUri: string;
  sourceAssetId: string | null;
  source: IngestionSource;
  ocrText: string | null;
  createdAt: string;
};

export type PendingAsset = {
  uri: string;
  assetId?: string;
  source: IngestionSource;
};

export type Place = {
  city: string | null;
  region: string | null;
  isoCountryCode: string | null;
};
