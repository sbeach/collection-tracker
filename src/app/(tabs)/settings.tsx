import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

import { Body, Button, colors, Heading, Loading, Screen } from '@/components/ui';
import {
  backgroundAlertsEnabled,
  disableBackgroundAlerts,
  enableBackgroundAlerts,
} from '@/lib/alerts';
import { getSetting } from '@/lib/database';
import {
  CONNECTED_ALBUM_KEY,
  connectAlbum,
  listPhotoAlbums,
} from '@/lib/photos';
import { useApp } from '@/providers/app-provider';

type AlbumChoice = { id: string; title: string };

export default function SettingsScreen() {
  const { refreshAlbum } = useApp();
  const [busy, setBusy] = useState(true);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [albumTitle, setAlbumTitle] = useState<string | null>(null);
  const [albums, setAlbums] = useState<AlbumChoice[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const enabled = await backgroundAlertsEnabled();
      const albumId = await getSetting(CONNECTED_ALBUM_KEY);
      let title: string | null = null;
      if (albumId) {
        try {
          title = await new MediaLibrary.Album(albumId).getTitle();
        } catch {
          title = 'Album unavailable';
        }
      }
      if (!cancelled) {
        setAlertsEnabled(enabled);
        setAlbumTitle(title);
        setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOnAlerts() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await enableBackgroundAlerts();
      setAlertsEnabled(result === 'enabled');
      if (result === 'enabled') {
        setStatus('Daily background reminders are on.');
      } else if (result === 'foreground-only') {
        setStatus('Always Location was not granted. Nearby checks still work while the app is open.');
      } else {
        setStatus('Notification or location permission was denied.');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not enable reminders.');
    } finally {
      setBusy(false);
    }
  }

  async function turnOffAlerts() {
    setBusy(true);
    try {
      await disableBackgroundAlerts();
      setAlertsEnabled(false);
      setStatus('Background reminders are off.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not disable reminders.');
    } finally {
      setBusy(false);
    }
  }

  async function showAlbums() {
    setBusy(true);
    try {
      const choices = await listPhotoAlbums();
      if (choices.length === 0) {
        Alert.alert('No albums available', 'Allow photo access or create an album in Photos first.');
      } else {
        setAlbums(choices);
      }
    } catch (error) {
      Alert.alert('Could not load albums', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function chooseAlbum(album: AlbumChoice) {
    setBusy(true);
    try {
      await connectAlbum(album.id);
      setAlbumTitle(album.title);
      setAlbums(null);
      const found = await refreshAlbum();
      setStatus(`${album.title} connected${found ? `; ${found} new photo(s) ready to review` : ''}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not connect album.');
    } finally {
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <Screen scroll={false}>
        <Loading label="Updating settings…" />
      </Screen>
    );
  }

  if (albums) {
    return (
      <Screen>
        <Heading>Choose an album</Heading>
        <View style={styles.list}>
          {albums.map((album) => (
            <Pressable
              accessibilityRole="button"
              key={album.id}
              onPress={() => void chooseAlbum(album)}
              style={styles.row}>
              <Text style={styles.rowTitle}>{album.title}</Text>
            </Pressable>
          ))}
        </View>
        <Button title="Cancel" variant="secondary" onPress={() => setAlbums(null)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Heading>Settings</Heading>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Photo album</Text>
        <Body muted>
          {albumTitle
            ? `Connected to “${albumTitle}”. New photos are checked when Mug Tracker opens.`
            : 'No album connected. Camera photos remain safely inside the app.'}
        </Body>
        <Button
          title={albumTitle ? 'Choose a different album' : 'Connect an album'}
          variant="secondary"
          onPress={() => void showAlbums()}
        />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nearby mug reminders</Text>
        <Body muted>
          At most once per missing mug each day. Background reminders require Always Location and
          stop if Mug Tracker is force-quit.
        </Body>
        <Button
          title={alertsEnabled ? 'Turn off background reminders' : 'Turn on background reminders'}
          variant={alertsEnabled ? 'secondary' : 'primary'}
          onPress={() => void (alertsEnabled ? turnOffAlerts() : turnOnAlerts())}
        />
        <Pressable accessibilityRole="link" onPress={() => void Linking.openSettings()}>
          <Text style={styles.link}>Open iOS permission settings</Text>
        </Pressable>
      </View>
      <Body muted>
        Mug Tracker is local-only. It does not upload photos, location, or collection data.
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: { backgroundColor: '#dcefe7', borderRadius: 10, color: colors.darkGreen, padding: 12 },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  link: { color: colors.green, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  list: { gap: 10 },
  row: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  rowTitle: { color: colors.ink, fontSize: 17, fontWeight: '600' },
});
