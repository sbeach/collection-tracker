import { Directory, File, Paths } from 'expo-file-system';

const mugDirectory = new Directory(Paths.document, 'mugs');

export async function persistImage(sourceUri: string): Promise<string> {
  if (!mugDirectory.exists) {
    mugDirectory.create({ idempotent: true, intermediates: true });
  }

  const source = new File(sourceUri);
  const extension = source.extension || '.jpg';
  const destination = new File(
    mugDirectory,
    `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`,
  );
  await source.copy(destination);
  return destination.uri;
}

export function removeLocalImage(uri: string): void {
  const file = new File(uri);
  if (file.exists && file.parentDirectory.uri === mugDirectory.uri) {
    file.delete();
  }
}
