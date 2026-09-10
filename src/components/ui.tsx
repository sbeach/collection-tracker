import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export const colors = {
  green: '#006241',
  darkGreen: '#003d29',
  cream: '#f7f4ef',
  white: '#ffffff',
  ink: '#17231e',
  muted: '#5f6f67',
  border: '#d8e0dc',
  danger: '#a32820',
};

export function Screen({
  children,
  scroll = true,
}: PropsWithChildren<{ scroll?: boolean }>) {
  const content = <View style={styles.content}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

export function Button({
  title,
  onPress,
  disabled = false,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondaryButton,
        variant === 'danger' && styles.dangerButton,
        (pressed || disabled) && styles.buttonDimmed,
      ]}>
      <Text style={[styles.buttonText, variant === 'secondary' && styles.secondaryButtonText]}>
        {title}
      </Text>
    </Pressable>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function Body({ children, muted = false }: PropsWithChildren<{ muted?: boolean }>) {
  return <Text style={[styles.body, muted && styles.muted]}>{children}</Text>;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.green} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  scroll: { flexGrow: 1 },
  content: { flex: 1, padding: 20, gap: 16 },
  heading: { color: colors.ink, fontSize: 30, fontWeight: '800', lineHeight: 36 },
  body: { color: colors.ink, fontSize: 17, lineHeight: 25 },
  muted: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  button: {
    alignItems: 'center',
    backgroundColor: colors.green,
    borderRadius: 14,
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  secondaryButton: {
    backgroundColor: colors.white,
    borderColor: colors.green,
    borderWidth: 1,
  },
  dangerButton: { backgroundColor: colors.danger },
  buttonDimmed: { opacity: 0.55 },
  buttonText: { color: colors.white, fontSize: 17, fontWeight: '700' },
  secondaryButtonText: { color: colors.green },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
});
