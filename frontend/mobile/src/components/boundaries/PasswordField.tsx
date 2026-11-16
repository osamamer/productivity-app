import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppInput } from '@/components/ui/AppInput';
import { SilentPressable } from '@/components/ui/SilentPressable';
import { useAppTheme } from '@/providers/ThemeProvider';

type Props = Omit<ComponentProps<typeof AppInput>, 'secureTextEntry'>;

/** A password input with a show/hide toggle. */
export function PasswordField(props: Props) {
  const { colors } = useAppTheme();
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <AppInput
        {...props}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoComplete="off"
        textContentType="password"
        style={[styles.input, props.style]}
      />
      <SilentPressable
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        hitSlop={8}
        onPress={() => setVisible(current => !current)}
        style={styles.toggle}>
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
      </SilentPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { paddingRight: 48 },
  toggle: { position: 'absolute', right: 14, bottom: 14 },
});
