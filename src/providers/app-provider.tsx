import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';

import {
  getSetting,
  initializeDatabase,
  listCollectionItems,
  markAssetProcessed,
  setSetting,
} from '@/lib/database';
import { scanConnectedAlbum } from '@/lib/photos';
import type { CollectionItem, PendingAsset } from '@/types';

const ONBOARDING_KEY = 'onboarding_complete';

type AppContextValue = {
  ready: boolean;
  onboardingComplete: boolean;
  collection: CollectionItem[];
  queue: PendingAsset[];
  error: string | null;
  finishOnboarding: () => Promise<void>;
  enqueue: (assets: PendingAsset[]) => void;
  finishCurrentAsset: (status: 'saved' | 'ignored') => Promise<void>;
  refreshCollection: () => Promise<void>;
  refreshAlbum: () => Promise<number>;
  clearError: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [queue, setQueue] = useState<PendingAsset[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refreshCollection = useCallback(async () => {
    setCollection(await listCollectionItems());
  }, []);

  const enqueue = useCallback((assets: PendingAsset[]) => {
    setQueue((current) => {
      const keys = new Set(current.map((asset) => asset.assetId ?? asset.uri));
      return [
        ...current,
        ...assets.filter((asset) => !keys.has(asset.assetId ?? asset.uri)),
      ];
    });
  }, []);

  const refreshAlbum = useCallback(async () => {
    try {
      const assets = await scanConnectedAlbum();
      enqueue(assets);
      return assets.length;
    } catch (albumError) {
      setError(albumError instanceof Error ? albumError.message : 'Could not scan the photo album.');
      return 0;
    }
  }, [enqueue]);

  useEffect(() => {
    void (async () => {
      try {
        await initializeDatabase();
        setOnboardingComplete((await getSetting(ONBOARDING_KEY)) === 'true');
        await refreshCollection();
      } catch (initializationError) {
        setError(
          initializationError instanceof Error
            ? initializationError.message
            : 'Could not initialize Mug Tracker.',
        );
      } finally {
        setReady(true);
      }
    })();
  }, [refreshCollection]);

  useEffect(() => {
    if (!ready || !onboardingComplete) return;
    const initialRefresh = setTimeout(() => void refreshAlbum(), 0);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshAlbum();
    });
    return () => {
      clearTimeout(initialRefresh);
      subscription.remove();
    };
  }, [onboardingComplete, ready, refreshAlbum]);

  const finishOnboarding = useCallback(async () => {
    await setSetting(ONBOARDING_KEY, 'true');
    setOnboardingComplete(true);
  }, []);

  const finishCurrentAsset = useCallback(
    async (status: 'saved' | 'ignored') => {
      const current = queue[0];
      if (current?.assetId) await markAssetProcessed(current.assetId, status);
      setQueue((assets) => assets.slice(1));
    },
    [queue],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      onboardingComplete,
      collection,
      queue,
      error,
      finishOnboarding,
      enqueue,
      finishCurrentAsset,
      refreshCollection,
      refreshAlbum,
      clearError: () => setError(null),
    }),
    [
      collection,
      enqueue,
      error,
      finishCurrentAsset,
      finishOnboarding,
      onboardingComplete,
      queue,
      ready,
      refreshAlbum,
      refreshCollection,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider.');
  return value;
}
