import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

import { featureDescriptions } from '../../../../shared/featureDescriptions';
import { warmMentalPages } from '@/services/pageResources';
import { FeatureLinkCard } from '@/components/ui/FeatureLinkCard';
import { useAuth } from '@/providers/AuthProvider';
import { Screen } from '@/components/ui/Screen';

export default function MindScreen() {
  const { user } = useAuth();
  useFocusEffect(useCallback(() => { warmMentalPages(user?.id); }, [user?.id]));
  return (
    <Screen contentStyle={{ paddingTop: 12 }}>
      <FeatureLinkCard title="Mental threads" description={featureDescriptions.mentalThreads} icon="git-branch-outline" href="/mental-threads" />
      <FeatureLinkCard title="Mental state" description={featureDescriptions.mentalState} icon="pulse-outline" href="/mental-state" />
      <FeatureLinkCard title="Meditation" description={featureDescriptions.meditation} icon="leaf-outline" href="/meditation" />
    </Screen>
  );
}
