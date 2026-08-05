// components/Lock/PinSetupScreen.tsx
//
// First-time setup: the user creates a 4-digit PIN (enter + confirm) that the
// app will ask for whenever it locks. The PIN is hashed before storage.

import { useState } from 'react';
import { View, Text, StyleSheet, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { COLOR } from '../IDCard/tokens';
import { PinPad, PinDots } from './PinPad';
import { setPin, PIN_LENGTH } from '../../lib/lockStore';

type PinSetupScreenProps = {
  onDone: () => void;
};

export function PinSetupScreen({ onDone }: PinSetupScreenProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [first, setFirst] = useState('');
  const [entry, setEntry] = useState('');
  const [error, setError] = useState('');

  const handleDigit = (d: string) => {
    setError('');
    const next = (entry + d).slice(0, PIN_LENGTH);
    setEntry(next);
    if (next.length !== PIN_LENGTH) return;

    if (step === 1) {
      // Move to confirmation.
      setFirst(next);
      setEntry('');
      setStep(2);
    } else if (next === first) {
      // Match — persist and continue.
      setPin(next)
        .then(onDone)
        .catch(() => setError('COULD NOT SAVE PIN'));
    } else {
      setError('PINS DO NOT MATCH — START OVER');
      setFirst('');
      setEntry('');
      setStep(1);
    }
  };

  const handleBackspace = () => setEntry((e) => e.slice(0, -1));

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Text style={styles.eyebrow}>{step === 1 ? 'CREATE A PIN' : 'CONFIRM YOUR PIN'}</Text>
      <Text style={styles.title}>{step === 1 ? 'SET A LOCK PIN' : 'ENTER IT AGAIN'}</Text>
      <Text style={styles.subtitle}>
        {step === 1
          ? 'Your card stays locked until you unlock it with this PIN.'
          : 'Confirm the PIN you just chose.'}
      </Text>

      <View style={styles.dotsWrap}>
        <PinDots filled={entry.length} error={!!error} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : <View style={styles.errorSpace} />}

      <PinPad onDigit={handleDigit} onBackspace={handleBackspace} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLOR.black,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: RNStatusBar.currentHeight ?? 0,
  },
  eyebrow: {
    color: COLOR.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 4,
  },
  title: {
    marginTop: 10,
    color: COLOR.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1,
  },
  subtitle: {
    marginTop: 8,
    color: COLOR.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 280,
  },
  dotsWrap: {
    marginTop: 36,
    marginBottom: 14,
  },
  error: {
    height: 34,
    color: '#E57373',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  errorSpace: {
    height: 34,
  },
});
