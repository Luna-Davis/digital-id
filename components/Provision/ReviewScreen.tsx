// components/Provision/ReviewScreen.tsx
//
// Step 2 of provisioning. The confirmation form: every extracted field is
// shown with a status badge so the user can see at a glance what the scan
// got right (✓ EXTRACTED), what they corrected (✎ EDITED), and what still
// needs input (⚠ MISSING). Everything is editable before the one-time lock.

import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
} from 'react-native';
import {
  EMPTY_CREDENTIAL,
  missingFields,
  OPTIONAL_FIELDS,
  type CredentialData,
  type CropRect,
} from '../../lib/credentialTypes';
import type { ExtractionResult } from '../../lib/extraction';
import { CropImage } from '../IDCard/CropImage';
import { COLOR } from '../IDCard/tokens';

type ReviewScreenProps = {
  result: ExtractionResult;
  portraitUri?: string;
  crop?: CropRect;
  onBack: () => void;
  onLock: (data: CredentialData, photoUri?: string, crop?: CropRect) => Promise<void>;
};

const FRONT_FIELDS: { key: keyof CredentialData; label: string }[] = [
  { key: 'surname', label: 'SURNAME' },
  { key: 'givenName', label: 'GIVEN NAME' },
  { key: 'sex', label: 'SEX' },
  { key: 'nationality', label: 'NATIONALITY' },
  { key: 'dateOfBirth', label: 'DATE OF BIRTH' },
  { key: 'placeOfBirth', label: 'PLACE OF BIRTH' },
  { key: 'idNumber', label: 'ID NUMBER' },
  { key: 'placeOfIssue', label: 'PLACE OF ISSUE' },
  { key: 'dateOfExpiry', label: 'DATE OF EXPIRY' },
];

const BACK_FIELDS: { key: keyof CredentialData; label: string }[] = [
  { key: 'county', label: 'COUNTY' },
  { key: 'subCounty', label: 'SUB-COUNTY' },
  { key: 'division', label: 'DIVISION' },
  { key: 'location', label: 'LOCATION' },
  { key: 'subLocation', label: 'SUB-LOCATION' },
  { key: 'dateOfIssue', label: 'DATE OF ISSUE' },
];

const MACHINE_FIELDS: { key: keyof CredentialData; label: string; multiline?: boolean }[] =
  OPTIONAL_FIELDS.map((key) => ({
    key,
    label: key === 'mrz' ? 'MRZ — MACHINE-READABLE ZONE' : 'SERIAL NUMBER',
    multiline: key === 'mrz',
  }));

