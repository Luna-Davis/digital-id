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
  /** Slightly smaller type — for dense faces (the back's 6-field address block). */
  compact?: boolean;
};

/**
 * A labelled data row. The label is a small tracked-out caption and the
 * value sits beneath it on the same baseline grid, so every field on the
 * card aligns to one shared rhythm.
 */
export function Field({ label, value, style, scale: s, compact }: FieldProps) {
  const k = compact ? 0.82 : 1;
  return (
    <View style={[styles.container, { marginBottom: s.fieldGap }, style]}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[
          styles.label,
          {
            fontSize: s.label * k,
            lineHeight: s.label * k * 1.18,
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
            fontSize: s.body * k,
            lineHeight: s.body * k * 1.12,
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
