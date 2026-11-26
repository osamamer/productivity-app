import { featureDescriptions } from '../../../../shared/featureDescriptions';
import { FeatureLinkCard } from '@/components/ui/FeatureLinkCard';
import { Screen } from '@/components/ui/Screen';
import { Boundaries } from '@/services/boundaries';

export default function MoreScreen() {
  return (
    <Screen contentStyle={{ paddingTop: 12 }}>
      <FeatureLinkCard title="Notes" description="Capture and revisit what matters." icon="document-text-outline" href="/notes" />
      <FeatureLinkCard title="Statistics" description="Log habits and spot personal patterns." icon="bar-chart-outline" href="/stats" />
      {Boundaries && (
        <FeatureLinkCard title="Boundaries" description={featureDescriptions.boundaries} icon="hourglass-outline" href="/boundaries" />
      )}
      <FeatureLinkCard title="Settings" description="Adjust appearance, behavior, and your account." icon="settings-outline" href="/settings" />
    </Screen>
  );
}
