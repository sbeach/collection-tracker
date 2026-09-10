import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Button, colors, Heading, Loading, Screen } from '@/components/ui';
import { checkCurrentLocation } from '@/lib/alerts';
import type { CatalogMug, Place } from '@/types';

export default function NearbyScreen() {
  const [loading, setLoading] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [mugs, setMugs] = useState<CatalogMug[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function check() {
    setLoading(true);
    setMessage(null);
    try {
      const result = await checkCurrentLocation();
      setPlace(result.place);
      setMugs(result.mugs);
      if (!result.place) setMessage('Location access is needed to check nearby mugs.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not check your location.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Screen scroll={false}>
        <Loading label="Checking nearby inventory…" />
      </Screen>
    );
  }

  const placeName = [place?.city, place?.region].filter(Boolean).join(', ');

  return (
    <Screen>
      <Heading>What could be nearby?</Heading>
      <Body muted>
        This uses your city and state, not live store stock. Always check the store before making a
        special trip.
      </Body>
      <Button title="Check my current location" onPress={() => void check()} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {place ? (
        <View style={styles.results}>
          <Text style={styles.place}>{placeName || 'Current location'}</Text>
          {mugs.length === 0 ? (
            <Body>You already track every seeded mug for this area.</Body>
          ) : (
            mugs.map((mug) => (
              <View key={mug.id} style={styles.mug}>
                <Text style={styles.mugName}>{mug.displayName}</Text>
                <Text style={styles.unverified}>Availability not yet verified</Text>
              </View>
            ))
          )}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: { color: colors.danger, fontSize: 15 },
  results: { gap: 10 },
  place: { color: colors.ink, fontSize: 22, fontWeight: '700', marginBottom: 4 },
  mug: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 3,
    padding: 14,
  },
  mugName: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  unverified: { color: colors.muted, fontSize: 13 },
});
