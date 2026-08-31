import { Alert, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';

import { Body, Button, colors, Heading, Screen } from '@/components/ui';
import { removeCollectionItem } from '@/lib/database';
import { removeLocalImage } from '@/lib/files';
import { useApp } from '@/providers/app-provider';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { collection, refreshCollection } = useApp();
  const item = collection.find((candidate) => candidate.id === Number(id));

  if (!item) {
    return (
      <Screen>
        <Heading>Mug not found</Heading>
        <Button title="Back to collection" onPress={() => router.replace('/(tabs)')} />
      </Screen>
    );
  }
  const itemId = item.id;
  const itemLocation = item.confirmedLocation;

  function confirmRemoval() {
    Alert.alert(
      `Remove ${itemLocation}?`,
      'This removes the collection record but never deletes the original from Photos.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const uri = await removeCollectionItem(itemId);
              if (uri) removeLocalImage(uri);
              await refreshCollection();
              router.replace('/(tabs)');
            })();
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <Image contentFit="cover" source={item.photoUri} style={styles.photo} />
      <Heading>{item.confirmedLocation}</Heading>
      <View style={styles.details}>
        <Text style={styles.label}>Catalog match</Text>
        <Body>{item.mugName ?? 'No inventory match'}</Body>
        <Text style={styles.label}>Added</Text>
        <Body>{new Date(item.createdAt.replace(' ', 'T') + 'Z').toLocaleString()}</Body>
      </View>
      <Button title="Remove from collection" variant="danger" onPress={confirmRemoval} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { aspectRatio: 1, backgroundColor: colors.border, borderRadius: 18, width: '100%' },
  details: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
    padding: 16,
  },
  label: { color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 5 },
});
