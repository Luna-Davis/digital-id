// lib/extraction.ts
//
// Turns a physical ID into structured data:
//
//   1. QR-first: modern IDs (e.g. Kenya's Maisha Namba) carry a QR payload
//      that is decoded error-free. We try JSON; otherwise we surface the raw
//      text so the user can correct the mapping in the review step.
//   2. OCR fallback: Google ML Kit text recognition returns lines with
//      bounding boxes, which we use for zone-based field extraction.
//      The FRONT and BACK faces are parsed separately (`face` param),
//      and the back's machine-readable zone (MRZ) is decoded for the
//      identity number, DOB, sex and expiry.
//
// Extraction is intentionally best-effort — the review screen is the safety
// net where the user confirms every field before the credential is locked.

import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';
import type { Text, TextLine, TextElement } from '@infinitered/react-native-mlkit-text-recognition';
import type { CredentialData } from './credentialTypes';

export type ScanFace = 'front' | 'back';

export type ExtractionResult = {
  data: Partial<CredentialData>;
  /** Keys that were successfully pulled from the scan (for review badges). */
  extracted: (keyof CredentialData)[];
  rawText: string;
  source: 'qr' | 'ocr';
};

// ---------------------------------------------------------------------------
// QR payload parsing
// ---------------------------------------------------------------------------

const QR_KEY_MAP: Record<string, keyof CredentialData> = {
  surname: 'surname',
  givenname: 'givenName',
  'given name': 'givenName',
  firstname: 'givenName',
  'first name': 'givenName',
  sex: 'sex',
  gender: 'sex',
  nationality: 'nationality',
  dob: 'dateOfBirth',
  dateofbirth: 'dateOfBirth',
  'date of birth': 'dateOfBirth',
  placeofbirth: 'placeOfBirth',
  'place of birth': 'placeOfBirth',
  idnumber: 'idNumber',
  'id number': 'idNumber',
  idno: 'idNumber',
  'id no': 'idNumber',
  placeofissue: 'placeOfIssue',
  'place of issue': 'placeOfIssue',
  dateofexpiry: 'dateOfExpiry',
  'date of expiry': 'dateOfExpiry',
  county: 'county',
  subcounty: 'subCounty',
  'sub county': 'subCounty',
  division: 'division',
  location: 'location',
  sublocation: 'subLocation',
  'sub location': 'subLocation',
};

export function parseQrPayload(payload: string): ExtractionResult {
  const extracted: (keyof CredentialData)[] = [];
  try {
    const obj: unknown = JSON.parse(payload);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const data: Partial<CredentialData> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        const mapped = QR_KEY_MAP[key.toLowerCase().trim()];
        if (mapped && typeof value === 'string') {
          data[mapped] = value.trim();
          extracted.push(mapped);
        }
      }
      if (Object.keys(data).length > 0) {
        return { data, extracted, rawText: payload, source: 'qr' };
      }
    }
  } catch {
    // Not JSON — fall through to raw handling.
  }
  // Unknown payload: hand the raw text to the user to verify/edit.
  return { data: {}, extracted, rawText: payload, source: 'qr' };
}

// ---------------------------------------------------------------------------
// OCR zone parsing
// ---------------------------------------------------------------------------
// The Kenyan national ID card layout (measured from sample card renders):
//
//   FRONT:  header (bilingual), then a left column of labels with values
//           directly beneath each label:
//             SURNAME → value
//             GIVEN NAMES → value
//             SEX | NATIONALITY | DATE OF BIRTH  (one row, three columns)
//             PLACE OF BIRTH → value
//             DATE OF EXPIRY → value
//             PLACE OF ISSUE → value
//           plus a machine-printed ID NO. band along the bottom.
//
//   BACK:   GIVEN NAMES / NATIONALITY / PLACE OF BIRTH / PLACE OF ISSUE
//           (repeats), the signature block, and a machine-readable zone:
//             IDKEN881014234<<0<<K<KK<KKLL
//             8810142F2312017KEN<<LLLLLLLLKLL8
//             SMITH<K<SAMPLE<<LENASAMPLE<<<<LKL

const FRONT_LABELS: { label: string; key: keyof CredentialData }[] = [
  { label: 'SURNAME', key: 'surname' },
  { label: 'GIVEN NAMES', key: 'givenName' },
  { label: 'GIVEN NAME', key: 'givenName' },
  { label: 'SEX', key: 'sex' },
  { label: 'NATIONALITY', key: 'nationality' },
  { label: 'DATE OF BIRTH', key: 'dateOfBirth' },
  { label: 'PLACE OF BIRTH', key: 'placeOfBirth' },
  { label: 'PLACE OF ISSUE', key: 'placeOfIssue' },
  { label: 'DATE OF EXPIRY', key: 'dateOfExpiry' },
  { label: 'ID NUMBER', key: 'idNumber' },
  { label: 'ID NO', key: 'idNumber' },
];

