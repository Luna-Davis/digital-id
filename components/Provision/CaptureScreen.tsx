// components/Provision/CaptureScreen.tsx
//
// Step 1 of provisioning — a guided two-step wizard:
//
//   1. FRONT OF CARD — scan the QR live with the camera, or upload a photo
//      of the front face. When a photo is uploaded, the user then crops the
//      portrait from it (the card's photo slot is a crop of the front card).
//   2. BACK OF CARD — upload a photo of the back face. Its MRZ is decoded
//      for the ID number, DOB, sex and name.
//
// Both faces are merged and handed to the review screen for confirmation.

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import {
  extractFromImage,
  parseQrPayload,
  mergeFaces,
  type ExtractionResult,
} from '../../lib/extraction';
import { prepareImage } from '../../lib/imagePrep';
import type { CropRect } from '../../lib/credentialTypes';
import { COLOR } from '../IDCard/tokens';
import { CropScreen } from './CropScreen';

type CaptureScreenProps = {
  onExtracted: (result: ExtractionResult, portraitUri?: string, crop?: CropRect) => void;
  onCancel: () => void;
};

type Step = 'front' | 'crop' | 'back';

export function CaptureScreen({ onExtracted, onCancel }: CaptureScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>('front');
  const [scanning, setScanning] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [frontResult, setFrontResult] = useState<ExtractionResult | null>(null);
  const [backResult, setBackResult] = useState<ExtractionResult | null>(null);
  const [frontPhoto, setFrontPhoto] = useState<string | undefined>(undefined);
  const [frontPhotoSize, setFrontPhotoSize] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<CropRect | undefined>(undefined);

  const handleQrScanned = (data: string) => {
    if (!scanning) return;
    setScanning(false);
    const result = parseQrPayload(data);
    setFrontResult(result);
    // QR gives the full identity data — straight to the back face.
    setStep('back');
  };

  const pickFront = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (res.canceled || !res.assets?.[0]) return;

    setBusy(true);
    setError('');
    try {
      // Resolve orientation + scale FIRST — OCR, the crop preview and the
      // stored portrait must all see one consistent, correctly-oriented image.
      const prepared = await prepareImage(res.assets[0].uri, { orient: 'card' });
      const result = await extractFromImage(prepared.uri, 'front');
      setFrontResult(result);
      setFrontPhoto(prepared.uri);
      setFrontPhotoSize({ w: prepared.width, h: prepared.height });
      setStep('crop');
    } catch {
      setError('Could not read that image. Try a sharper, well-lit photo of the card.');
    } finally {
      setBusy(false);
    }
  };

  const handleCropConfirm = (rect: CropRect) => {
    setCrop(rect);
    setStep('back');
  };

  const pickBack = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (res.canceled || !res.assets?.[0]) return;

    setBusy(true);
    setError('');
    try {
      const prepared = await prepareImage(res.assets[0].uri, { orient: 'card' });
      const result = await extractFromImage(prepared.uri, 'back');
      setBackResult(result);
      const merged = mergeFaces(frontResult, result);
      onExtracted(merged, frontPhoto, crop);
    } catch {
      setError('Could not read that image. Try a sharper, well-lit photo of the card.');
      setBusy(false);
    }
  };

  // --- Crop step (front photo already captured) ---------------------------
  if (step === 'crop' && frontPhoto) {
    return (
      <CropScreen
        key={frontPhoto}
        imageUri={frontPhoto}
        naturalSize={frontPhotoSize ?? undefined}
        onConfirm={handleCropConfirm}
        onCancel={() => setStep('back')}
      />
    );
  }

  // --- Back step ----------------------------------------------------------
  if (step === 'back') {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>BACK OF CARD</Text>
        <Text style={styles.body}>
          Now the back of the card. It carries your address fields and the machine-readable
          zone with your ID number.
        </Text>

        {frontPhoto ? (
          <View style={styles.thumbWrap}>
            <Image source={{ uri: frontPhoto }} style={styles.thumb} resizeMode="contain" />
            <Text style={styles.thumbTag}>FRONT ✓</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.primary} onPress={pickBack} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={COLOR.black} />
          ) : (
            <Text style={styles.primaryText}>UPLOAD BACK PHOTO</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.ghost}
          onPress={() => {
            setStep('front');
            setScanning(true);
          }}
          disabled={busy}
        >
          <Text style={styles.ghostText}>RESCAN FRONT</Text>
        </Pressable>

        <Text style={styles.privacyNote}>ON-DEVICE ONLY · YOUR DATA NEVER LEAVES THE PHONE</Text>
      </View>
    );
  }

  // --- Front step (QR camera + upload) ------------------------------------
  if (!permission) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator color={COLOR.gold} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>FRONT OF CARD</Text>
        <Text style={styles.body}>
          The camera is used to scan the QR on the front of your ID card — or you can upload a
          photo of the card instead. No images leave your phone.
        </Text>
        <Pressable style={styles.primary} onPress={pickFront} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={COLOR.black} />
          ) : (
            <Text style={styles.primaryText}>UPLOAD FRONT PHOTO</Text>
          )}
        </Pressable>
        <Pressable style={styles.ghost} onPress={requestPermission}>
          <Text style={styles.ghostText}>ALLOW CAMERA (FOR QR)</Text>
        </Pressable>
        <Pressable style={styles.ghost} onPress={onCancel}>
          <Text style={styles.ghostText}>CANCEL</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => handleQrScanned(data)}
        />
        {/* Scan frame */}
        <View style={styles.frame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <Text style={styles.scanHint}>ALIGN THE QR CODE ON THE FRONT OF YOUR ID</Text>
      </View>

      <View style={styles.panel}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.primary} onPress={pickFront} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={COLOR.black} />
          ) : (
            <Text style={styles.primaryText}>NO QR? UPLOAD FRONT PHOTO</Text>
          )}
        </Pressable>

        <Pressable style={styles.ghost} onPress={onCancel}>
          <Text style={styles.ghostText}>CANCEL</Text>
        </Pressable>

        <Text style={styles.privacyNote}>ON-DEVICE ONLY · YOUR DATA NEVER LEAVES THE PHONE</Text>
      </View>
    </View>
  );
}

const CORNER = 26;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLOR.black,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  cameraWrap: {
    width: '100%',
    height: '58%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 180,
    height: 180,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: COLOR.gold,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  scanHint: {
    position: 'absolute',
    bottom: 18,
    color: COLOR.text,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
  },
  panel: {
    marginTop: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
  },
  title: {
    color: COLOR.text,
    fontSize: 16,
    letterSpacing: 3,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  body: {
    color: COLOR.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 22,
    maxWidth: 340,
  },
  thumbWrap: {
    alignItems: 'center',
    marginBottom: 18,
  },
  thumb: {
    width: 120,
    height: 67,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surfaceRaised,
  },
  thumbTag: {
    color: COLOR.green,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 6,
  },
  error: {
    color: '#E57373',
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  primary: {
    alignSelf: 'stretch',
    backgroundColor: COLOR.gold,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryText: {
    color: COLOR.black,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1.5,
  },
  ghost: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  ghostText: {
    color: COLOR.textSecondary,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.5,
  },
  privacyNote: {
    color: COLOR.textMuted,
    fontSize: 9,
    letterSpacing: 1.5,
    marginTop: 4,
  },
});
