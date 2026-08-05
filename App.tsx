// App.tsx
//
// Root state machine:
//
//   loading ──► capture ──► review ──► card ──(background)──► unlock
//       │                             ▲                        │
//       │  (first launch → capture)   │   (biometric / PIN)    │
//       └─────────────────────────────┴────────────────────────┘
//
// First launch runs the two-step capture flow (front photo → crop portrait →
// back photo). Once the user confirms, the credential is encrypted and written
// to a write-once file, and the user is asked to set a lock PIN. Later launches
// boot → unlock (biometrics if enrolled, otherwise the PIN) → card. The card
// re-locks whenever the app leaves the foreground. Only the portrait photo
// (and its crop) remain updatable after provisioning.

import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, Pressable, Platform, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { IDCardFlip } from './components/IDCard/IDCardFlip';
import { BootScreen } from './components/Boot/BootScreen';
import { PinSetupScreen } from './components/Lock/PinSetupScreen';
import { UnlockScreen } from './components/Lock/UnlockScreen';
import { SettingsScreen } from './components/Settings/SettingsScreen';
import { COLOR } from './components/IDCard/tokens';
import { CaptureScreen } from './components/Provision/CaptureScreen';
import { ReviewScreen } from './components/Provision/ReviewScreen';
import { CropScreen } from './components/Provision/CropScreen';
import { prepareImage, hasImageManipulator } from './lib/imagePrep';
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
import { isPinSet } from './lib/lockStore';

type Screen = 'loading' | 'pinSetup' | 'unlock' | 'capture' | 'review' | 'card' | 'photoCrop' | 'settings';

/** Minimum time the branding/boot screen stays on screen at launch. */
const MIN_BOOT_MS = 1800;

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
  dateOfIssue: '01.01.2015',
  serialNumber: '0123456789',
  mrz: 'IDKEN0123456789<<0<<<K<<K<LLK\n0123456789M0123456789KEN<<LLLLLLLLLL8\nSMITH<K<SAMPLE<<LENASAMPLE<<<<LKL',
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
  const [nativePipeline, setNativePipeline] = useState<boolean | null>(null);

  // Mirror of `screen` so the AppState listener never needs to re-subscribe.
  const screenRef = useRef<Screen>('loading');
  screenRef.current = screen;

  useEffect(() => {
    let live = true;
    hasImageManipulator().then((ok) => {
      if (live) setNativePipeline(ok);
    });
    return () => {
      live = false;
    };
  }, []);

  // Re-lock when the app leaves the foreground while the card is showing.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (Platform.OS === 'web') return;
      if ((next === 'background' || next === 'inactive') && screenRef.current === 'card') {
        setScreen('unlock');
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let live = true;
    const bootedAt = Date.now();
    // Hold the boot screen long enough to register, even if provisioning is fast.
    const go = (next: Screen) => {
      const delay = Math.max(0, MIN_BOOT_MS - (Date.now() - bootedAt));
      setTimeout(() => {
        if (live) setScreen(next);
      }, delay);
    };
    (async () => {
      try {
        if (Platform.OS === 'web') {
          // Web preview: no native store — show the sample card.
          go('card');
          return;
        }
        if (isProvisioned()) {
          const data = await readCredential();
          setCredential(data);
          setPhotoUri(await getPhotoUri());
          setPhotoCrop(await getPhotoCrop());
          go((await isPinSet()) ? 'unlock' : 'pinSetup');
        } else {
          // First launch — start the capture flow (front → back).
          go('capture');
        }
      } catch {
        go('capture');
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const handlePinSetupDone = () => setScreen('card');
  const handleUnlock = () => setScreen('card');

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
    setScreen((await isPinSet()) ? 'card' : 'pinSetup');
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
    return <BootScreen />;
  }

  if (screen === 'pinSetup') {
    return <PinSetupScreen onDone={handlePinSetupDone} />;
  }

  if (screen === 'unlock') {
    return <UnlockScreen onUnlock={handleUnlock} />;
  }

  if (screen === 'settings') {
    return <SettingsScreen onBack={() => setScreen('card')} />;
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
          serialNumber: credential.serialNumber,
        }}
        backProps={{
          county: credential.county,
          subCounty: credential.subCounty,
          division: credential.division,
          location: credential.location,
          subLocation: credential.subLocation,
          dateOfIssue: credential.dateOfIssue,
          serialNumber: credential.serialNumber,
          mrz: credential.mrz,
        }}
        photo={photoUri ? { uri: photoUri } : undefined}
        photoCrop={photoCrop ?? undefined}
      />

      <Pressable style={styles.settingsButton} onPress={() => setScreen('settings')}>
        <Text style={styles.settingsButtonText}>SETTINGS</Text>
      </Pressable>

      <Pressable style={styles.updatePhoto} onPress={handleUpdatePortrait}>
        <Text style={styles.updatePhotoText}>UPDATE PORTRAIT</Text>
      </Pressable>
      {photoError ? <Text style={styles.photoError}>{photoError}</Text> : null}
      {nativePipeline === false ? (
        <Text style={styles.degradedNote}>
          PHOTO NORMALIZATION UNAVAILABLE ON THIS BUILD — REBUILD THE DEV CLIENT TO ENABLE
        </Text>
      ) : null}
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
  settingsButton: {
    position: 'absolute',
    top: 48,
    right: 20,
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(28, 33, 41, 0.8)',
  },
  settingsButtonText: {
    color: COLOR.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
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
  degradedNote: {
    marginTop: 10,
    color: COLOR.gold,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    maxWidth: 320,
  },
  hint: {
    marginTop: 14,
    color: COLOR.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
  },
});
