import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { animateLayout } from '@/lib/motion';

export const COLLAPSE_DURATION_MS = 260;

/**
 * Shows or hides its content. The content stays mounted while hidden, so opening is instant even for a group
 * of many tasks, and it takes its real space in layout, so rows below are pushed down instead of overlapped.
 * Call `animateCollapse()` right before changing `expanded` to animate the change natively.
 */
export function Collapsible({ expanded, children }: PropsWithChildren<{ expanded: boolean }>) {
  return <View style={!expanded && styles.hidden}>{children}</View>;
}

/** Animates the next layout change (the group opening or closing and the rows below moving). */
export function animateCollapse() {
  animateLayout(COLLAPSE_DURATION_MS);
}

const styles = StyleSheet.create({
  hidden: { display: 'none' },
});
