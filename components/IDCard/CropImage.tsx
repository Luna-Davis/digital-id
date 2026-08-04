// components/IDCard/CropImage.tsx
//
// Renders an image so that only the normalized crop region fills the frame
// ("cover" semantics within the crop rect). Used to show the face region of
// the full front-card photo as the card portrait — the pixel crop happens
// here at render time, so no native image-processing module is needed.

import { useEffect, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import type { CropRect } from '../../lib/credentialTypes';

type CropImageProps = {
  uri: string;
  crop: CropRect;
  /** The rendered frame size (portrait slot dimensions). */
  frameWidth: number;
  frameHeight: number;
  borderRadius?: number;
};

export function CropImage({ uri, crop, frameWidth, frameHeight, borderRadius = 0 }: CropImageProps) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    Image.getSize(
      uri,
      (w, h) => mounted && setSize({ w, h }),
      () => mounted && setSize(null),
    );
    return () => {
      mounted = false;
    };
  }, [uri]);

  if (!size) {
    return <Image source={{ uri }} style={[styles.fill, { width: frameWidth, height: frameHeight, borderRadius }]} resizeMode="cover" />;
  }

  // Map the crop region (in source pixels) onto the frame.
  const cropW = size.w * crop.w;
  const cropH = size.h * crop.h;
  const scale = Math.max(frameWidth / cropW, frameHeight / cropH);
  const renderW = size.w * scale;
  const renderH = size.h * scale;
  const offsetX = -(size.w * crop.x * scale);
  const offsetY = -(size.h * crop.y * scale);

  return (
    <Image
      source={{ uri }}
      style={{
        position: 'absolute',
        left: offsetX,
        top: offsetY,
        width: renderW,
        height: renderH,
      }}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
