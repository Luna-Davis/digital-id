// components/IDCard/Photo.tsx
//
// Shared photo block. Both card faces render this component with the same
// `photo` prop, so the image (or placeholder) is always identical front
// and back — the "linked" photo. When a `crop` rect is present, only that
// region of the source photo is shown (render-time crop).
import { View, Text, StyleSheet, Image, ImageSourcePropType, ViewStyle } from 'react-native';
import { COLOR } from './tokens';
import type { CardScale } from './tokens';
import type { CropRect } from '../../lib/credentialTypes';
import { CropImage } from './CropImage';

type PhotoProps = {
  scale: CardScale;
  photo?: ImageSourcePropType;
  crop?: CropRect;
  style?: ViewStyle;
};

export function Photo({ scale: s, photo, crop, style }: PhotoProps) {
  return (
    <View
      style={[
        styles.base,
        {
          width: s.photoW,
          height: s.photoH,
          borderRadius: s.radius * 0.6,
          borderWidth: s.rule,
          borderColor: COLOR.border,
        },
        style,
      ]}
    >
      {photo ? (
        typeof photo === 'object' &&
        !Array.isArray(photo) &&
        'uri' in photo &&
        photo.uri &&
        crop ? (
          <CropImage
            uri={photo.uri}
            crop={crop}
            frameWidth={s.photoW}
            frameHeight={s.photoH}
          />
        ) : (
          <Image source={photo} style={styles.image} resizeMode="cover" />
        )
      ) : (
        <View style={[styles.placeholder, { borderRadius: s.radius * 0.45 }]}>
          <Text style={[styles.caption, { fontSize: s.micro, letterSpacing: s.micro * 0.4 }]}>
            PHOTO
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: COLOR.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  placeholder: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: '#2A313B',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 3,
  },
  caption: {
    color: COLOR.textMuted,
    fontWeight: '700',
  },
});
