import { Pressable, type PressableProps } from 'react-native';

/**
 * Keeps touch feedback visual and prevents Android's system click sound from
 * being mixed into the app's deliberate audio cues.
 */
export function SilentPressable(props: PressableProps) {
  return <Pressable {...props} android_disableSound />;
}
