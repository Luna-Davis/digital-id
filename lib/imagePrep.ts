// lib/imagePrep.ts
//
// The image-resolution step for uploaded card photos.
//
// Phone photos arrive in arbitrary states: EXIF rotation baked into the file
// metadata, portrait or landscape, and at full camera resolution (which is
// wasted on OCR and distorts previews). This module "resolves" an uploaded
// image so everything downstream — ML Kit OCR, the crop preview, the back
// thumb, and the stored portrait — sees one consistent, correctly-oriented
// image:
//
//   1. Probe the image through expo-image-manipulator, which decodes with
//      EXIF applied — so the measured width/height are the TRUE orientation.
//   2. For card faces ('card' orient), portrait uploads are rotated 90° so
//      the landscape card stands upright (ML Kit reads horizontal text).
//      For portrait sources ('keep'), the corrected orientation is kept.
//   3. Scale the longest edge down to `maxDim` (aspect preserved) — enough
//      resolution for OCR, small enough to store and render cleanly.
//
// Returns a NEW local file URI + final dimensions. The source is untouched.
//
// IMPORTANT: expo-image-manipulator is a native module. Its package calls
// requireNativeModule('ExpoImageManipulator') at MODULE EVALUATION time, which
// throws when the module isn't present in the installed binary (a dev build
// compiled before it was added). A static import would therefore crash the
// whole bundle on such builds. So this module loads it LAZILY via dynamic
// import: on an old build the import rejects, we catch it and degrade to the
// raw source image. The full orientation/scale pipeline re-activates
// automatically after the next native rebuild.

import { Image } from 'react-native';

export type PreparedImage = { uri: string; width: number; height: number };

export type PrepareOptions = {
  /** Longest-edge cap in pixels. Default 1600 (plenty for OCR, light to store). */
  maxDim?: number;
  /**
   * 'card' (default) forces landscape — the physical card is landscape, so a
   * portrait upload is rotated upright. 'keep' preserves the corrected
   * orientation (used for portrait headshots in the photo slot).
   */
  orient?: 'card' | 'keep';
};

type ManipulatorModule = typeof import('expo-image-manipulator');

let nativeChecked = false;
let nativeModule: ManipulatorModule | null = null;

/**
 * Loads expo-image-manipulator lazily and caches the result for the app's
 * life. Returns the module when the native binding is present, otherwise null.
 * Never throws — a missing module (old dev build) yields null.
 */
async function loadManipulator(): Promise<ManipulatorModule | null> {
  if (nativeChecked) return nativeModule;
  nativeChecked = true;
  try {
    const mod = await import('expo-image-manipulator');
    // Sanity probe: confirm the native binding resolved to a callable before
    // trusting it (avoids "Exception in HostFunction value was null" on odd
    // module registrations).
    nativeModule =
      typeof (mod as any).ImageManipulator?.manipulate === 'function' ? mod : null;
  } catch {
    nativeModule = null;
  }
  return nativeModule;
}

/**
 * True when the full image pipeline (EXIF normalize + orient + scale) is
 * available in this build. Async — resolves false on builds that predate the
 * expo-image-manipulator native module.
 */
export async function hasImageManipulator(): Promise<boolean> {
  return (await loadManipulator()) !== null;
}

function getSizeOf(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), (err) => reject(err));
  });
}

/**
 * Degraded-mode result: the raw source unchanged. Dimensions come from
 * Image.getSize (best effort); if they can't be measured we throw so the
 * caller can surface a helpful message instead of proceeding blind.
 */
async function fallbackToRaw(sourceUri: string): Promise<PreparedImage> {
  const { width, height } = await getSizeOf(sourceUri);
  if (!width || !height) {
    throw new Error('Could not determine the image dimensions.');
  }
  return { uri: sourceUri, width, height };
}

/**
 * Resolves an uploaded image: EXIF-normalized, oriented as needed, scaled to
 * a sane size. Returns the corrected local image path + dimensions.
 *
 * When the native module is missing (old dev build) this returns the raw
 * source with its measured dimensions instead of throwing, so the capture
 * flow never crashes.
 */
export async function prepareImage(
  sourceUri: string,
  options: PrepareOptions = {},
): Promise<PreparedImage> {
  const { maxDim = 1600, orient = 'card' } = options;

  // Degraded mode: no native module in this build — hand back the raw image.
  // Orientation/scale normalization re-activates automatically after a rebuild.
  const mod = await loadManipulator();
  if (!mod) {
    return fallbackToRaw(sourceUri);
  }
  const { ImageManipulator, SaveFormat } = mod;

  try {
    // Probe context: decode with EXIF applied to learn the true orientation.
    const probeCtx = ImageManipulator.manipulate(sourceUri);
    const probe = await probeCtx.renderAsync();
    let width = probe.width;
    let height = probe.height;
    if (!width || !height) {
      // Partially-decodable image — bail to the fallback instead of feeding
      // NaN/Infinity into the resize math below.
      throw new Error('Unreadable image.');
    }

    // Working context: rebuild the pipeline from the original source.
    const ctx = ImageManipulator.manipulate(sourceUri);

    if (orient === 'card' && width < height) {
      ctx.rotate(90); // stand the landscape card upright
      [width, height] = [height, width];
    }

    // Scale the longest edge down, preserving aspect ratio.
    const scale = Math.min(1, maxDim / Math.max(width, height));
    ctx.resize({ width: Math.max(1, Math.round(width * scale)) });

    const ref = await ctx.renderAsync();
    const saved = await ref.saveAsync({
      compress: 0.92,
      format: SaveFormat.JPEG,
    });

    return { uri: saved.uri, width: saved.width, height: saved.height };
  } catch {
    // Any decode/manipulation failure — fall back to the raw image rather than
    // taking the whole flow down.
    return fallbackToRaw(sourceUri);
  }
}
