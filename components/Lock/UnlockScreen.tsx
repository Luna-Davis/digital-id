// components/Lock/UnlockScreen.tsx
//
// Shown whenever the app is locked: biometric unlock first (when the device
// has enrolled fingerprints/face), PIN entry as the fallback. Failed PINs are
// counted and trigger a temporary lockout after MAX_ATTEMPTS.

import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as LocalAuthentication from 'expo-local-authentication';
import { COLOR } from '../IDCard/tokens';
import { PinPad, PinDots } from './PinPad';
import {
  verifyPin,
  clearFailedAttempts,
  recordFailedAttempt,
  getFailedAttempts,
  getLockoutUntil,
  PIN_LENGTH,
  MAX_ATTEMPTS,
} from '../../lib/lockStore';

const LOGO = require('../../assets/splash-icon.png');

type UnlockScreenProps = {
  onUnlock: () => void;
};

export function UnlockScreen({ onUnlock }: UnlockScreenProps) {
  const [entry, setEntry] = useState('');
  const [error, setError] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const busyRef = useRef(false);

  // Device biometric capability + restore an in-flight lockout across remounts.
  useEffect(() => {
    (async () => {
      try {
        const [hardware, enrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
        setBiometricAvailable(hardware && enrolled);
        setAttemptsLeft(MAX_ATTEMPTS - (await getFailedAttempts()));
        const until = await getLockoutUntil();
        if (until != null) {
          setLockedUntil(until);
          setNow(Date.now());
        }
      } catch {
        setBiometricAvailable(false);
      }
    })();
  }, []);

  // Auto-prompt biometrics a moment after the screen appears.
  useEffect(() => {
    if (!biometricAvailable) return;
    const t = setTimeout(() => {
      void tryBiometrics();
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricAvailable]);

  // Lockout countdown.
  useEffect(() => {
    if (lockedUntil == null) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [lockedUntil]);

  const locked = lockedUntil != null && now < lockedUntil;
  const lockRemaining = locked && lockedUntil != null ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;

  useEffect(() => {
    if (lockedUntil != null && now >= lockedUntil) {
      setLockedUntil(null);
      setAttemptsLeft(MAX_ATTEMPTS);
      setError('');
    }
  }, [now, lockedUntil]);

  const tryBiometrics = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setError('');
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Digital ID',
        cancelLabel: 'Use PIN instead',
        disableDeviceFallback: false,
      });
      if (res.success) onUnlock();
    } catch {
      // Fall through to PIN entry.
    } finally {
      busyRef.current = false;
    }
  };

  const handleDigit = async (d: string) => {
    if (locked || busyRef.current) return;
    setError('');
    const next = (entry + d).slice(0, PIN_LENGTH);
    setEntry(next);
    if (next.length !== PIN_LENGTH) return;

    busyRef.current = true;
    try {
      const ok = await verifyPin(next);
      if (ok) {
        await clearFailedAttempts();
        onUnlock();
        return;
      }
      setEntry('');
      const until = await recordFailedAttempt();
      if (until != null) {
        setLockedUntil(until);
        setNow(Date.now());
        setError('TOO MANY ATTEMPTS');
      } else {
        const left = MAX_ATTEMPTS - (await getFailedAttempts());
        setAttemptsLeft(left);
        setError(`WRONG PIN — ${left} ${left === 1 ? 'ATTEMPT' : 'ATTEMPTS'} LEFT`);
      }
    } finally {
      busyRef.current = false;
    }
  };

  const handleBackspace = () => setEntry((e) => e.slice(0, -1));

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      <Text style={styles.wordmark}>DIGITAL ID</Text>
      <Text style={styles.lockedLabel}>LOCKED</Text>

      {biometricAvailable ? (
        <Pressable style={({ pressed }) => [styles.bioButton, pressed && styles.bioPressed]} onPress={tryBiometrics}>
          <Text style={styles.bioText}>UNLOCK WITH BIOMETRICS</Text>
        </Pressable>
      ) : null}

      <Text style={styles.pinLabel}>{biometricAvailable ? 'OR ENTER PIN' : 'ENTER PIN'}</Text>

      <View style={styles.dotsWrap}>
        <PinDots filled={entry.length} error={!!error} />
      </View>

      {locked ? (
        <Text style={styles.error}>
          TOO MANY ATTEMPTS — TRY AGAIN IN {lockRemaining}S
        </Text>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <Text style={styles.errorSpace} />
      )}

      <PinPad onDigit={handleDigit} onBackspace={handleBackspace} disabled={locked} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLOR.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 96,
    height: 96,
  },
  wordmark: {
    marginTop: 12,
    color: COLOR.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 6,
  },
  lockedLabel: {
    marginTop: 8,
    color: COLOR.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 4,
  },
  bioButton: {
    marginTop: 26,
    borderWidth: 1,
    borderColor: COLOR.goldDim,
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 26,
    backgroundColor: 'rgba(214, 180, 92, 0.08)',
  },
  bioPressed: {
    backgroundColor: 'rgba(214, 180, 92, 0.16)',
  },
  bioText: {
    color: COLOR.gold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  pinLabel: {
    marginTop: 26,
    color: COLOR.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
  },
  dotsWrap: {
    marginTop: 16,
    marginBottom: 12,
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
