// zod-skeemat varmuuskopion ja synkronointitiedoston tuonnille (SPEC 10).
// looseObject säilyttää tuntemattomat kentät, jotta tuonti ei muuta dataa (tarkistussumma).
// Tyhjennetty poistomerkintä sisältää vain tunnisteen ja synkronointikentät.

import { z } from 'zod';

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ts = z.string().min(1);
const sync = { updatedAt: ts, updatedBy: z.string().min(1), deletedAt: ts.optional() };
const shares = z.object({ light: z.number().min(0).max(1), moderate: z.number().min(0).max(1), vigorous: z.number().min(0).max(1) });
const minutes = z.object({ light: z.number().min(0), moderate: z.number().min(0), vigorous: z.number().min(0) });
/** Pienennetty kuva (lisäys 16): vain base64-kuva-data-URL, ei ulkoisia osoitteita. */
const photo = z.string().max(300_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/);
const category = z.enum(['hobby', 'school_pe', 'school_recess', 'commute', 'self_directed', 'family', 'other']);

/** Tyhjennetty poistomerkintä (profiilin poisto): vain avain ja synkronointikentät. */
const tombstone = (key: 'id' | 'sessionId' | 'plannedSessionId') => z.looseObject({ [key]: z.string().min(1), updatedAt: ts, updatedBy: z.string().min(1), deletedAt: ts });

const either = <T extends z.ZodType>(full: T, key: 'id' | 'sessionId' | 'plannedSessionId' = 'id') => z.union([full, tombstone(key)]);

export const profileSchema = either(
  z.looseObject({
    id: z.string().min(1),
    name: z.string(),
    kind: z.enum(['child', 'adult']),
    birthYear: z.number().int(),
    birthMonth: z.number().int().min(1).max(12),
    schoolStart: z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }).optional(),
    groupOverride: z.enum(['early_years', 'school_age', 'adult']).optional(),
    color: z.string(),
    photo: photo.optional(),
    trackingStart: iso.optional(),
    football: z.boolean().optional(),
    sortOrder: z.number(),
    archived: z.boolean(),
    createdAt: ts,
    ...sync,
  }),
);

export const activityTypeSchema = either(
  z.looseObject({
    id: z.string().min(1),
    key: z.string().optional(),
    name: z.string(),
    icon: z.string(),
    category,
    movementGroup: z.string(),
    shares,
    muscleDefault: z.enum(['yes', 'ask', 'no']),
    boneDefault: z.enum(['yes', 'ask', 'no']),
    usesPlayedMinutes: z.boolean(),
    builtIn: z.boolean(),
    archived: z.boolean(),
    sortOrder: z.number(),
    ...sync,
  }),
);

export const estimateSchema = either(
  z.looseObject({
    id: z.string().min(1),
    profileId: z.string(),
    category,
    label: z.string(),
    weekdayMin: z.number().min(0),
    weekendMin: z.number().min(0),
    shares,
    validFrom: iso,
    validTo: iso.optional(),
    createdAt: ts,
    ...sync,
  }),
);

export const templateItemSchema = either(
  z.looseObject({
    id: z.string().min(1),
    profileId: z.string(),
    activityTypeId: z.string(),
    weekdays: z.array(z.number().int().min(1).max(7)),
    durationMin: z.number().min(0),
    validFrom: iso,
    validTo: iso.optional(),
    active: z.boolean(),
    createdAt: ts,
    ...sync,
  }),
);

export const plannedSessionSchema = either(
  z.looseObject({
    id: z.string().min(1),
    profileId: z.string(),
    activityTypeId: z.string(),
    date: iso,
    durationMin: z.number().min(0),
    templateItemId: z.string().optional(),
    status: z.enum(['open', 'done', 'skipped']),
    // Tuntematon syy (uudemman version tiedostosta) luetaan muotoon 'other'.
    skipReason: z.enum(['sick', 'injured', 'cancelled', 'holiday', 'other_commitment', 'other']).catch('other').optional(),
    sessionId: z.string().optional(),
    createdAt: ts,
    ...sync,
  }),
);

