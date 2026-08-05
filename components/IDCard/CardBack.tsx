// components/IDCard/CardBack.tsx
import { View, Text, StyleSheet, ImageSourcePropType } from 'react-native';
import { Field } from './Field';
import { Photo } from './Photo';
import { cardScale, COLOR, MONO, CARD_ASPECT_RATIO } from './tokens';
import type { CropRect } from '../../lib/credentialTypes';

type CardBackProps = {
  cardWidth: number;
  county: string;
  subCounty: string;
  division: string;
  location: string;
  subLocation: string;
  dateOfIssue: string;
  /** Machine-printed serial down the left edge (same on both faces). */
  serialNumber: string;
  /** The machine-readable zone string printed at the bottom of the card. */
  mrz: string;
  /** Same portrait as the front face; omit to show the placeholder. */
  photo?: ImageSourcePropType;
  /** Render-time crop for the portrait (face region of the source photo). */
  crop?: CropRect;
};

export function CardBack(props: CardBackProps) {
  const { crop } = props;
  const s = cardScale(props.cardWidth);
  const cardHeight = props.cardWidth / CARD_ASPECT_RATIO;

  return (
    <View
      style={[
        styles.card,
        {
          width: props.cardWidth,
          height: cardHeight,
          padding: s.pad,
          borderRadius: s.radius,
          borderWidth: s.rule,
          borderColor: COLOR.border,
        },
      ]}
    >
      {/* Top gold hairline */}
      <View
        style={[
          styles.goldHairline,
          {
            height: Math.max(2, s.pad * 0.35),
            borderBottomWidth: s.rule,
            borderBottomColor: COLOR.goldDim,
          },
        ]}
      />

      {/* Vertical serial along the left edge — one digit per line, so it
          renders reliably on every device (rotation used to clip it away). */}
      <View style={[styles.serialStrip, { width: s.serialW }]}>
        <Text style={[styles.serial, { fontSize: s.micro, lineHeight: s.micro, letterSpacing: 0 }]}>
          {(props.serialNumber || '000000000').split('').join('\n')}
        </Text>
      </View>

      {/* Ghost watermark behind the content */}
      <View style={styles.watermark}>
        <Text style={[styles.watermarkText, { fontSize: s.photoW * 1.3, letterSpacing: s.photoW * 0.3 }]}>
          KENYA
        </Text>
      </View>

      {/* Centred title */}
      <View style={styles.head}>
        <Text style={[styles.headTitle, { fontSize: s.title, letterSpacing: s.title * 0.08 }]}>
          REPUBLIC OF KENYA
        </Text>
        <Text style={[styles.headCaption, { fontSize: s.caption, letterSpacing: s.caption * 0.1 }]}>
          ANWANI &middot; ADDRESS
        </Text>
        <View
          style={[
            styles.headRule,
            {
              width: s.photoW * 0.55,
              height: s.rule,
              backgroundColor: COLOR.goldDim,
              marginTop: s.pad * 0.5,
            },
          ]}
        />
      </View>

      {/* SIM chip + address data (text left-aligned, vertically centred) */}
      <View style={[styles.body, { marginTop: s.pad * 0.7 }]}>
        <View style={[styles.chipCol, { width: s.chipW, marginRight: s.rowGap }]}>
          <View
            style={[
              styles.chip,
              {
                width: s.chipW,
                height: s.chipH,
                borderRadius: s.radius * 0.55,
                borderWidth: s.rule * 1.2,
                borderColor: COLOR.goldDim,
              },
            ]}
          >
            {/* Diagonal cut corner */}
            <View
              style={[
                styles.chipCut,
                {
                  top: -s.chipCut,
                  left: -s.chipCut,
                  borderWidth: s.chipCut,
                  borderTopColor: COLOR.surface,
                  borderLeftColor: COLOR.surface,
                  borderRightColor: 'transparent',
                  borderBottomColor: 'transparent',
                },
              ]}
            />
            {/* ID label inside the chip */}
            <Text style={[styles.chipId, { fontSize: s.chipH * 0.4, letterSpacing: 1 }]}>
              ID
            </Text>
          </View>
          <Text
            style={[
              styles.chipLabel,
              { fontSize: s.micro, letterSpacing: s.micro * 0.45, marginTop: s.pad * 0.4 },
            ]}
          >
            SIM CARD
          </Text>
        </View>

        <View style={styles.fields}>
          <Field scale={s} label="COUNTY" value={props.county} compact />
          <Field scale={s} label="SUB-COUNTY" value={props.subCounty} compact />
          <Field scale={s} label="DIVISION" value={props.division} compact />
          <Field scale={s} label="LOCATION" value={props.location} compact />
          <Field scale={s} label="SUB-LOCATION" value={props.subLocation} compact />
          <Field scale={s} label="DATE OF ISSUE" value={props.dateOfIssue} compact />
        </View>

        <Photo scale={s} photo={props.photo} crop={crop} style={{ marginLeft: s.rowGap }} />
      </View>

      <View
        style={[
          styles.rule,
          { height: s.rule, backgroundColor: COLOR.border, marginVertical: s.pad * 0.8 },
        ]}
      />

      {/* Citizen-credential zone — 1/5 of the card height, read with the credential scanner (later) */}
      <View
        style={[
          styles.credBand,
          {
            height: s.credBandH,
            marginTop: s.pad * 0.5,
            borderRadius: s.radius * 0.55,
            borderWidth: s.rule,
            borderColor: COLOR.border,
          },
        ]}
      >
        {props.mrz ? (
          <Text
            numberOfLines={3}
            style={[
              styles.mrz,
              { fontSize: s.mrz, lineHeight: s.mrz * 1.2, letterSpacing: s.mrz * 0.05 },
            ]}
          >
            {props.mrz}
          </Text>
        ) : (
          <>
            {/* Scan-zone placeholder with corner brackets */}
            <View style={styles.scanZone}>
              <View
                style={[
                  styles.corner,
                  styles.cornerTL,
                  {
                    width: s.bracket,
                    height: s.bracket,
                    borderTopWidth: s.rule * 2,
                    borderLeftWidth: s.rule * 2,
                    borderColor: COLOR.goldDim,
                  },
                ]}
              />
              <View
                style={[
                  styles.corner,
                  styles.cornerTR,
                  {
                    width: s.bracket,
                    height: s.bracket,
                    borderTopWidth: s.rule * 2,
                    borderRightWidth: s.rule * 2,
                    borderColor: COLOR.goldDim,
                  },
                ]}
              />
              <View
                style={[
                  styles.corner,
                  styles.cornerBL,
                  {
                    width: s.bracket,
                    height: s.bracket,
                    borderBottomWidth: s.rule * 2,
                    borderLeftWidth: s.rule * 2,
                    borderColor: COLOR.goldDim,
                  },
                ]}
              />
              <View
                style={[
                  styles.corner,
                  styles.cornerBR,
                  {
                    width: s.bracket,
                    height: s.bracket,
                    borderBottomWidth: s.rule * 2,
                    borderRightWidth: s.rule * 2,
                    borderColor: COLOR.goldDim,
                  },
                ]}
              />
              <Text style={[styles.credLabel, { fontSize: s.micro, letterSpacing: s.micro * 0.5 }]}>
                CITIZEN CREDENTIALS
              </Text>
            </View>

            <View style={[styles.sig, { width: s.sigW, marginLeft: s.rowGap }]}>
              <Text style={[styles.sigLabel, { fontSize: s.micro, letterSpacing: s.micro * 0.45 }]}>
                SIGNATURE
              </Text>
              <View
                style={[styles.sigLine, { height: s.rule, backgroundColor: COLOR.textMuted, marginTop: s.pad * 0.45 }]}
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLOR.surface,
    overflow: 'hidden',
    position: 'relative',
  },
  goldHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: COLOR.surface,
  },
  serialStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serial: {
    color: COLOR.textMuted,
    fontFamily: MONO,
    textAlign: 'center',
  },
  watermark: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  watermarkText: {
    color: COLOR.border,
    fontWeight: '800',
    transform: [{ rotate: '-12deg' }],
  },
  head: {
    alignItems: 'center',
  },
  headTitle: {
    color: COLOR.text,
    fontWeight: '700',
  },
  headCaption: {
    color: COLOR.textSecondary,
    fontWeight: '600',
    marginTop: 1,
  },
  headRule: {
    alignSelf: 'center',
  },
  body: {
    flexDirection: 'row',
    flex: 1,
  },
  fields: {
    flex: 1,
    justifyContent: 'center',
  },
  chipCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    backgroundColor: 'rgba(138, 116, 64, 0.16)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCut: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  chipId: {
    color: COLOR.gold,
    fontFamily: MONO,
    fontWeight: '800',
  },
  chipLabel: {
    color: COLOR.textMuted,
    fontWeight: '700',
  },
  rule: {
    alignSelf: 'stretch',
  },
  credBand: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLOR.surfaceRaised,
    overflow: 'hidden',
  },
  scanZone: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
  },
  cornerTL: {
    top: 0,
    left: 0,
  },
  cornerTR: {
    top: 0,
    right: 0,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
  },
  credLabel: {
    color: COLOR.textSecondary,
    fontWeight: '700',
  },
  mrz: {
    color: COLOR.text,
    fontFamily: MONO,
    flex: 1,
    textAlign: 'center',
  },
  sig: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sigLabel: {
    color: COLOR.textMuted,
    fontWeight: '700',
  },
  sigLine: {
    alignSelf: 'stretch',
  },
});
