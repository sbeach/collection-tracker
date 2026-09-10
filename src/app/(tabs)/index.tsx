import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';

import { Body, Button, colors, Screen } from '@/components/ui';
import { useApp } from '@/providers/app-provider';

export default function CollectionScreen() {
  const { collection, queue, error, clearError } = useApp();

  return (
    <Screen scroll={false}>
      {error ? (
        <Pressable accessibilityRole="button" onPress={clearError} style={styles.error}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.dismiss}>Tap to dismiss</Text>
        </Pressable>
      ) : null}
      {queue.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/review')}
          style={styles.reviewBanner}>
          <Text style={styles.reviewTitle}>
            Review {queue.length} new {queue.length === 1 ? 'photo' : 'photos'}
          </Text>
          <Text style={styles.reviewBody}>Confirm the locations found on your mugs.</Text>
        </Pressable>
      ) : null}
      {collection.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>☕</Text>
          <Text style={styles.emptyTitle}>Your shelf is empty</Text>
          <Body muted>Take a mug photo or import one from your library to get started.</Body>
        </View>
      ) : (
        <FlatList
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          data={collection}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          renderItem={({ item }) => (
            <Pressable
              accessibilityLabel={`${item.confirmedLocation} mug`}
              accessibilityRole="button"
              onPress={() => router.push(`/item/${item.id}`)}
              style={styles.mug}>
              <Image contentFit="cover" source={item.photoUri} style={styles.photo} />
              <Text numberOfLines={1} style={styles.mugName}>
                {item.confirmedLocation}
              </Text>
            </Pressable>
          )}
        />
      )}
      <Button title="Add a mug" onPress={() => router.push('/add')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { backgroundColor: '#fbe9e7', borderRadius: 12, padding: 12 },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  dismiss: { color: colors.muted, fontSize: 12, marginTop: 3 },
  reviewBanner: { backgroundColor: '#dcefe7', borderRadius: 14, gap: 3, padding: 14 },
  reviewTitle: { color: colors.darkGreen, fontSize: 17, fontWeight: '700' },
  reviewBody: { color: colors.darkGreen, fontSize: 14 },
  empty: { alignItems: 'center', flex: 1, gap: 10, justifyContent: 'center', padding: 24 },
  emptyIcon: { fontSize: 54 },
  emptyTitle: { color: colors.ink, fontSize: 23, fontWeight: '700' },
  grid: { gap: 12, paddingBottom: 16 },
  row: { gap: 12 },
  mug: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    overflow: 'hidden',
  },
  photo: { aspectRatio: 1, backgroundColor: colors.border, width: '100%' },
  mugName: { color: colors.ink, fontSize: 15, fontWeight: '600', padding: 10 },
});
