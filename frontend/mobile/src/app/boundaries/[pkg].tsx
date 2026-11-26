import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import { useBoundariesAccess } from '@/components/boundaries/BoundariesGate';
import { BoundariesLockCard } from '@/components/boundaries/BoundariesLock';
import { DelayEditor, type DelayDraft } from '@/components/boundaries/DelayEditor';
import { PasswordPrompt } from '@/components/boundaries/PasswordPrompt';
import { WindowEditor, type WindowDraft } from '@/components/boundaries/WindowEditor';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { Screen } from '@/components/ui/Screen';
import { installedApp } from '@/lib/boundaryAppsCache';
import {
  type AppRule, type AppUsage, type BlockMode, type TimeWindow,
  MAX_DELAY_SECONDS, emptyRule, formatTime, isLooser, isNoop, parseTime, summarizeUsage,
} from '@/lib/boundaryRules';
import { useAppTheme } from '@/providers/ThemeProvider';
import { Boundaries } from '@/services/boundaries';

const toDraft = (window: TimeWindow): WindowDraft => ({ days: [...window.days], start: formatTime(window.start), end: formatTime(window.end) });
const numberText = (value: number) => (value > 0 ? String(value) : '');

function parseWindows(drafts: WindowDraft[], what: string): TimeWindow[] | string {
  const windows: TimeWindow[] = [];
  for (const draft of drafts) {
    const start = parseTime(draft.start);
    const end = parseTime(draft.end);
    if (start === null || end === null) return `${what}: times look like 09:00 or 21:30.`;
    if (!draft.days.length) return `${what}: pick at least one day for each window.`;
    windows.push({ days: [...draft.days].sort(), start, end });
  }
  return windows;
}

function LimitRow({ label, hint, value, unit, onChange }: { label: string; hint: string; value: string; unit: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.limitRow}>
      <View style={styles.limitCopy}>
        <AppText variant="label">{label}</AppText>
        <AppText variant="caption" color="muted">{hint}</AppText>
      </View>
      <AppInput
        value={value}
        onChangeText={text => onChange(text.replace(/[^0-9]/g, ''))}
        placeholder="off"
        keyboardType="number-pad"
        maxLength={4}
        style={styles.limitInput}
      />
      <AppText variant="caption" color="muted" style={styles.unit}>{unit}</AppText>
    </View>
  );
}

