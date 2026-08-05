// components/Lock/PinPad.tsx
//
// Shared numeric keypad + dot indicator for the PIN setup and unlock screens.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLOR } from '../IDCard/tokens';

type PinPadProps = {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
};

const KEYS: (string | null)[] = [
  '1', '2', '3',
  '4', '5', '6',
  '7', '8', '9',
  null, '0', 'BACK',
];

export function PinPad({ onDigit, onBackspace, disabled }: PinPadProps) {
  return (
    <View style={styles.pad}>
      {KEYS.map((k, i) => {
        if (k == null) return <View key={i} style={styles.key} />;
        if (k === 'BACK') {
          return (
            <Pressable
              key={i}
              style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
              onPress={onBackspace}
              disabled={disabled}
              hitSlop={6}
            >
              <Text style={[styles.keyText, styles.backText]}>⌫</Text>
            </Pressable>
          );
        }
        return (
          <Pressable
            key={i}
            style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
            onPress={() => onDigit(k)}
            disabled={disabled}
            hitSlop={6}
          >
            <Text style={styles.keyText}>{k}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PinDots({ filled, error }: { filled: number; error: boolean }) {
  return (
    <View style={styles.dots}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i < filled && { backgroundColor: error ? '#E57373' : COLOR.gold, borderColor: error ? '#E57373' : COLOR.gold },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 264,
  },
  key: {
    width: 76,
    height: 64,
    margin: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: {
    borderColor: COLOR.goldDim,
    backgroundColor: COLOR.surface,
  },
  keyText: {
    color: COLOR.text,
    fontSize: 26,
    fontWeight: '600',
  },
  backText: {
    color: COLOR.gold,
    fontSize: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: {
    width: 16,
    height: 16,
    marginHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLOR.border,
  },
});
