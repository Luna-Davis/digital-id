// components/IDCard/CardFront.tsx
import { View, Text, StyleSheet, Image, ImageSourcePropType } from 'react-native';
import { Field } from './Field';
import { Photo } from './Photo';
import { cardScale, COLOR, MONO, CARD_ASPECT_RATIO } from './tokens';
import type { CropRect } from '../../lib/credentialTypes';

type CardFrontProps = {
  cardWidth: number;
  surname: string;
  givenName: string;
  sex: string;
  nationality: string;
  dateOfBirth: string;
  placeOfBirth: string;
  idNumber: string;
  placeOfIssue: string;
  dateOfExpiry: string;
  /** Machine-printed serial down the left edge (same on both faces). */
  serialNumber: string;
  /** Portrait shown on both faces; omit to show the placeholder. */
  photo?: ImageSourcePropType;
  /** Render-time crop for the portrait (face region of the source photo). */
  crop?: CropRect;
};

export function CardFront(props: CardFrontProps) {
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
      {/* Top gold hairline — a government-card cue */}
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

      {/* Bilingual header, emblem centred */}
      <View style={[styles.header, { marginTop: s.pad * 0.5 }]}>
        <View style={styles.headerCol}>
          <Text
            style={[
              styles.headerTitle,
              { fontSize: s.title, lineHeight: s.title * 1.2, letterSpacing: s.title * 0.03 },
            ]}
          >
            JAMHURI YA KENYA
          </Text>
          <Text
            style={[
              styles.headerCaption,
              { fontSize: s.caption, lineHeight: s.caption * 1.2, letterSpacing: s.caption * 0.04 },
            ]}
          >
            REPUBLIC OF KENYA
          </Text>
        </View>
        <Image
          source={require('../../assets/govt-emblem.png')}
          style={[styles.emblem, { width: s.emblem, height: s.emblem }]}
        />
        <View style={[styles.headerCol, styles.headerColRight]}>
          <Text
            style={[
              styles.headerTitle,
              { fontSize: s.title, lineHeight: s.title * 1.2, letterSpacing: s.title * 0.03 },
            ]}
          >
            KITAMBULISHO CHA TAIFA
          </Text>
          <Text
            style={[
              styles.headerCaption,
              { fontSize: s.caption, lineHeight: s.caption * 1.2, letterSpacing: s.caption * 0.04 },
            ]}
          >
            NATIONAL IDENTITY CARD
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.rule,
          { height: s.rule, backgroundColor: COLOR.border, marginVertical: s.pad * 0.4 },
        ]}
      />

      {/* Photo + fields */}
      <View style={styles.body}>
        <Photo scale={s} photo={props.photo} crop={crop} style={{ marginRight: s.rowGap }} />

        <View style={styles.fields}>
          <Field scale={s} label="SURNAME" value={props.surname} />
          <Field scale={s} label="GIVEN NAME" value={props.givenName} />

          <View style={[styles.row, { gap: s.rowGap }]}>
            <Field scale={s} label="SEX" value={props.sex} style={styles.rowItem} />
            <Field scale={s} label="NATIONALITY" value={props.nationality} style={styles.rowItem} />
            <Field scale={s} label="DATE OF BIRTH" value={props.dateOfBirth} style={styles.rowItem} />
          </View>

          <Field scale={s} label="PLACE OF BIRTH" value={props.placeOfBirth} />
          <Field scale={s} label="PLACE OF ISSUE" value={props.placeOfIssue} />
          <Field scale={s} label="DATE OF EXPIRY" value={props.dateOfExpiry} />
        </View>
      </View>

      {/* Machine-printed ID number band */}
      <View
        style={[
          styles.idBand,
          {
            height: s.bandH,
            borderRadius: s.radius * 0.55,
            marginTop: s.pad * 0.45,
            paddingHorizontal: s.pad * 0.9,
            borderWidth: s.rule,
            borderColor: COLOR.border,
          },
        ]}
      >
        <Text style={[styles.idLabel, { fontSize: s.micro, letterSpacing: s.micro * 0.5 }]}>
          ID NO.
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[
            styles.idNumber,
            { fontSize: s.idNumber, lineHeight: s.idNumber * 1.15, letterSpacing: s.idNumber * 0.12 },
          ]}
        >
          {props.idNumber}
        </Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCol: {
    flex: 1,
  },
  headerColRight: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    color: COLOR.text,
    fontWeight: '700',
  },
  headerCaption: {
    color: COLOR.textSecondary,
    fontWeight: '600',
  },
  emblem: {
    resizeMode: 'contain',
    marginHorizontal: 6,
  },
  rule: {
    alignSelf: 'stretch',
  },
  body: {
    flexDirection: 'row',
    flex: 1,
  },
  fields: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
  },
  rowItem: {
    flex: 1,
  },
  idBand: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLOR.surfaceRaised,
  },
  idLabel: {
    color: COLOR.goldDim,
    fontWeight: '700',
    marginRight: 8,
  },
  idNumber: {
    color: COLOR.gold,
    fontFamily: MONO,
    fontWeight: '700',
    flexShrink: 1,
  },
});
