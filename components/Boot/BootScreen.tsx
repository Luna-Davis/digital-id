// components/Boot/BootScreen.tsx
//
// Branding screen shown on launch. The palette mirrors the app-logo SVG so the
// icon (whose background is the same #181C14) blends seamlessly into the
// screen: bg #181C14 · card #3C3D37 · accent #697565 · mark #ECDFCC.

import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Full-bleed 1024px render of the logo (dark background included).
const LOGO = require('../../assets/splash-icon.png');

export function BootScreen() {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(12)).current;
  const tagFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(160, [
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(rise, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
      ]),
      Animated.timing(tagFade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [fade, rise, tagFade]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Animated.View
        style={[styles.logoWrap, { opacity: fade, transform: [{ translateY: rise }] }]}
      >
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      </Animated.View>

      <Animated.View style={[styles.brandRow, { opacity: fade }]}>
        <Text style={styles.wordmark}>DIGITAL ID</Text>
        <View style={styles.betaBadge}>
          <Text style={styles.betaText}>BETA</Text>
        </View>
      </Animated.View>

      <Animated.Text style={[styles.tagline, { opacity: tagFade }]}>
        YOUR IDENTITY · VERIFIED · ENCRYPTED
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#181C14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: '42%',
    aspectRatio: 1,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  wordmark: {
    color: '#ECDFCC',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 8,
  },
  betaBadge: {
    marginLeft: 12,
    borderWidth: 1,
    borderColor: '#D6B45C',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  betaText: {
    color: '#D6B45C',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  tagline: {
    marginTop: 12,
    color: '#697565',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
  },
});