export default function BoundaryRuleEditor() {
  const { colors } = useAppTheme();
  const { editable } = useBoundariesAccess();
  const { pkg } = useLocalSearchParams<{ pkg: string }>();
  const app = installedApp(pkg);
  const appName = app?.appName ?? pkg;

  const [loading, setLoading] = useState(true);
  const [allRules, setAllRules] = useState<AppRule[]>([]);
  const [original, setOriginal] = useState<AppRule | undefined>();
  const [usage, setUsage] = useState<AppUsage | undefined>();
  const [blockMode, setBlockMode] = useState<BlockMode>('off');
  const [blockWindows, setBlockWindows] = useState<WindowDraft[]>([]);
  const [daily, setDaily] = useState('');
  const [opens, setOpens] = useState('');
  const [perOpen, setPerOpen] = useState('');
  const [delay, setDelay] = useState<DelayDraft>({ seconds: '', autoOpen: true, message: '' });
  const [limitScope, setLimitScope] = useState<'always' | 'scheduled'>('always');
  const [limitWindows, setLimitWindows] = useState<WindowDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<{ rule: AppRule | null } | null>(null);

  useEffect(() => {
    void (async () => {
      if (!Boundaries) return;
      const [rulesJson, usageJson] = await Promise.all([Boundaries.getRules(), Boundaries.getUsageToday()]);
      const rules = JSON.parse(rulesJson) as AppRule[];
      const existing = rules.find(rule => rule.pkg === pkg);
      const rule = existing ?? emptyRule(pkg);
      setAllRules(rules);
      setOriginal(existing);
      setUsage((JSON.parse(usageJson) as Record<string, AppUsage>)[pkg]);
      setBlockMode(rule.blockMode);
      setBlockWindows(rule.blockWindows.map(toDraft));
      setDaily(numberText(rule.dailyLimitMin));
      setOpens(numberText(rule.maxOpens));
      setPerOpen(numberText(rule.sessionMin));
      setDelay({ seconds: numberText(rule.delaySeconds), autoOpen: rule.delayAutoOpen, message: rule.delayMessage });
      setLimitScope(rule.limitWindows.length ? 'scheduled' : 'always');
      setLimitWindows(rule.limitWindows.map(toDraft));
      setLoading(false);
    })().catch(cause => {
      console.error('Could not load the app rule:', cause);
      setError('Could not load this app\'s rule.');
    });
  }, [pkg]);

  const buildRule = (): AppRule | string => {
    const blocks = parseWindows(blockWindows, 'Block schedule');
    if (typeof blocks === 'string') return blocks;
    const limits = parseWindows(limitScope === 'scheduled' ? limitWindows : [], 'Limit schedule');
    if (typeof limits === 'string') return limits;
    if (blockMode === 'scheduled' && !blocks.length) return 'Add at least one time window for the block schedule.';
    const delaySeconds = Number(delay.seconds) || 0;
    if (delaySeconds > MAX_DELAY_SECONDS) return `Pause before opening: at most ${MAX_DELAY_SECONDS} seconds.`;
    if (limitScope === 'scheduled' && !limits.length && blockMode !== 'always' && (daily || opens || perOpen || delaySeconds)) {
      return 'Add at least one time window for when limits apply, or choose "All the time".';
    }
    return {
      pkg,
      blockMode,
      blockWindows: blockMode === 'scheduled' ? blocks : [],
      dailyLimitMin: Number(daily) || 0,
      maxOpens: Number(opens) || 0,
      sessionMin: Number(perOpen) || 0,
      delaySeconds,
      delayAutoOpen: delay.autoOpen,
      delayMessage: delay.message.trim(),
      limitWindows: limits,
    };
  };

  const persist = async (rule: AppRule | null) => {
    setSaving(true);
    try {
      const others = allRules.filter(other => other.pkg !== pkg);
      await Boundaries?.setRules(JSON.stringify(rule && !isNoop(rule) ? [...others, rule] : others));
      router.back();
    } finally {
      setSaving(false);
    }
  };

  // Loosening or removing a boundary needs the master password; adding or tightening is free.
  const attemptSave = (rule: AppRule | null) => {
    setError(null);
    const effective = rule && isNoop(rule) ? null : rule;
    if (isLooser(original, effective)) {
      setPending({ rule: effective });
      return;
    }
    void persist(effective);
  };

  const onSave = () => {
    const rule = buildRule();
    if (typeof rule === 'string') setError(rule);
    else attemptSave(rule);
  };

  const usageLine = original ? summarizeUsage(original, usage) : null;

  return (
    <Screen back action={editable ? <AppButton compact label="Save" loading={saving} disabled={loading} onPress={onSave} /> : undefined}>
      <View style={styles.appRow}>
        {app?.icon ? <Image source={{ uri: `data:image/png;base64,${app.icon}` }} style={styles.icon} /> : null}
        <View style={styles.appCopy}>
          <AppText variant="display" numberOfLines={1}>{appName}</AppText>
          <AppText variant="caption" color="muted">{pkg}</AppText>
          {usageLine ? <AppText variant="label" color="accent">{usageLine}</AppText> : null}
        </View>
      </View>

      {!editable && <BoundariesLockCard />}

      {error ? (
        <View style={[styles.error, { backgroundColor: `${colors.danger}18`, borderColor: `${colors.danger}55` }]}>
          <AppText color="danger">{error}</AppText>
        </View>
      ) : null}

      {loading ? <ActivityIndicator color={colors.accent} style={styles.loading} /> : (
        // Locked, the rule can be read but not touched.
        <View pointerEvents={editable ? 'auto' : 'none'} style={styles.form}>
          <Card style={styles.section}>
            <AppText variant="heading">Block completely</AppText>
            <ChoiceChips<BlockMode>
              value={blockMode}
              onChange={setBlockMode}
              fillSelected
              options={[
                { value: 'off', label: 'Off' },
                { value: 'always', label: 'Always' },
                { value: 'scheduled', label: 'On a schedule' },
              ]}
            />
            {blockMode === 'scheduled' && <WindowEditor windows={blockWindows} onChange={setBlockWindows} />}
          </Card>

          {blockMode !== 'always' && (
            <>
              <Card style={styles.section}>
                <AppText variant="heading">Limits</AppText>
                <AppText variant="caption" color="muted">Leave blank for no limit.</AppText>
                <LimitRow label="Daily time limit" hint="Total minutes a day. Closed when used up." value={daily} unit="min" onChange={setDaily} />
                <LimitRow label="Opens per day" hint="Further opens are blocked once used up." value={opens} unit="opens" onChange={setOpens} />
                <LimitRow label="Time per open" hint="Each open lasts this long, then the app is closed." value={perOpen} unit="min" onChange={setPerOpen} />
                <AppText variant="caption" color="muted">
                  An open unlocks the app. Leave and come back as often as you like: it stays unlocked until the screen
                  locks or the time for that open runs out. Counts reset at midnight.
                </AppText>
              </Card>

              <Card style={styles.section}>
                <AppText variant="heading">Pause before opening</AppText>
                <AppText variant="caption" color="muted">
                  A countdown covers {appName} before each unlock. Leaving it starts the countdown again.
                </AppText>
                <DelayEditor appName={appName} draft={delay} onChange={setDelay} />
              </Card>

              <Card style={styles.section}>
                <AppText variant="heading">When limits and the pause apply</AppText>
                <ChoiceChips<'always' | 'scheduled'>
                  value={limitScope}
                  onChange={setLimitScope}
                  fillSelected
                  options={[
                    { value: 'always', label: 'All the time' },
                    { value: 'scheduled', label: 'Only at certain times' },
                  ]}
                />
                {limitScope === 'scheduled' && <WindowEditor windows={limitWindows} onChange={setLimitWindows} />}
              </Card>
            </>
          )}

          {original && (
            <AppButton variant="danger" label="Remove every boundary for this app" onPress={() => attemptSave(null)} />
          )}
        </View>
      )}

      <PasswordPrompt
        visible={pending !== null}
        title="Confirm with the master password"
        message="This loosens a boundary you set earlier, so it needs the master password."
        placeholder="Master password"
        submitLabel="Save"
        incorrectMessage="Incorrect master password"
        onCancel={() => setPending(null)}
        verify={async password => Boolean(await Boundaries?.verifyMasterPassword(password))}
        onConfirmed={async () => {
          const rule = pending ? pending.rule : null;
          setPending(null);
          await persist(rule);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  appRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 52, height: 52, borderRadius: 14 },
  appCopy: { flex: 1, gap: 2 },
  error: { borderRadius: 14, borderWidth: 1, padding: 12 },
  loading: { marginTop: 40 },
  form: { gap: 16 },
  section: { gap: 12 },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  limitCopy: { flex: 1, gap: 2 },
  limitInput: { width: 72, minHeight: 42, paddingVertical: 8, textAlign: 'center' },
  unit: { width: 40 },
});
