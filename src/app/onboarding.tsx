import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

import { Body, Button, colors, Heading, Loading, Screen } from '@/components/ui';
import {
  connectAlbum,
  canonicalPhotoAssetId,
  createMugTrackerAlbum,
  listPhotoAlbums,
} from '@/lib/photos';
import { useApp } from '@/providers/app-provider';

type AlbumChoice = { id: string; title: string };

function askToCreateAlbum(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Create a Mug Tracker album?',
      'The selected photos will remain in your library and also appear in a dedicated album. New photos added there can be found when Mug Tracker opens.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Create album', onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });
}

export default function OnboardingScreen() {
  const { enqueue, finishOnboarding } = useApp();
  const [albums, setAlbums] = useState<AlbumChoice[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function finish() {
    await finishOnboarding();
    router.replace('/(tabs)');
  }

  async function importPhotos() {
    setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 1,
      });
      if (result.canceled) return;

      const assetIds = result.assets
        .map((asset) => asset.assetId)
        .filter((id): id is string => Boolean(id));
      if (assetIds.length > 0 && (await askToCreateAlbum())) {
        await createMugTrackerAlbum(assetIds);
      }
      enqueue(
        result.assets.map((asset) => ({
          uri: asset.uri,
          assetId: asset.assetId ? canonicalPhotoAssetId(asset.assetId) : undefined,
          source: 'photo_import',
        })),
      );
      await finish();
    } catch (error) {
      Alert.alert('Could not import photos', error instanceof Error ? error.message : String(error));
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
      await finish();
    } catch (error) {
      Alert.alert('Could not connect album', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <Screen scroll={false}>
        <Loading label="Preparing your collection…" />
      </Screen>
    );
  }

  if (albums) {
    return (
      <Screen>
        <Heading>Choose an album</Heading>
        <Body muted>Mug Tracker will rescan this album when the app opens.</Body>
        <View style={styles.albumList}>
          {albums.map((album) => (
            <Pressable
              accessibilityRole="button"
              key={album.id}
              onPress={() => void chooseAlbum(album)}
              style={styles.album}>
              <Text style={styles.albumTitle}>{album.title}</Text>
            </Pressable>
          ))}
        </View>
        <Button title="Back" variant="secondary" onPress={() => setAlbums(null)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>WELCOME TO</Text>
        <Heading>Mug Tracker</Heading>
        <Body>
          Build a visual record of your mug collection and get reminders when a missing location
          mug may be nearby.
        </Body>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Start with your photos</Text>
        <Body muted>
          Choose existing mug photos, or connect an album that Mug Tracker can rescan when it opens.
          Recognition happens on this device.
        </Body>
        <Button title="Choose mug photos" onPress={() => void importPhotos()} />
        <Button title="Connect an existing album" variant="secondary" onPress={() => void showAlbums()} />
      </View>
      <Button title="Start with an empty collection" variant="secondary" onPress={() => void finish()} />
      <Text style={styles.privacy}>
        You can skip photo access. Camera photos still work and remain inside the app unless you
        later connect an album.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 12, paddingTop: 28 },
  eyebrow: { color: colors.green, fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  cardTitle: { color: colors.ink, fontSize: 21, fontWeight: '700' },
  privacy: { color: colors.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  albumList: { gap: 10 },
  album: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  albumTitle: { color: colors.ink, fontSize: 17, fontWeight: '600' },
});
