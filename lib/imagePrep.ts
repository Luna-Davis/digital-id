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

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

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

/**
 * Resolves an uploaded image: EXIF-normalized, oriented as needed, scaled to
 * a sane size. Returns the corrected local image path + dimensions.
 */
export async function prepareImage(
  sourceUri: string,
  options: PrepareOptions = {},
): Promise<PreparedImage> {
  const { maxDim = 1600, orient = 'card' } = options;

  // Probe context: decode with EXIF applied to learn the true orientation.
  const probeCtx = ImageManipulator.manipulate(sourceUri);
  const probe = await probeCtx.renderAsync();
  let width = probe.width;
  let height = probe.height;

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
}
