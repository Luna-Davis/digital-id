// App.tsx
//
// Root state machine:
//
//   loading ──► capture ──► review ──► card
//                              ▲           │
//                              └───────────┘ (locked, immutable)
//
// First launch shows the two-step capture flow (front QR/photo → crop
// portrait → back photo). Once the user confirms and locks the credential it
// is encrypted and written to a write-once file; the app then shows the ID
// card populated with the real data. Only the portrait photo (and its crop)
// remain updatable.

import { useEffect, useState } from 'react';
import { View, StyleSheet, Text, Pressable, ActivityIndicator, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { IDCardFlip } from './components/IDCard/IDCardFlip';
import { COLOR } from './components/IDCard/tokens';
import { CaptureScreen } from './components/Provision/CaptureScreen';
import { ReviewScreen } from './components/Provision/ReviewScreen';
import { CropScreen } from './components/Provision/CropScreen';
import { prepareImage } from './lib/imagePrep';
import {
  isProvisioned,
  readCredential,
  provisionCredential,
  updatePhoto,
  getPhotoUri,
  getPhotoCrop,
} from './lib/credentialStore';
import type { CredentialData, CropRect } from './lib/credentialTypes';
import type { ExtractionResult } from './lib/extraction';

type Screen = 'loading' | 'capture' | 'review' | 'card' | 'photoCrop';

/** Placeholder data for web preview only (native uses the encrypted store). */
const SAMPLE: CredentialData = {
  surname: 'SMITH',
  givenName: 'JOHN DOE',
  sex: 'MALE',
  nationality: 'KEN',
  dateOfBirth: '01.01.2000',
  placeOfBirth: 'NAIROBI',
  idNumber: '0123456789',
  placeOfIssue: 'NAIROBI',
  dateOfExpiry: '02.04.2018',
  county: 'NAIROBI',
  subCounty: 'NAIROBI',
  division: 'NAIROBI',
  location: 'NAIROBI',
  subLocation: 'NAIROBI',
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [credential, setCredential] = useState<CredentialData>(SAMPLE);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoCrop, setPhotoCrop] = useState<CropRect | null>(null);
  const [draft, setDraft] = useState<ExtractionResult | null>(null);
  const [draftPhoto, setDraftPhoto] = useState<string | undefined>(undefined);
  const [draftCrop, setDraftCrop] = useState<CropRect | undefined>(undefined);
  const [pendingPortrait, setPendingPortrait] = useState<string | null>(null);
  const [pendingPortraitSize, setPendingPortraitSize] = useState<{ w: number; h: number } | null>(null);
  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'web') {
          // Web preview: no native store — show the sample card.
          setScreen('card');
          return;
        }
        if (isProvisioned()) {
          const data = await readCredential();
          setCredential(data);
          setPhotoUri(await getPhotoUri());
          setPhotoCrop(await getPhotoCrop());
          setScreen('card');
        } else {
          // First launch — start the capture flow (front → back).
          setScreen('capture');
        }
      } catch {
        setScreen('capture');
      }
    })();
  }, []);

  const handleExtracted = (result: ExtractionResult, photo?: string, crop?: CropRect) => {
    setDraft(result);
    setDraftPhoto(photo);
    setDraftCrop(crop);
    setScreen('review');
  };

  const handleLock = async (data: CredentialData, photo?: string, crop?: CropRect) => {
    try {
      await provisionCredential(data, photo, crop);
    } catch (e) {
      // If the lock file exists, provisioning actually succeeded (e.g. only the
      // optional portrait failed) — recover instead of leaving the user stuck.
      if (!isProvisioned()) throw e;
    }
    setCredential(data);
    setPhotoUri(await getPhotoUri());
    setPhotoCrop(crop ?? (await getPhotoCrop()));
    setDraft(null);
    setScreen('card');
  };

  // --- UPDATE PORTRAIT: pick a new source photo, then crop it -------------
  const handleUpdatePortrait = async () => {
    if (Platform.OS === 'web') return; // native-only (quick-crypto / file-system)
    setPhotoError('');
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
      if (res.canceled || !res.assets?.[0]) return;
      // The portrait is a headshot — keep its true orientation (don't force
      // landscape), but still EXIF-normalize and scale it.
      const prepared = await prepareImage(res.assets[0].uri, { orient: 'keep', maxDim: 1200 });
      setPendingPortrait(prepared.uri);
      setPendingPortraitSize({ w: prepared.width, h: prepared.height });
      setScreen('photoCrop');
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : 'Could not open the photo library.');
    }
  };

  const handleCropDone = async (crop: CropRect) => {
    if (!pendingPortrait) return;
    try {
      await updatePhoto(pendingPortrait, crop);
      setPhotoUri(await getPhotoUri());
      setPhotoCrop(crop);
      setPendingPortrait(null);
      setPendingPortraitSize(null);
      setScreen('card');
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : 'Could not update the portrait.');
      setPendingPortrait(null);
      setPendingPortraitSize(null);
      setScreen('card');
    }
  };

  if (screen === 'loading') {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <ActivityIndicator color={COLOR.gold} size="large" />
      </View>
    );
  }

  if (screen === 'capture') {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <CaptureScreen onExtracted={handleExtracted} onCancel={() => {}} />
      </View>
    );
  }

  if (screen === 'review' && draft) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <ReviewScreen
          result={draft}
          portraitUri={draftPhoto}
          crop={draftCrop}
          onBack={() => setScreen('capture')}
          onLock={handleLock}
        />
      </View>
    );
  }

  if (screen === 'photoCrop' && pendingPortrait) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <CropScreen
          key={pendingPortrait}
          imageUri={pendingPortrait}
          naturalSize={pendingPortraitSize ?? undefined}
          onConfirm={handleCropDone}
          onCancel={() => {
            setPendingPortrait(null);
            setPendingPortraitSize(null);
            setScreen('card');
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={[styles.glow, styles.glowGreen]} />
      <View style={[styles.glow, styles.glowGold]} />

      <IDCardFlip
        frontProps={{
          surname: credential.surname,
          givenName: credential.givenName,
          sex: credential.sex,
          nationality: credential.nationality,
          dateOfBirth: credential.dateOfBirth,
          placeOfBirth: credential.placeOfBirth,
          idNumber: credential.idNumber,
          placeOfIssue: credential.placeOfIssue,
          dateOfExpiry: credential.dateOfExpiry,
        }}
        backProps={{
          county: credential.county,
          subCounty: credential.subCounty,
          division: credential.division,
          location: credential.location,
          subLocation: credential.subLocation,
        }}
        photo={photoUri ? { uri: photoUri } : undefined}
        photoCrop={photoCrop ?? undefined}
      />

      <Pressable style={styles.updatePhoto} onPress={handleUpdatePortrait}>
        <Text style={styles.updatePhotoText}>UPDATE PORTRAIT</Text>
      </Pressable>
      {photoError ? <Text style={styles.photoError}>{photoError}</Text> : null}
      <Text style={styles.hint}>TAP THE CARD TO FLIP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLOR.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  glowGreen: {
    top: '8%',
    left: '6%',
    backgroundColor: 'rgba(47, 168, 107, 0.07)',
  },
  glowGold: {
    bottom: '10%',
    right: '4%',
    backgroundColor: 'rgba(214, 180, 92, 0.05)',
  },
  updatePhoto: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  updatePhotoText: {
    color: COLOR.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },
  photoError: {
    marginTop: 10,
    color: '#E57373',
    fontSize: 11,
    textAlign: 'center',
  },
  hint: {
    marginTop: 14,
    color: COLOR.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
  },
});
