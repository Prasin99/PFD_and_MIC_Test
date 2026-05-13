/**
 * PFD Tracking — level catalogue and leg builders.
 *
 * The module ships twelve numbered training levels organised into four
 * preset groups. Each level has a channel-mode config plus a short
 * bilingual briefing the trainee sees before that leg starts.
 *
 *   EASY   (1–3)   maintain only — gentle warm-up, no moving targets
 *   MEDIUM (4–6)   consistent target drift on heading / altitude
 *   HARD   (7–9)   medium + airspeed must also be maintained
 *   EXPERT (10–12) irregular jumps — the highest-difficulty logic from
 *                  the original "hard" preset, kept as its own group so
 *                  the easy/medium/hard ladder stays clean.
 *
 * Channel modes (defined in flightDynamics.js):
 *   'maintain'   target fixed, disturbance active, user holds
 *   'consistent' target drifts smoothly (OU walk) — "follow instructions"
 *   'irregular'  target jumps to a new offset every few seconds
 *   'inactive'   channel disabled / not scored
 *
 * Backwards compatibility: `buildDifficultyLegs(duration)` still works for
 * any caller (incl. the LMS) that passes a `difficulty` string instead of
 * a hand-picked `legs` array — it resolves to the "headline" level of each
 * group (3, 6, 9).
 */

// ────────────── briefing helpers ──────────────
const TXT = {
  en: {
    maintainHeading:  'Compass: maintain heading',
    maintainAltitude: 'Altimeter: maintain altitude',
    maintainAirspeed: 'Airspeed indicator: maintain',
    followHeading:    'Compass: follow heading instructions',
    followAltitude:   'Altimeter: follow altitude instructions',
    irregularHeading: 'Compass: respond to irregular updates',
    irregularAltitude:'Altimeter: respond to irregular updates',
    inactiveAirspeed: 'Airspeed indicator: inactive',
  },
  de: {
    maintainHeading:  'Kompass: Kurs halten',
    maintainAltitude: 'Höhenmesser: Höhe halten',
    maintainAirspeed: 'Fahrtmesser: halten',
    followHeading:    'Kompass: Kursanweisungen folgen',
    followAltitude:   'Höhenmesser: Höhenanweisungen folgen',
    irregularHeading: 'Kompass: unregelmäßige Updates',
    irregularAltitude:'Höhenmesser: unregelmäßige Updates',
    inactiveAirspeed: 'Fahrtmesser: inaktiv',
  },
};

const br = (keys) => ({
  en: keys.map((k) => TXT.en[k]),
  de: keys.map((k) => TXT.de[k]),
});

