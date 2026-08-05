// components/Provision/CropScreen.tsx
//
// Picks the portrait from the front-card photo. Shows the photo and a 3:4
// frame (matching the card's portrait slot) that the user drags over the
// face. Produces a NORMALIZED crop rect — the actual pixel crop happens at
// render time in <CropImage/>, so no native image module is needed.
//
// The frame geometry lives in a ref (`frameRef`) so the PanResponder
// handlers — which are created once — always read the current values.

import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ActivityIndicator,
  PanResponder,
  type LayoutChangeEvent,
} from 'react-native';
import type { CropRect } from '../../lib/credentialTypes';
import { COLOR } from '../IDCard/tokens';

const FRAME_ASPECT = 3 / 4; // w : h — portrait slot on the card

type CropScreenProps = {
  imageUri: string;
  /** Known resolved dimensions (from prepareImage) — avoids Image.getSize/EXIF mismatches. */
  naturalSize?: { w: number; h: number };
  onConfirm: (crop: CropRect) => void;
  onCancel: () => void;
};

type Frame = { x: number; y: number; w: number; h: number };

export function CropScreen({ imageUri, naturalSize, onConfirm, onCancel }: CropScreenProps) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(
    naturalSize ? { w: naturalSize.w, h: naturalSize.h } : null,
  );
  const [frame, setFrameState] = useState<Frame | null>(null);
  // Preview image lifecycle — a slow decode used to look like a black void.
  const [imgState, setImgState] = useState<'loading' | 'ok' | 'error'>('loading');

  // Refs are the source of truth for gesture handlers.
  const layout = useRef({ box: null as { w: number; h: number } | null, natural: null as { w: number; h: number } | null });
  layout.current.box = box;
  layout.current.natural = natural;
  const frameRef = useRef<Frame | null>(null);
  const dragStart = useRef<{ fx: number; fy: number; gx: number; gy: number } | null>(null);
  const resizeStart = useRef<{ fw: number; fh: number; gx: number; gy: number } | null>(null);

  const setFrame = (f: Frame | null) => {
    frameRef.current = f;
    setFrameState(f);
  };

  function imageRect(): { x: number; y: number; w: number; h: number } {
    const b = layout.current.box;
    const n = layout.current.natural;
    if (!b || !n) return { x: 0, y: 0, w: b?.w ?? 0, h: b?.h ?? 0 };
    const scale = Math.min(b.w / n.w, b.h / n.h);
    const w = n.w * scale;
    const h = n.h * scale;
    return { x: (b.w - w) / 2, y: (b.h - h) / 2, w, h };
  }

  function defaultFrame(img: { x: number; y: number; w: number; h: number }): Frame {
    // 55% of the image width, centred, clamped so it fits within the image.
    let w = img.w * 0.55;
    let h = w * (1 / FRAME_ASPECT);
    if (h > img.h) {
      h = img.h * 0.92;
      w = h * FRAME_ASPECT;
    }
    return { x: img.x + (img.w - w) / 2, y: img.y + (img.h - h) / 2, w, h };
  }

  function clampFrame(f: Frame): Frame {
    const img = imageRect();
    const x = Math.min(Math.max(f.x, img.x), img.x + img.w - f.w);
    const y = Math.min(Math.max(f.y, img.y), img.y + img.h - f.h);
    return { ...f, x, y };
  }

  const onLayoutBox = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
  };

  const onImageLoad = () => {
    if (naturalSize) return; // we already know the resolved dimensions
    Image.getSize(imageUri, (w, h) => setNatural({ w, h }), () => {});
  };

  // The preview must be positioned with REAL style keys — imageRect() returns
  // coordinate keys (x/y/w/h); RN only honors left/top/width/height. Spreading
  // the raw rect used to silently drop the position, leaving a blank slab.
  const imgRect = imageRect();

  // Initialize the frame once both the box and image size are known.
  useEffect(() => {
    if (box && natural && !frameRef.current) {
      setFrame(clampFrame(defaultFrame(imageRect())));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box, natural]);

  const panDrag = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const f = frameRef.current;
        if (!f) return;
        dragStart.current = { fx: f.x, fy: f.y, gx: evt.nativeEvent.pageX, gy: evt.nativeEvent.pageY };
      },
      onPanResponderMove: (evt) => {
        const start = dragStart.current;
        const f = frameRef.current;
        if (!start || !f) return;
        const dx = evt.nativeEvent.pageX - start.gx;
        const dy = evt.nativeEvent.pageY - start.gy;
        setFrame(clampFrame({ ...f, x: start.fx + dx, y: start.fy + dy }));
      },
      onPanResponderRelease: () => (dragStart.current = null),
      onPanResponderTerminate: () => (dragStart.current = null),
    }),
  ).current;

  const panResize = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const f = frameRef.current;
        if (!f) return;
        resizeStart.current = { fw: f.w, fh: f.h, gx: evt.nativeEvent.pageX, gy: evt.nativeEvent.pageY };
      },
      onPanResponderMove: (evt) => {
        const start = resizeStart.current;
        const f = frameRef.current;
        if (!start || !f) return;
        const dx = evt.nativeEvent.pageX - start.gx;
        let w = start.fw + dx;
        const img = imageRect();
        const minW = img.w * 0.25;
        const maxW = Math.min(img.w * 0.95, img.h * FRAME_ASPECT);
        w = Math.min(Math.max(w, minW), maxW);
        const h = w * (1 / FRAME_ASPECT);
        // Anchor the top-left, then re-clamp so the grown frame stays inside.
        setFrame(clampFrame({ ...f, w, h }));
      },
      onPanResponderRelease: () => (resizeStart.current = null),
      onPanResponderTerminate: () => (resizeStart.current = null),
    }),
  ).current;

  const handleConfirm = () => {
    const f = frameRef.current;
    if (!f || !layout.current.natural) return;
    const img = imageRect();
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
    const crop: CropRect = {
      x: clamp01((f.x - img.x) / img.w),
      y: clamp01((f.y - img.y) / img.h),
      w: clamp01(f.w / img.w),
      h: clamp01(f.h / img.h),
    };
    onConfirm(crop);
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>CROP YOUR PORTRAIT</Text>
      <Text style={styles.subtitle}>
        Drag the frame over your face. The photo is stored on-device only.
      </Text>

      <View style={styles.box} onLayout={onLayoutBox}>
        {natural && box ? (
          <View style={styles.imageWrap}>
            {imgRect.w > 0 && imgRect.h > 0 ? (
              <Image
                source={{ uri: imageUri }}
                style={{
                  position: 'absolute',
                  left: imgRect.x,
                  top: imgRect.y,
                  width: imgRect.w,
                  height: imgRect.h,
                }}
                resizeMode="contain"
                onLoad={() => setImgState('ok')}
                onError={() => setImgState('error')}
              />
            ) : null}
            {frame ? (
              <>
                <View
                  {...panDrag.panHandlers}
                  style={[styles.frame, { left: frame.x, top: frame.y, width: frame.w, height: frame.h }]}
                >
                  <View style={[styles.corner, styles.tl]} />
                  <View style={[styles.corner, styles.tr]} />
                  <View style={[styles.corner, styles.bl]} />
                  <View style={[styles.corner, styles.br]} />
                  <Text style={styles.frameLabel}>FACE</Text>
                </View>
                <View
                  {...panResize.panHandlers}
                  style={[styles.handle, { left: frame.x + frame.w - 16, top: frame.y + frame.h - 16 }]}
                />
              </>
            ) : null}
            <ImgOverlay state={imgState} />
          </View>
        ) : (
          <View style={styles.imageWrap}>
            <Image
              source={{ uri: imageUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
              onLoad={() => {
                setImgState('ok');
                onImageLoad();
              }}
              onError={() => setImgState('error')}
            />
            <ImgOverlay state={imgState} />
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.ghost} onPress={onCancel}>
          <Text style={styles.ghostText}>SKIP</Text>
        </Pressable>
        <Pressable style={styles.primary} onPress={handleConfirm} disabled={!frame || imgState === 'error'}>
          <Text style={styles.primaryText}>USE THIS CROP</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Loading/error feedback layered over the preview while the image decodes. */
function ImgOverlay({ state }: { state: 'loading' | 'ok' | 'error' }) {
  if (state === 'ok') return null;
  return (
    <View style={styles.imgOverlay} pointerEvents="none">
      {state === 'error' ? (
        <Text style={styles.imgErrorText}>COULD NOT DISPLAY THIS PHOTO</Text>
      ) : (
        <ActivityIndicator color={COLOR.gold} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLOR.black,
    paddingHorizontal: 20,
    paddingTop: 30,
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
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 6,
    marginBottom: 16,
  },
  box: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  imageWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  imgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imgErrorText: {
    color: '#E57373',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  frame: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: COLOR.gold,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: COLOR.gold,
  },
  tl: { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3 },
  frameLabel: {
    position: 'absolute',
    top: -22,
    left: 0,
    color: COLOR.gold,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },
  handle: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLOR.gold,
    borderWidth: 2,
    borderColor: COLOR.black,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 18,
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
  },
  primaryText: {
    color: COLOR.black,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1.5,
  },
});
