// components/Settings/SettingsScreen.tsx
//
// Settings page: the project license, a disclaimer that the app was built with
// AI under strict human supervision, and the local/offline privacy statement.

import type { ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { COLOR } from '../IDCard/tokens';
import { APP_NAME, APP_VERSION, LICENSE_ID, LICENSE_TEXT } from '../../lib/appInfo';

type SettingsScreenProps = {
  onBack: () => void;
};

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.backPressed]}
          onPress={onBack}
          hitSlop={8}
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>SETTINGS</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* License */}
        <Section eyebrow="PROJECT LICENSE" title="GNU AFFERO GENERAL PUBLIC LICENSE">
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{LICENSE_ID}</Text>
            </View>
            <Text style={styles.badgeNote}>VERSION 3 · 19 NOVEMBER 2007</Text>
          </View>
          <View style={styles.licenseBox}>
            <Text style={styles.licenseText}>{LICENSE_TEXT.join('\n')}</Text>
          </View>
          <Text style={styles.footnote}>
            This app is free software: you may redistribute it and/or modify it under the
            terms of the GNU Affero General Public License. The full text is available in
            the project&apos;s LICENSE file.
          </Text>
        </Section>

        {/* AI disclaimer */}
        <Section eyebrow="DISCLAIMER" title="BUILT WITH AI, UNDER HUMAN SUPERVISION">
          <Text style={styles.body}>
            This application was developed with the assistance of artificial intelligence,
            under very strict human supervision. Every feature, line of code, configuration
            and security decision was reviewed, validated and approved by a human developer
            before release.
          </Text>
        </Section>

        {/* Local & privacy */}
        <Section eyebrow="PRIVACY" title="FULLY LOCAL · NO INTERNET">
          <Text style={styles.body}>
            Your data never leaves this device. This app has no servers, no accounts, no
            analytics and no cloud of any kind. Everything — your ID details, portrait and
            lock PIN — is encrypted and stored on your phone only.
          </Text>
          <View style={styles.bullets}>
            <Text style={styles.bullet}>•  100% on-device processing (OCR, encryption, storage)</Text>
            <Text style={styles.bullet}>•  No network calls made by the app itself</Text>
            <Text style={styles.bullet}>•  Production builds ship with no internet permission</Text>
            <Text style={styles.bullet}>•  The app works fully offline</Text>
          </View>
        </Section>

        <Text style={styles.version}>
          {APP_NAME} · VERSION {APP_VERSION}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLOR.black,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: {
    borderColor: COLOR.goldDim,
  },
  backText: {
    color: COLOR.gold,
    fontSize: 20,
    lineHeight: 22,
  },
  headerTitle: {
    flex: 1,
    color: COLOR.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    padding: 20,
    paddingBottom: 48,
  },
  section: {
    marginBottom: 28,
  },
  eyebrow: {
    color: COLOR.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 3,
  },
  title: {
    marginTop: 6,
    color: COLOR.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  badge: {
    borderWidth: 1,
    borderColor: COLOR.goldDim,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(214, 180, 92, 0.08)',
  },
  badgeText: {
    color: COLOR.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  badgeNote: {
    marginLeft: 10,
    color: COLOR.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  licenseBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: 12,
    backgroundColor: COLOR.surfaceRaised,
    padding: 14,
  },
  licenseText: {
    color: COLOR.textSecondary,
    fontSize: 11,
    lineHeight: 17,
  },
  footnote: {
    marginTop: 10,
    color: COLOR.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  body: {
    marginTop: 12,
    color: COLOR.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  bullets: {
    marginTop: 12,
  },
  bullet: {
    color: COLOR.textSecondary,
    fontSize: 12,
    lineHeight: 22,
  },
  version: {
    marginTop: 8,
    color: COLOR.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },
});
