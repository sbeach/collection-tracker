import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

import { Body, Button, Heading, Loading, Screen } from '@/components/ui';
import { canonicalPhotoAssetId } from '@/lib/photos';
import { useApp } from '@/providers/app-provider';

export default function AddMugScreen() {
  const { enqueue } = useApp();
  const [busy, setBusy] = useState(false);

  async function takePhoto() {
    setBusy(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera access needed', 'Enable camera access in iOS Settings to take a mug photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 1 });
      if (result.canceled) return;
      enqueue([{ uri: result.assets[0].uri, source: 'camera' }]);
      router.replace('/review');
    } catch (error) {
      Alert.alert('Could not take photo', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function choosePhoto() {
    setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 1,
      });
      if (result.canceled) return;
      enqueue(
        result.assets.map((asset) => ({
          uri: asset.uri,
          assetId: asset.assetId ? canonicalPhotoAssetId(asset.assetId) : undefined,
          source: 'photo_import',
        })),
      );
      router.replace('/review');
    } catch (error) {
      Alert.alert('Could not choose photo', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <Screen scroll={false}>
        <Loading label="Opening photos…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Heading>Add to your collection</Heading>
      <Body muted>
        Photograph the location name clearly. Mug Tracker will read it on-device, then ask you to
        confirm before saving.
      </Body>
      <Button title="Take a photo" onPress={() => void takePhoto()} />
      <Button title="Choose from Photos" variant="secondary" onPress={() => void choosePhoto()} />
    </Screen>
  );
}