export const sessionSchema = either(
  z.looseObject({
    id: z.string().min(1),
    profileId: z.string(),
    activityTypeId: z.string(),
    date: iso,
    durationMin: z.number().min(0),
    playedMin: z.number().min(0).optional(),
    effort: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
    intensitySource: z.enum(['profile', 'manual']),
    sharesSnapshot: shares.optional(),
    minutes,
    muscle: z.boolean(),
    bone: z.boolean(),
    plannedSessionId: z.string().optional(),
    createdAt: ts,
    ...sync,
  }),
);

export const footballDetailsSchema = either(
  z.looseObject({
    sessionId: z.string().min(1),
    attendance: z.enum(['full', 'partial']),
    focusTags: z.array(z.string()),
    parentRating: z.number().int().min(1).max(5).optional(),
    enjoyment: z.number().int().min(1).max(3).optional(),
    games: z.array(z.looseObject({})).optional(),
    ...sync,
  }),
  'sessionId',
);

export const dayFlagSchema = either(
  z.looseObject({ id: z.string().min(1), profileId: z.string(), date: iso, reason: z.enum(['sick', 'travel', 'other']), ...sync }),
);

export const settingsSchema = z.looseObject({
  id: z.literal('settings'),
  vigorousDayMin: z.number(),
  primaryView: z.enum(['logged_plus_estimate', 'logged']),
  backupReminderDays: z.number(),
  holidays: z
    .array(z.looseObject({ id: z.string().min(1), label: z.string(), start: iso, end: iso, profileIds: z.array(z.string()).optional() }))
    .optional(),
  ...sync,
});

const level = z.enum(['elite', 'kilpa', 'haaste']);

export const teamSchema = either(
  z.looseObject({ id: z.string().min(1), profileId: z.string(), name: z.string(), level: level.optional(), photo: photo.optional(), archived: z.boolean(), createdAt: ts, ...sync }),
);

export const fixtureSchema = either(
  z.looseObject({ plannedSessionId: z.string().min(1), level: level.optional(), ...sync }),
  'plannedSessionId',
);

export const clubSchema = either(z.looseObject({ id: z.string().min(1), name: z.string(), logo: photo.optional(), createdAt: ts, ...sync }));

export const metaSchema = z.looseObject({ key: z.string().min(1), value: z.unknown() });

const syncedData = {
  profiles: z.array(profileSchema),
  activityTypes: z.array(activityTypeSchema),
  estimates: z.array(estimateSchema),
  templateItems: z.array(templateItemSchema),
  plannedSessions: z.array(plannedSessionSchema),
  sessions: z.array(sessionSchema),
  footballDetails: z.array(footballDetailsSchema),
  dayFlags: z.array(dayFlagSchema),
  settings: z.array(settingsSchema).default([]),
  // Skeema v2; v1-tiedostoissa näitä ei ole.
  teams: z.array(teamSchema).default([]),
  fixtures: z.array(fixtureSchema).default([]),
  // Skeema v3.
  clubs: z.array(clubSchema).default([]),
};

const header = {
  schemaVersion: z.number().int().min(1),
  appVersion: z.string(),
  exportedAt: ts,
  checksum: z.string().regex(/^sha256:[0-9a-f]{64}$/),
};

export const backupFileSchema = z.object({
  format: z.literal('liikkumisseuranta-backup'),
  ...header,
  data: z.looseObject({ ...syncedData, meta: z.array(metaSchema).default([]) }),
});

export const syncFileSchema = z.object({
  format: z.literal('liikkumisseuranta-sync'),
  ...header,
  deviceId: z.string().min(1),
  deviceRole: z.enum(['pc', 'phone']),
  data: z.looseObject(syncedData),
});

/** Vain otsakkeen tarkistus ennen täyttä validointia (skeemaversio ja muoto). */
export const fileHeaderSchema = z.looseObject({ format: z.string(), schemaVersion: z.number().int() });
