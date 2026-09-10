import { Redirect } from 'expo-router';

import { Loading, Screen } from '@/components/ui';
import { useApp } from '@/providers/app-provider';

export default function IndexScreen() {
  const { ready, onboardingComplete } = useApp();
  if (!ready) {
    return (
      <Screen scroll={false}>
        <Loading label="Opening Mug Tracker…" />
      </Screen>
    );
  }
  return <Redirect href={onboardingComplete ? '/(tabs)' : '/onboarding'} />;
}
