import React, { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import { radius, sizes, useTheme } from '../../theme';

export interface ZpotTextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  hint?: string;
  secureToggle?: boolean;
  testID?: string;
}

export const ZpotTextField = forwardRef<React.ComponentRef<typeof TextInput>, ZpotTextFieldProps>(function ZpotTextField(
  { label, error, hint, secureToggle, testID, multiline, ...rest }, ref) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]} nativeID={`${testID}-label`}>{label}</Text>
      <View style={[styles.box, multiline && styles.multi, {
        borderColor: error ? colors.danger : focused ? colors.text : colors.borderStrong, backgroundColor: colors.surface,
      }]}>
        <TextInput
          ref={ref}
          testID={testID}
          accessibilityLabel={label}
          placeholderTextColor={colors.textSubtle}
          style={[styles.input, { color: colors.text }, multiline && styles.inputMulti]}
          secureTextEntry={secureToggle ? hidden : rest.secureTextEntry}
          multiline={multiline}
          onFocus={e => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={e => { setFocused(false); rest.onBlur?.(e); }}
          {...rest}
        />
        {secureToggle ? (
          <Pressable onPress={() => setHidden(h => !h)} accessibilityRole="button" hitSlop={8}
            accessibilityLabel={hidden ? t('auth.show') : t('auth.hide')} testID={testID ? `${testID}-toggle` : undefined}>
            <Text style={[styles.toggle, { color: colors.text }]}>{hidden ? t('auth.show') : t('auth.hide')}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={[styles.err, { color: colors.danger }]} accessibilityLiveRegion="polite">{error}</Text>
        : hint ? <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600' },
  box: { minHeight: sizes.input, borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  multi: { minHeight: 96, alignItems: 'flex-start', paddingVertical: 10 },
  input: { flex: 1, fontSize: 16, paddingVertical: 10 },
  inputMulti: { textAlignVertical: 'top', minHeight: 76 },
  toggle: { fontSize: 13, fontWeight: '600', textDecorationLine: 'underline', paddingLeft: 8 },
  err: { fontSize: 13, fontWeight: '600' },
  hint: { fontSize: 13 },
});
