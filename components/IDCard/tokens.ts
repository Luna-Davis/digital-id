// components/IDCard/tokens.ts
//
// A proportional design system for the ID card.
//
// The card itself is sized to the ISO/IEC 7810 ID-1 standard
// (85.60 mm x 53.98 mm) — a ratio of ≈ 1.586 : 1, remarkably close
// to the golden ratio (1.618). Every inner dimension below is derived
// from the rendered card width, so the proportions of the card stay
// identical at any screen size. This is the "articulate ratio" the
// whole layout is built on:
//
//   - card        : 1.586 : 1   (ID-1)
//   - photo       : 3 : 4       (portrait)
//   - sim chip    : 1 : 1.3
//   - type scale  : modular, major-second-ish (labels 0.0215w → values 0.03w → ID no. 0.046w)
//   - spacing     : 4 pt grid scaled by card width

import { Platform } from 'react-native';

/** ISO/IEC 7810 ID-1 card: width / height. */
export const CARD_ASPECT_RATIO = 85.6 / 53.98;

/** Government-modern palette (Kenya flag cues: deep green + gold). */
export const COLOR = {
  surface: '#13161B',
  surfaceRaised: '#1C2129',
  border: '#2B323D',
  text: '#F4F6F8',
  textSecondary: '#A9B1BC',
  textMuted: '#707987',
  green: '#2FA86B',
  gold: '#D6B45C',
  goldDim: '#8A7440',
  black: '#0A0C10',
} as const;

/** Monospace face — used for machine-printed identity data. */
export const MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
}) as string;

/** Every measured dimension of the card, expressed as a fraction of width. */
export type CardScale = {
  pad: number;
  radius: number;
  micro: number; // serials, captions
  label: number; // field labels
  body: number; // field values
  title: number; // header main lines
  caption: number; // header sub-lines
  idNumber: number; // machine-printed ID number
  bandH: number; // ID number band
  emblem: number; // emblem size
  photoW: number;
  photoH: number;
  chipW: number;
  chipH: number;
  chipCut: number;
  rowGap: number;
  fieldGap: number;
  serialW: number;
  rule: number;
  credBandH: number;
  bracket: number;
  sigW: number;
};

export function cardScale(w: number): CardScale {
  // The citizen-credential band on the back card is 1/5 of the card height.
  const credBandH = (w / CARD_ASPECT_RATIO) * 0.2;
  return {
    pad: w * 0.02,
    radius: w * 0.035,
    micro: w * 0.02,
    label: w * 0.0215,
    body: w * 0.03,
    title: w * 0.029,
    caption: w * 0.025,
    idNumber: w * 0.046,
    bandH: w * 0.07,
    emblem: w * 0.078,
    photoW: w * 0.225,
    photoH: w * 0.3,
    chipW: w * 0.2,
    chipH: w * 0.26,
    chipCut: w * 0.02,
    rowGap: w * 0.02,
    fieldGap: w * 0.0045,
    serialW: w * 0.023,
    rule: Math.max(1, w * 0.003),
    credBandH,
    bracket: credBandH * 0.34,
    sigW: w * 0.2,
  };
}
