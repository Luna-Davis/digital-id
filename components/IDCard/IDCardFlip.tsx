// components/IDCard/IDCardFlip.tsx
import { useState } from 'react';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, ImageSourcePropType } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { CardFront } from './CardFront';
import { CardBack } from './CardBack';
import { CARD_ASPECT_RATIO } from './tokens';
import type { CropRect } from '../../lib/credentialTypes';

type IDCardFlipProps = {
  frontProps: Omit<ComponentProps<typeof CardFront>, 'cardWidth'>;
  backProps: Omit<ComponentProps<typeof CardBack>, 'cardWidth'>;
  /** Portrait shown on both faces — the shared “linked” photo. */
  photo?: ImageSourcePropType;
  /** Render-time crop for the portrait (face region of the source photo). */
  photoCrop?: CropRect;
};

/**
 * A tap-to-flip ID card. The card is sized to the ID-1 ratio (≈1.586:1)
 * from the available window, and both faces share the exact same
 * geometry so the 3D flip is seamless.
 */
export function IDCardFlip({ frontProps, backProps, photo, photoCrop }: IDCardFlipProps) {
  const { width, height } = useWindowDimensions();
  // Portrait phones are width-bound (the landscape card is narrower on a
  // tall screen), so let the card breathe up to ~92% of the width. The
  // height cap keeps the flip + actions below it on screen.
  const cardWidth = Math.min(width * 0.92, height * 0.58 * CARD_ASPECT_RATIO, 500);
  const cardHeight = cardWidth / CARD_ASPECT_RATIO;

  const [flipped, setFlipped] = useState(false);
  const rotation = useSharedValue(0);

  const handleFlip = () => {
    rotation.value = withSpring(flipped ? 0 : 180, {
      damping: 18,
      stiffness: 170,
      mass: 0.9,
    });
    setFlipped(!flipped);
  };

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1400 }, { rotateY: `${rotation.value}deg` }],
    backfaceVisibility: 'hidden',
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1400 }, { rotateY: `${rotation.value + 180}deg` }],
    backfaceVisibility: 'hidden',
  }));

  return (
    <Pressable
      onPress={handleFlip}
      style={({ pressed }) => [
        styles.container,
        { width: cardWidth, height: cardHeight },
        pressed && styles.pressed,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, frontStyle]}>
        <CardFront {...frontProps} cardWidth={cardWidth} photo={photo} crop={photoCrop} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, backStyle]}>
        <CardBack {...backProps} cardWidth={cardWidth} photo={photo} crop={photoCrop} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
});
