import { FeatureLinkCard } from '@/components/ui/FeatureLinkCard';
import { Screen } from '@/components/ui/Screen';

export default function MindScreen() {
  return (
    <Screen eyebrow="Check in with yourself">
      <FeatureLinkCard title="Mental threads" description="Name what’s taking up space and choose its next state." icon="git-branch-outline" href="/mental-threads" />
      <FeatureLinkCard title="Mental state" description="Check six signals and get grounded suggestions." icon="pulse-outline" href="/mental-state" />
      <FeatureLinkCard title="Meditation" description="Settle into a timed session that stays in sync." icon="leaf-outline" href="/meditation" />
    </Screen>
  );
}
