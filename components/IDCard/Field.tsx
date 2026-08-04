// components/IDCard/Field.tsx
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import type { CardScale } from './tokens';
import { COLOR } from './tokens';

type FieldProps = {
  label: string;
  value: string;
  style?: ViewStyle;
  /** The scaled measurement set for the current card width. */
  scale: CardScale;
};

/**
 * A labelled data row. The label is a small tracked-out caption and the
 * value sits beneath it on the same baseline grid, so every field on the
 * card aligns to one shared rhythm.
 */
export function Field({ label, value, style, scale: s }: FieldProps) {
  return (
    <View style={[styles.container, { marginBottom: s.fieldGap }, style]}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[
          styles.label,
          {
            fontSize: s.label,
            lineHeight: s.label * 1.18,
            letterSpacing: s.label * 0.14,
          },
        ]}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={[
          styles.value,
          {
            fontSize: s.body,
            lineHeight: s.body * 1.12,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    color: COLOR.textSecondary,
    fontWeight: '700',
  },
  value: {
    color: COLOR.text,
    fontWeight: '500',
  },
});