// ────────────── the twelve levels ──────────────
export const LEVELS = [
  // ─────────────── EASY ───────────────
  {
    id: 1, group: 'easy',
    label: { en: 'maintain heading',              de: 'Kurs halten' },
    mode:  { heading: 'maintain', altitude: 'inactive', speed: 'inactive' },
    briefing: br(['maintainHeading', 'inactiveAirspeed']),
  },
  {
    id: 2, group: 'easy',
    label: { en: 'maintain altitude',             de: 'Höhe halten' },
    mode:  { heading: 'inactive', altitude: 'maintain', speed: 'inactive' },
    briefing: br(['maintainAltitude', 'inactiveAirspeed']),
  },
  {
    id: 3, group: 'easy',
    label: { en: 'maintain heading and altitude', de: 'Kurs und Höhe halten' },
    mode:  { heading: 'maintain', altitude: 'maintain', speed: 'inactive' },
    briefing: br(['maintainHeading', 'maintainAltitude', 'inactiveAirspeed']),
  },

  // ─────────────── MEDIUM ───────────────
  {
    id: 4, group: 'medium',
    label: { en: 'follow heading instructions, maintain altitude',
             de: 'Kursanweisungen folgen, Höhe halten' },
    mode:  { heading: 'consistent', altitude: 'maintain', speed: 'inactive' },
    briefing: br(['followHeading', 'maintainAltitude', 'inactiveAirspeed']),
  },
  {
    id: 5, group: 'medium',
    label: { en: 'maintain heading, follow altitude instructions',
             de: 'Kurs halten, Höhenanweisungen folgen' },
    mode:  { heading: 'maintain', altitude: 'consistent', speed: 'inactive' },
    briefing: br(['maintainHeading', 'followAltitude', 'inactiveAirspeed']),
  },
  {
    id: 6, group: 'medium',
    label: { en: 'follow heading and altitude instructions',
             de: 'Kurs- und Höhenanweisungen folgen' },
    mode:  { heading: 'consistent', altitude: 'consistent', speed: 'inactive' },
    briefing: br(['followHeading', 'followAltitude', 'inactiveAirspeed']),
  },

  // ─────────────── HARD ───────────────
  {
    id: 7, group: 'hard',
    label: { en: 'follow heading instructions, maintain altitude and airspeed',
             de: 'Kursanweisungen folgen, Höhe und Geschwindigkeit halten' },
    mode:  { heading: 'consistent', altitude: 'maintain', speed: 'maintain' },
    briefing: br(['followHeading', 'maintainAltitude', 'maintainAirspeed']),
  },
  {
    id: 8, group: 'hard',
    label: { en: 'follow altitude instructions, maintain heading and airspeed',
             de: 'Höhenanweisungen folgen, Kurs und Geschwindigkeit halten' },
    mode:  { heading: 'maintain', altitude: 'consistent', speed: 'maintain' },
    briefing: br(['maintainHeading', 'followAltitude', 'maintainAirspeed']),
  },
  {
    id: 9, group: 'hard',
    label: { en: 'follow heading and altitude instructions, maintain airspeed',
             de: 'Kurs- und Höhenanweisungen folgen, Geschwindigkeit halten' },
    mode:  { heading: 'consistent', altitude: 'consistent', speed: 'maintain' },
    briefing: br(['followHeading', 'followAltitude', 'maintainAirspeed']),
  },

  // ─────────────── EXPERT ───────────────
  // Uses 'irregular' target mode — the current highest-difficulty logic
  // in the module. Mirrors the hard structure but with sudden jumps
  // instead of smooth drift.
  {
    id: 10, group: 'expert',
    label: { en: 'respond to irregular heading updates, maintain altitude and airspeed',
             de: 'Unregelmäßige Kursanweisungen, Höhe und Geschwindigkeit halten' },
    mode:  { heading: 'irregular', altitude: 'maintain', speed: 'maintain' },
    briefing: br(['irregularHeading', 'maintainAltitude', 'maintainAirspeed']),
  },
  {
    id: 11, group: 'expert',
    label: { en: 'respond to irregular altitude updates, maintain heading and airspeed',
             de: 'Unregelmäßige Höhenanweisungen, Kurs und Geschwindigkeit halten' },
    mode:  { heading: 'maintain', altitude: 'irregular', speed: 'maintain' },
    briefing: br(['maintainHeading', 'irregularAltitude', 'maintainAirspeed']),
  },
  {
    id: 12, group: 'expert',
    label: { en: 'respond to irregular heading and altitude updates, maintain airspeed',
             de: 'Unregelmäßige Kurs- und Höhenanweisungen, Geschwindigkeit halten' },
    mode:  { heading: 'irregular', altitude: 'irregular', speed: 'maintain' },
    briefing: br(['irregularHeading', 'irregularAltitude', 'maintainAirspeed']),
  },
];

/** Preset display order. */
export const PRESETS = ['easy', 'medium', 'hard', 'expert'];

/** Default seconds-per-level for each preset (matches the SkyTest cadence). */
export const PRESET_DEFAULT_SECONDS = {
  easy:   30,
  medium: 60,
  hard:   90,
  expert: 300,
};

/** All levels in a given preset group, in numeric-id order. */
export function levelsByGroup(group) {
  return LEVELS.filter((l) => l.group === group);
}

/** Look up a level by numeric id. Returns `null` if not found. */
export function levelById(id) {
  return LEVELS.find((l) => l.id === id) ?? null;
}

/**
 * Turn a list of checked level ids into a legs array consumable by
 * PFDTrackingTraining. Levels are emitted in numeric-id order so the
 * session always plays low-to-high.
 */
export function buildLegsFromSelection(checkedIds, secondsPerLevel) {
  const sec = Math.max(5, Math.round(secondsPerLevel));
  const ids = [...new Set(checkedIds)].sort((a, b) => a - b);
  return ids
    .map((id) => levelById(id))
    .filter(Boolean)
    .map((lvl) => ({
      durationSec: sec,
      mode:        lvl.mode,
      briefing:    lvl.briefing,
    }));
}

/**
 * Backwards-compatible difficulty → legs map. Each difficulty resolves to
 * the "headline" level of its preset group (the most-active variant).
 */
export function buildDifficultyLegs(durationSec = 240) {
  const wrap = (lvl) => [{ durationSec, mode: lvl.mode, briefing: lvl.briefing }];
  return {
    easy:   wrap(levelById(3)),  // maintain heading + altitude
    medium: wrap(levelById(6)),  // follow heading + altitude instructions
    hard:   wrap(levelById(9)),  // follow heading + altitude + maintain airspeed
  };
}

export const defaultLegs = buildDifficultyLegs(240).medium;