import { MeditationStats } from '@/components/meditation/MeditationStats';
import { Screen } from '@/components/ui/Screen';

export default function MeditationCalendarScreen() {
  return (
    <Screen title="Meditation calendar">
      <MeditationStats refreshKey={0} />
    </Screen>
  );
}
