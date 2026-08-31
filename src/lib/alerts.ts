import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { localDateKey, missingMugsForPlace } from '@/lib/catalog';
import {
  initializeDatabase,
  notifiedMugIds,
  ownedMugIds,
  recordNotifications,
} from '@/lib/database';
import type { CatalogMug, Place } from '@/types';

export const LOCATION_TASK = 'mug-tracker-background-location';

function notificationBody(mugs: readonly CatalogMug[]): string {
  const names = mugs.map((mug) => mug.displayName);
  if (names.length <= 3) return `${names.join(', ')} may be available nearby.`;
  return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more may be available nearby.`;
}

export async function missingUnnotifiedMugs(place: Place): Promise<CatalogMug[]> {
  await initializeDatabase();
  const missing = missingMugsForPlace(place, await ownedMugIds());
  const date = localDateKey();
  const alreadyNotified = await notifiedMugIds(
    date,
    missing.map((mug) => mug.locationKey),
  );
  return missing.filter((mug) => !alreadyNotified.has(mug.id));
}

export async function evaluatePlaceAndNotify(place: Place): Promise<CatalogMug[]> {
  const mugs = await missingUnnotifiedMugs(place);
  if (mugs.length === 0) return [];

  await Notifications.scheduleNotificationAsync({
    content: {
      title: mugs.length === 1 ? 'A mug may be nearby' : 'Mugs may be nearby',
      body: notificationBody(mugs),
      data: { mugIds: mugs.map((mug) => mug.id) },
    },
    trigger: null,
  });
  await recordNotifications(mugs, localDateKey());
  return mugs;
}

export async function checkCurrentLocation(): Promise<{
  place: Place | null;
  mugs: CatalogMug[];
}> {
  let foreground = await Location.getForegroundPermissionsAsync();
  if (!foreground.granted) {
    foreground = await Location.requestForegroundPermissionsAsync();
  }
  if (!foreground.granted) return { place: null, mugs: [] };
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const [address] = await Location.reverseGeocodeAsync(position.coords);
  if (!address) return { place: null, mugs: [] };
  const place: Place = {
    city: address.city,
    region: address.region,
    isoCountryCode: address.isoCountryCode,
  };
  await initializeDatabase();
  return { place, mugs: missingMugsForPlace(place, await ownedMugIds()) };
}

export async function enableBackgroundAlerts(): Promise<
  'enabled' | 'foreground-only' | 'denied'
> {
  const notifications = await Notifications.requestPermissionsAsync();
  if (!notifications.granted) return 'denied';

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) return 'denied';

  const background = await Location.requestBackgroundPermissionsAsync();
  if (!background.granted) return 'foreground-only';

  if (!(await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK))) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 5000,
      deferredUpdatesDistance: 5000,
      deferredUpdatesInterval: 60 * 60 * 1000,
      pausesUpdatesAutomatically: true,
      activityType: Location.ActivityType.Other,
      showsBackgroundLocationIndicator: false,
    });
  }
  return 'enabled';
}

export async function disableBackgroundAlerts(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}

export async function backgroundAlertsEnabled(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
}

if (!TaskManager.isTaskDefined(LOCATION_TASK)) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
    LOCATION_TASK,
    async ({ data, error }) => {
    if (error) {
      console.error('Background location task failed:', error.message);
      return;
    }

    const latest = data?.locations.at(-1);
    if (!latest) return;

    try {
      const [address] = await Location.reverseGeocodeAsync(latest.coords);
      if (!address) return;
      await evaluatePlaceAndNotify({
        city: address.city,
        region: address.region,
        isoCountryCode: address.isoCountryCode,
      });
    } catch (taskError) {
      console.error('Could not evaluate nearby mugs:', taskError);
    }
    },
  );
}
