import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { extractTextFromImage, isSupported } from 'expo-text-extractor';

import { Body, Button, colors, Loading, Screen } from '@/components/ui';
import { exactCatalogMatch, rankCatalogMatches } from '@/lib/catalog';
import { addCollectionItem, markAssetProcessed } from '@/lib/database';
import { persistImage, removeLocalImage } from '@/lib/files';
import { addImageToConnectedAlbum } from '@/lib/photos';
import { useApp } from '@/providers/app-provider';
import type { CatalogMug, PendingAsset } from '@/types';

export default function ReviewScreen() {
  const { queue } = useApp();
  const current = queue[0];

  if (!current) return <Redirect href="/(tabs)" />;
  return <ReviewAsset key={current.assetId ?? current.uri} current={current} queueLength={queue.length} />;
}

function ReviewAsset({
  current,
  queueLength,
}: {
  current: PendingAsset;
  queueLength: number;
}) {
  const { finishCurrentAsset, refreshCollection } = useApp();
  const [ocrText, setOcrText] = useState('');
  const [location, setLocation] = useState('');
  const [candidates, setCandidates] = useState<CatalogMug[]>([]);
  const [selected, setSelected] = useState<CatalogMug | null>(null);
  const [reading, setReading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        if (!isSupported) throw new Error('Text recognition is not available on this device.');
        const lines = await extractTextFromImage(current.uri);
        if (cancelled) return;
        const text = lines.join('\n');
        const matches = rankCatalogMatches(text);
        setOcrText(text);
        setCandidates(matches.slice(0, 5));
        if (matches[0]) {
          setSelected(matches[0]);
          setLocation(matches[0].displayName);
        }
      } catch (error) {
        if (!cancelled) {
          setRecognitionError(
            error instanceof Error ? error.message : 'Text recognition did not complete.',
          );
        }
      } finally {
        if (!cancelled) setReading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [current]);

  function updateLocation(value: string) {
    setLocation(value);
    setSelected(exactCatalogMatch(value) ?? null);
  }

  async function save() {
    if (!location.trim()) return;
    setSaving(true);
    let localUri: string | null = null;
    let recordSaved = false;
    try {
      localUri = await persistImage(current.uri);
      let sourceAssetId = current.assetId;
      let albumWarning: string | undefined;
      if (current.source === 'camera') {
        const albumSave = await addImageToConnectedAlbum(localUri);
        sourceAssetId = albumSave.assetId;
        albumWarning = albumSave.warning;
        if (sourceAssetId) await markAssetProcessed(sourceAssetId, 'saved');
      }
      await addCollectionItem({
        catalogMugId: selected?.id ?? null,
        confirmedLocation: location,
        photoUri: localUri,
        sourceAssetId,
        source: current.source,
        ocrText,
      });
      recordSaved = true;
      await finishCurrentAsset('saved');
      await refreshCollection();
      if (albumWarning) Alert.alert('Mug saved', albumWarning);
      if (queueLength <= 1) router.replace('/(tabs)');
    } catch (error) {
      if (localUri && !recordSaved) removeLocalImage(localUri);
      Alert.alert('Could not save mug', error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  async function ignore() {
    await finishCurrentAsset('ignored');
    if (queueLength <= 1) router.replace('/(tabs)');
  }

  if (reading || saving) {
    return (
      <Screen scroll={false}>
        <Loading label={saving ? 'Saving mug…' : 'Reading mug text…'} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Image contentFit="cover" source={current.uri} style={styles.photo} />
      {recognitionError ? <Text style={styles.warning}>{recognitionError}</Text> : null}
      <View style={styles.field}>
        <Text style={styles.label}>Location on this mug</Text>
        <TextInput
          accessibilityLabel="Location on this mug"
          autoCapitalize="words"
          onChangeText={updateLocation}
          placeholder="For example, Nashville"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={location}
        />
        <Body muted>
          {selected
            ? `Matched to ${selected.displayName} inventory.`
            : 'Enter or choose a location. Unmatched locations are still saved, but cannot suppress notifications yet.'}
        </Body>
      </View>
      {candidates.length > 1 ? (
        <View style={styles.candidates}>
          <Text style={styles.label}>Other matches</Text>
          <View style={styles.chips}>
            {candidates.map((candidate) => (
              <Pressable
                accessibilityRole="button"
                key={candidate.id}
                onPress={() => {
                  setSelected(candidate);
                  setLocation(candidate.displayName);
                }}
                style={[
                  styles.chip,
                  selected?.id === candidate.id && styles.selectedChip,
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    selected?.id === candidate.id && styles.selectedChipText,
                  ]}>
                  {candidate.displayName}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      <Button title="Save mug" disabled={!location.trim()} onPress={() => void save()} />
      <Button title="Skip this photo" variant="secondary" onPress={() => void ignore()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { aspectRatio: 4 / 3, backgroundColor: colors.border, borderRadius: 16, width: '100%' },
  warning: {
    backgroundColor: '#fff3cd',
    borderRadius: 10,
    color: '#6b5200',
    fontSize: 14,
    padding: 12,
  },
  field: { gap: 8 },
  label: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 18,
    padding: 14,
  },
  candidates: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  selectedChip: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { color: colors.ink, fontWeight: '600' },
  selectedChipText: { color: colors.white },
});
