// lib/credentialTypes.ts
//
// The structured identity data extracted from a physical ID card and
// stored (encrypted) on-device. Mirrors the fields rendered on the card.

export type CredentialData = {
  surname: string;
  givenName: string;
  sex: string;
  nationality: string;
  dateOfBirth: string;
  placeOfBirth: string;
  idNumber: string;
  placeOfIssue: string;
  dateOfExpiry: string;
  county: string;
  subCounty: string;
  division: string;
  location: string;
  subLocation: string;
};

/**
 * A normalized crop rectangle (all values 0..1 relative to the source
 * image). Stored with the portrait so the card can render just the
 * face region from the full front-card photo.
 */
export type CropRect = { x: number; y: number; w: number; h: number };

/** Fields the user must confirm before the credential can be locked. */
export const REQUIRED_FIELDS: (keyof CredentialData)[] = [
  'surname',
  'givenName',
  'sex',
  'nationality',
  'dateOfBirth',
  'placeOfBirth',
  'idNumber',
  'placeOfIssue',
  'dateOfExpiry',
  'county',
  'subCounty',
  'division',
  'location',
  'subLocation',
];

export const EMPTY_CREDENTIAL: CredentialData = {
  surname: '',
  givenName: '',
  sex: '',
  nationality: '',
  dateOfBirth: '',
  placeOfBirth: '',
  idNumber: '',
  placeOfIssue: '',
  dateOfExpiry: '',
  county: '',
  subCounty: '',
  division: '',
  location: '',
  subLocation: '',
};

export function missingFields(data: Partial<CredentialData>): (keyof CredentialData)[] {
  return REQUIRED_FIELDS.filter((field) => !(data[field] ?? '').trim());
}
