import * as MediaLibrary from 'expo-media-library';

import { getSetting, isAssetProcessed, setSetting } from '@/lib/database';
import type { PendingAsset } from '@/types';

export const CONNECTED_ALBUM_KEY = 'connected_album_id';
export const MUG_TRACKER_ALBUM = 'Mug Tracker';

export function canonicalPhotoAssetId(assetId: string): string {
  return assetId.startsWith('ph://') ? assetId : `ph://${assetId}`;
}

export async function requestPhotoAccess(): Promise<boolean> {
  const permission = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
  if (permission.accessPrivileges === 'limited') {
    throw new Error(
      'Full Photos access is needed to connect or create an album. Choose “Allow Full Access” in iOS Settings.',
    );
  }
  return permission.granted && permission.accessPrivileges === 'all';
}

export async function listPhotoAlbums(): Promise<{ id: string; title: string }[]> {
  if (!(await requestPhotoAccess())) return [];
  const albums = await MediaLibrary.Album.getAll();
  return Promise.all(albums.map(async (album) => ({ id: album.id, title: await album.getTitle() })));
}

export async function connectAlbum(albumId: string): Promise<void> {
  await setSetting(CONNECTED_ALBUM_KEY, albumId);
}

export async function createMugTrackerAlbum(assetIds: string[]): Promise<string | null> {
  if (!(await requestPhotoAccess()) || assetIds.length === 0) return null;
  const assets = assetIds.map((id) => new MediaLibrary.Asset(canonicalPhotoAssetId(id)));
  const existing = await MediaLibrary.Album.get(MUG_TRACKER_ALBUM);
  const album = existing ?? (await MediaLibrary.Album.create(MUG_TRACKER_ALBUM, assets, false));
  if (existing) await album.add(assets);
  await connectAlbum(album.id);
  return album.id;
}

export async function addImageToConnectedAlbum(
  uri: string,
): Promise<{ assetId?: string; warning?: string }> {
  const albumId = await getSetting(CONNECTED_ALBUM_KEY);
  if (!albumId) return {};
  const permission = await MediaLibrary.getPermissionsAsync(false, ['photo']);
  if (!permission.granted || permission.accessPrivileges !== 'all') {
    return {
      warning: 'The mug was saved in the app, but Photos access must be restored in Settings.',
    };
  }

  let asset: MediaLibrary.Asset;
  try {
    asset = await MediaLibrary.Asset.create(uri);
  } catch (error) {
    return {
      warning: `The mug was saved in the app, but could not be copied to Photos: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  try {
    await new MediaLibrary.Album(albumId).add(asset);
    return { assetId: asset.id };
  } catch {
    return {
      assetId: asset.id,
      warning:
        'The photo was saved to Photos, but its connected album is unavailable. Choose an album again in Settings.',
    };
  }
}

export async function scanConnectedAlbum(): Promise<PendingAsset[]> {
  const albumId = await getSetting(CONNECTED_ALBUM_KEY);
  if (!albumId) return [];
  const permission = await MediaLibrary.getPermissionsAsync(false, ['photo']);
  if (!permission.granted) {
    throw new Error('Photo access changed. Reconnect the album in Settings.');
  }

  const assets = await new MediaLibrary.Album(albumId).getAssets();
  const pending: PendingAsset[] = [];
  for (const asset of assets) {
    if (await isAssetProcessed(asset.id)) continue;
    pending.push({
      uri: await asset.getUri(),
      assetId: asset.id,
      source: 'album_scan',
    });
  }
  return pending;
}