const BACK_LABELS: { label: string; key: keyof CredentialData }[] = [
  { label: 'GIVEN NAMES', key: 'givenName' },
  { label: 'GIVEN NAME', key: 'givenName' },
  { label: 'NATIONALITY', key: 'nationality' },
  { label: 'PLACE OF BIRTH', key: 'placeOfBirth' },
  { label: 'PLACE OF ISSUE', key: 'placeOfIssue' },
  { label: 'DATE OF BIRTH', key: 'dateOfBirth' },
  { label: 'DATE OF EXPIRY', key: 'dateOfExpiry' },
  { label: 'ID NUMBER', key: 'idNumber' },
  { label: 'ID NO', key: 'idNumber' },
];

const MONTHS: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
};

/** Normalizes an OCR'd date ("01-JAN-1990", "01.01.1990") to DD.MM.YYYY. */
export function normalizeDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const t = raw.trim().toUpperCase().replace(/[.,\/]/g, '-');
  const m = t.match(/^(\d{1,2})-([A-Z]{3}|\d{1,2})-(\d{2,4})$/);
  if (!m) return undefined;
  const day = m[1].padStart(2, '0');
  const monthToken = m[2];
  // Reject OCR-garbled month tokens (e.g. "JANO").
  const month = MONTHS[monthToken] ?? (/^\d{1,2}$/.test(monthToken) ? monthToken.padStart(2, '0') : undefined);
  if (!month) return undefined;
  let year = m[3];
  if (year.length === 2) year = (Number(year) > 50 ? '19' : '20') + year;
  if (!/^\d{4}$/.test(year)) return undefined;
  return `${day}.${month}.${year}`;
}

/** "F" → "FEMALE", "M" → "MALE". */
function normalizeSex(raw?: string): string | undefined {
  if (!raw) return undefined;
  const t = raw.trim().toUpperCase();
  if (t.startsWith('F')) return 'FEMALE';
  if (t.startsWith('M')) return 'MALE';
  return raw.trim();
}

// --- MRZ parsing (machine-readable zone on the card back) ----------------
// Line 1: ID<issuer><number><<...
// Line 2: <YYMMDD><check><sex><YYMMDD><check><issuer><<...

function parseMrz(lines: string[]): Partial<CredentialData> {
  const data: Partial<CredentialData> = {};
  const joined = lines.join('\n');

  // Line 1: IDKEN881014234<<0<<K<KK<KKLL
  const idMatch = joined.match(/ID([A-Z]{0,3})(\d{6,})/);
  if (idMatch) data.idNumber = idMatch[2];

  // Line 2: 8810142F2312017KEN<<...   (YYMMDD, check, sex, YYMMDD, check, issuer)
  const dobMatch = joined.match(/(\d{6})\d([MF])(\d{6})\d[A-Z]{3}</);
  if (dobMatch) {
    const yymmdd = dobMatch[1];
    const y = Number(yymmdd.slice(0, 2)) > 50 ? '19' : '20';
    data.dateOfBirth = `${yymmdd.slice(4, 6)}.${yymmdd.slice(2, 4)}.${y + yymmdd.slice(0, 2)}`;
    data.sex = dobMatch[2] === 'F' ? 'FEMALE' : 'MALE';
    const expiry = dobMatch[3];
    const ey = Number(expiry.slice(0, 2)) > 50 ? '19' : '20';
    data.dateOfExpiry = `${expiry.slice(4, 6)}.${expiry.slice(2, 4)}.${ey + expiry.slice(0, 2)}`;
  }

  return data;
}

function isKnownLabel(text: string, face: ScanFace): boolean {
  const upper = text.toUpperCase();
  const labels = face === 'front' ? FRONT_LABELS : BACK_LABELS;
  return labels.some(({ label }) => upper.includes(label));
}

/**
 * A label is "standalone" when the character right after it is a separator
 * (space / punctuation / end of line). This prevents "GIVEN NAME" from
 * matching inside "GIVEN NAMES" and consuming the trailing "S".
 */
function isStandalone(upper: string, pos: number, label: string): boolean {
  const after = upper[pos + label.length];
  return after === undefined || /[^A-Z0-9]/.test(after);
}

/** Center-x of the label's span within its line (for column matching). */
function labelCenterX(line: TextLine, pos: number, len: number): number {
  let acc = 0;
  let minLeft = Infinity;
  let maxRight = -Infinity;
  let found = false;
  for (const el of line.elements) {
    const elStart = acc;
    const elEnd = acc + el.text.length;
    if (elEnd > pos && elStart < pos + len) {
      minLeft = Math.min(minLeft, el.frame.left);
      maxRight = Math.max(maxRight, el.frame.right);
      found = true;
    }
    acc = elEnd;
  }
  if (!found) return (line.frame.left + line.frame.right) / 2;
  return (minLeft + maxRight) / 2;
}

/** Count of distinct known labels on the line — 1 means a columnar row. */
function countLabelsOnLine(line: TextLine, face: ScanFace): number {
  const upper = line.text.toUpperCase();
  const labels = face === 'front' ? FRONT_LABELS : BACK_LABELS;
  const seen = new Set<string>();
  for (const { label } of labels) {
    const pos = upper.indexOf(label);
    if (pos !== -1 && isStandalone(upper, pos, label)) seen.add(label);
  }
  return seen.size;
}