export function ReviewScreen({ result, portraitUri, crop, onBack, onLock }: ReviewScreenProps) {
  const [fields, setFields] = useState<CredentialData>({ ...EMPTY_CREDENTIAL, ...result.data });
  const [edited, setEdited] = useState<Set<keyof CredentialData>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  const extractedKeys = useMemo(() => new Set(result.extracted), [result.extracted]);

  const setField = (key: keyof CredentialData, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    setEdited((prev) => new Set(prev).add(key));
  };

  const handleLock = async () => {
    const missing = missingFields(fields);
    if (missing.length > 0) {
      setError(`Complete these fields first: ${missing.join(', ')}`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onLock(fields, portraitUri, crop);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not lock the credential.');
      setBusy(false);
    }
  };

  const statusOf = (key: keyof CredentialData) => {
    const value = fields[key];
    if (!value.trim()) return { tag: 'MISSING', color: '#E57373' };
    if (edited.has(key)) return { tag: 'EDITED', color: COLOR.gold };
    if (extractedKeys.has(key)) return { tag: 'EXTRACTED', color: COLOR.green };
    return { tag: 'MANUAL', color: '#7FB3D8' };
  };

  const renderFields = (list: { key: keyof CredentialData; label: string; multiline?: boolean }[]) =>
    list.map(({ key, label, multiline }) => {
      const status = statusOf(key);
      return (
        <View key={key} style={styles.fieldRow}>
          <View style={styles.fieldHead}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <Text style={[styles.badge, { color: status.color }]}>{status.tag}</Text>
          </View>
          <TextInput
            value={fields[key]}
            onChangeText={(text) => setField(key, text)}
            style={[styles.input, multiline && styles.inputMultiline]}
            placeholderTextColor={COLOR.textMuted}
            placeholder="—"
            autoCapitalize="characters"
            multiline={multiline}
            numberOfLines={multiline ? 3 : 1}
          />
        </View>
      );
    });

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>CONFIRM YOUR DETAILS</Text>
      <Text style={styles.subtitle}>
        ✓ extracted from your card · ✎ corrected by you · ⚠ needs input. Fix anything that
        was misread, then lock. One-time only — data cannot change after locking.
      </Text>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {portraitUri ? (
          <View style={styles.photoWrap}>
            {crop ? (
              <View style={styles.photo}>
                <CropImage uri={portraitUri} crop={crop} frameWidth={96} frameHeight={128} />
              </View>
            ) : (
              <View style={styles.photo}>
                <CropImageFallback uri={portraitUri} />
              </View>
            )}
            <Text style={styles.photoTag}>PORTRAIT</Text>
          </View>
        ) : null}

        <Text style={styles.section}>FRONT OF CARD</Text>
        {renderFields(FRONT_FIELDS)}

        <Text style={styles.section}>BACK OF CARD</Text>
        {renderFields(BACK_FIELDS)}

        <Text style={styles.section}>MACHINE TEXT</Text>
        <Text style={styles.sectionHint}>
          The serial down the left edge and the long string at the bottom of the card.
        </Text>
        {renderFields(MACHINE_FIELDS)}

        {result.rawText ? (
          <Pressable onPress={() => setShowRaw((v) => !v)}>
            <Text style={styles.rawToggle}>{showRaw ? 'HIDE' : 'SHOW'} RAW SCAN TEXT</Text>
          </Pressable>
        ) : null}
        {showRaw && result.rawText ? (
          <Text selectable style={styles.rawText}>
            {result.rawText}
          </Text>
        ) : null}
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.footer}>
        <Pressable style={styles.ghost} onPress={onBack} disabled={busy}>
          <Text style={styles.ghostText}>BACK</Text>
        </Pressable>
        <Pressable style={styles.primary} onPress={handleLock} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={COLOR.black} />
          ) : (
            <Text style={styles.primaryText}>LOCK CREDENTIAL</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function CropImageFallback({ uri }: { uri: string }) {
  // Shown only when a portrait exists but no crop was chosen — keeps the
  // preview simple without pulling the full image component tree in.
  return (
    <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLOR.black,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  title: {
    color: COLOR.text,
    fontSize: 15,
    letterSpacing: 3,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: COLOR.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 6,
    marginBottom: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 18,
  },
  photoWrap: {
    alignItems: 'center',
    marginBottom: 14,
  },
  photo: {
    width: 96,
    height: 128,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surfaceRaised,
    overflow: 'hidden',
  },
  photoTag: {
    color: COLOR.textMuted,
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: '700',
    marginTop: 6,
  },
  section: {
    color: COLOR.gold,
    fontSize: 10,
    letterSpacing: 2.5,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 8,
  },
  fieldRow: {
    marginBottom: 8,
  },
  fieldHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  fieldLabel: {
    color: COLOR.textMuted,
    fontSize: 9,
    letterSpacing: 1.6,
    fontWeight: '700',
  },
  badge: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  input: {
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: 8,
    color: COLOR.text,
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputMultiline: {
    fontFamily: 'monospace',
    fontSize: 12,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  sectionHint: {
    color: COLOR.textMuted,
    fontSize: 10,
    marginBottom: 8,
  },
  rawToggle: {
    color: COLOR.gold,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  rawText: {
    color: COLOR.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 8,
    padding: 10,
    backgroundColor: COLOR.surface,
    borderRadius: 8,
  },
  error: {
    color: '#E57373',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 26,
    paddingTop: 4,
  },
  ghost: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ghostText: {
    color: COLOR.textSecondary,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1.5,
  },
  primary: {
    flex: 2,
    backgroundColor: COLOR.gold,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: COLOR.black,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1.5,
  },
});
