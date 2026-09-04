import { FeatureLinkCard } from '@/components/ui/FeatureLinkCard';
import { Screen } from '@/components/ui/Screen';

export default function MoreScreen() {
  return (
    <Screen eyebrow="Your wider practice">
      <FeatureLinkCard title="Notes" description="Capture and revisit what matters." icon="document-text-outline" href="/notes" />
      <FeatureLinkCard title="Statistics" description="Log habits and spot personal patterns." icon="bar-chart-outline" href="/stats" />
      <FeatureLinkCard title="Settings" description="Adjust appearance, behavior, and your account." icon="settings-outline" href="/settings" />
    </Screen>
  );
}