/**
 * Extracts fields from ML Kit output for one face. For each recognized
 * label line we take either the remainder of the same line (e.g.
 * "SURNAME  SMITH") or the value below it. When a label row is COLUMNAR
 * (SEX | NATIONALITY | DATE OF BIRTH share one line), values are matched
 * by x-position so each column gets its own value.
 */
export function parseOcrText(text: Text, face: ScanFace = 'front'): ExtractionResult {
  const lines: (TextLine & { index: number })[] = text.blocks
    .flatMap((block) => block.lines)
    .map((line, index) => ({ ...line, index }));

  const data: Partial<CredentialData> = {};
  const extracted: (keyof CredentialData)[] = [];
  // "lineIndex" (whole line consumed) or "lineIndex:elemIndex" (one column).
  const taken = new Set<string>();
  const labels = face === 'front' ? FRONT_LABELS : BACK_LABELS;

  for (const line of lines) {
    const upper = line.text.trim().toUpperCase();
    const columnar = countLabelsOnLine(line, face) > 1;

    for (const { label, key } of labels) {
      if (data[key] !== undefined) continue; // already extracted
      const pos = upper.indexOf(label);
      if (pos === -1 || !isStandalone(upper, pos, label)) continue;

      // Same-line value: "SURNAME  SMITH". Rejected when the remainder
      // contains another known label (the columnar row "SEX NATIONALITY
      // DATE OF BIRTH") — that must fall through to column matching.
      const sameLineValue = line.text.slice(pos + label.length).trim();
      if (sameLineValue.length > 0 && !isKnownLabel(sameLineValue, face)) {
        data[key] = sameLineValue;
        extracted.push(key);
        taken.add(`${line.index}`);
        break;
      }

      // Value on the line(s) directly below.
      const labelBottom = line.frame.bottom;
      const labelCx = labelCenterX(line, pos, label.length);
      const candidates = lines
        .filter(
          (candidate) =>
            candidate.index > line.index &&
            candidate.frame.top >= labelBottom - 1 &&
            !isKnownLabel(candidate.text, face),
        )
        .sort((a, b) => a.frame.top - b.frame.top);

      const nearest = candidates[0];
      if (!nearest) break;

      if (columnar && nearest.elements.length > 1) {
        // Pick the column aligned under this label (closest center-x).
        const best = nearest.elements
          .map((el: TextElement, ei: number) => ({
            el,
            ei,
            cx: (el.frame.left + el.frame.right) / 2,
            dist: Math.abs((el.frame.left + el.frame.right) / 2 - labelCx),
          }))
          .filter((c) => !taken.has(`${nearest.index}:${c.ei}`))
          .sort((a, b) => a.dist - b.dist)[0];
        if (best) {
          data[key] = best.el.text.trim();
          extracted.push(key);
          taken.add(`${nearest.index}:${best.ei}`);
        }
      } else if (!taken.has(`${nearest.index}`)) {
        data[key] = nearest.text.trim();
        extracted.push(key);
        taken.add(`${nearest.index}`);
      }
      break;
    }
  }

  // Decode the MRZ on the back face and fill anything still missing.
  if (face === 'back') {
    const mrz = parseMrz(lines.map((l) => l.text));
    for (const [key, value] of Object.entries(mrz) as [keyof CredentialData, string][]) {
      if (!value) continue;
      if (data[key] === undefined || data[key] === '') {
        data[key] = value;
        if (!extracted.includes(key)) extracted.push(key);
      }
    }
  }

  // Normalize dates & sex for fields we know.
  if (data.dateOfBirth) {
    const d = normalizeDate(data.dateOfBirth);
    if (d) data.dateOfBirth = d;
  }
  if (data.dateOfExpiry) {
    const d = normalizeDate(data.dateOfExpiry);
    if (d) data.dateOfExpiry = d;
  }
  if (data.sex) {
    const s = normalizeSex(data.sex);
    if (s) data.sex = s;
  }

  return { data, extracted, rawText: text.text, source: 'ocr' };
}

/** Runs ML Kit text recognition on an image file and parses one face. */
export async function extractFromImage(
  imagePath: string,
  face: ScanFace = 'front',
): Promise<ExtractionResult> {
  const text = await recognizeText(imagePath);
  return parseOcrText(text, face);
}

/** Merges the front and back face results (back fills gaps, never overrides). */
export function mergeFaces(
  front: ExtractionResult | null,
  back: ExtractionResult | null,
): ExtractionResult {
  const data: Partial<CredentialData> = { ...front?.data };
  const extracted = [...(front?.extracted ?? [])];
  if (back) {
    for (const key of back.extracted) {
      if (data[key] === undefined || data[key] === '') {
        data[key] = back.data[key];
        extracted.push(key);
      }
    }
  }
  const rawText = [front?.rawText, back?.rawText].filter(Boolean).join('\n\n');
  const source: 'qr' | 'ocr' =
    front?.source === 'qr' || back?.source === 'qr' ? 'qr' : 'ocr';
  return { data, extracted, rawText, source };
}
