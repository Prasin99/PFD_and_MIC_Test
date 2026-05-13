import React, { useState, useMemo, useCallback } from 'react';
import {
  LEVELS,
  PRESETS,
  PRESET_DEFAULT_SECONDS,
  levelsByGroup,
  buildLegsFromSelection,
} from './legs.js';

/**
 * Pre-task settings screen — landscape, two-column layout.
 *
 *   LEFT column   — preset buttons, level checkboxes, seconds-per-level slider
 *   RIGHT column  — what the trainee will actually do: per-channel summary
 *                   built live from the currently-checked levels, plus the
 *                   advanced enable/disable override, language toggle and
 *                   controls reference.
 *   Bottom        — the Start button, centred and prominent.
 *
 * The right column's "Active channels" card is the key bit of UX: as the
 * user ticks / unticks levels, each channel's badge and description update
 * to reflect *exactly* what they're going to be asked to do (maintain,
 * follow, respond to irregular, or a mix). The disable toggle next to each
 * channel is the existing "advanced override" — useful when an LMS course
 * needs to strip a channel from otherwise-active levels.
 *
 * Settings handed to onStart:
 *   { legs, duration, locale, difficulty, enableAltitude, enableHeading, enableSpeed }
 */

const T = {
  en: {
    title:           'PFD Tracking',
    blurb:           'Hold altitude, heading, and speed within their green tolerance bands. Disturbance pushes the aircraft off — your job is to compensate.',
    presets:         'Presets',
    levels:          'Levels',
    secondsLevel:    'seconds per level',
    selectAll:       'select all',
    selectNone:      'select none',
    activeChannels:  'Active channels',
    activeChDescr:   "What you'll be doing during the session",
    altitude:        'Altitude',
    heading:         'Heading',
    speed:           'Airspeed',
    language:        'Language',
    controls:        'Controls',
    joystick:        '🕹 Joystick / HOTAS (priority)',
    keyboard:        '⌨ Keyboard fallback',
    start:           'Start',
    chooseLevel:     'Select at least one level to start.',
    sessionLen:      'Session: {n} level{plural} · {min}:{sec} total',
    forcedOff:       'forced off',
    statusActive:    'active',
    statusInactive:  'inactive',
    statusMixed:     'mixed',
    presetAll:       'all',
    presetEasy:      'easy',
    presetMedium:    'medium',
    presetHard:      'hard',
    presetExpert:    'expert',
    modeMaintain:    'maintain',
    modeConsistent:  'follow instructions',
    modeIrregular:   'irregular updates',
    modeInactive:    'inactive',
    descMaintain:    'Target stays fixed. Disturbance pushes you off — hold value at target.',
    descConsistent:  'Target drifts smoothly. Follow it with continuous corrections.',
    descIrregular:   'Target jumps to new values every few seconds. React promptly.',
    descInactive:    'Not active in this session.',
    descMixed:       'Different levels use different behaviours.',
    descForcedOff:   'Override: this channel is disabled regardless of level configuration.',
    overrideOn:      'Channel enabled',
    overrideOff:     'Channel disabled — toggle to enable',
    altCtl:          'Altitude — stick fwd/back · ↑↓',
    hdgCtl:          'Heading — stick L/R · ←→',
    spdCtl:          'Airspeed — throttle / LT-RT · Q/A',
  },
  de: {
    title:           'PFD Tracking',
    blurb:           'Halte Höhe, Kurs und Geschwindigkeit in ihren grünen Toleranzbändern. Störungen drücken das Flugzeug ab — du kompensierst.',
    presets:         'Voreinstellungen',
    levels:          'Level',
    secondsLevel:    'Sekunden pro Level',
    selectAll:       'alle auswählen',
    selectNone:      'keine auswählen',
    activeChannels:  'Aktive Kanäle',
    activeChDescr:   'Was du in dieser Session tust',
    altitude:        'Höhe',
    heading:         'Kurs',
    speed:           'Geschwindigkeit',
    language:        'Sprache',
    controls:        'Steuerung',
    joystick:        '🕹 Joystick / HOTAS (Priorität)',
    keyboard:        '⌨ Tastatur',
    start:           'Starten',
    chooseLevel:     'Mindestens ein Level auswählen.',
    sessionLen:      'Session: {n} Level · {min}:{sec} gesamt',
    forcedOff:       'manuell aus',
    statusActive:    'aktiv',
    statusInactive:  'inaktiv',
    statusMixed:     'gemischt',
    presetAll:       'alle',
    presetEasy:      'einfach',
    presetMedium:    'mittel',
    presetHard:      'schwer',
    presetExpert:    'experte',
    modeMaintain:    'halten',
    modeConsistent:  'Anweisungen folgen',
    modeIrregular:   'unregelmäßige Updates',
    modeInactive:    'inaktiv',
    descMaintain:    'Sollwert fest. Störung drückt ab — am Sollwert halten.',
    descConsistent:  'Sollwert driftet langsam. Mit feinen Korrekturen folgen.',
    descIrregular:   'Sollwert springt alle paar Sekunden. Schnell reagieren.',
    descInactive:    'In dieser Session nicht aktiv.',
    descMixed:       'Unterschiedliche Level haben unterschiedliches Verhalten.',
    descForcedOff:   'Override: Kanal ist deaktiviert, unabhängig von Level-Konfiguration.',
    overrideOn:      'Kanal aktiv',
    overrideOff:     'Kanal deaktiviert — Klicken zum Aktivieren',
    altCtl:          'Höhe — Stick vor/zurück · ↑↓',
    hdgCtl:          'Kurs — Stick L/R · ←→',
    spdCtl:          'Geschwindigkeit — Schub / LT-RT · Q/A',
  },
};

const PRESET_KEYS = {
  all: 'presetAll', easy: 'presetEasy', medium: 'presetMedium',
  hard: 'presetHard', expert: 'presetExpert',
};

const MODE_KEYS = {
  maintain:   'modeMaintain',
  consistent: 'modeConsistent',
  irregular:  'modeIrregular',
  inactive:   'modeInactive',
};
const DESC_KEYS = {
  maintain:   'descMaintain',
  consistent: 'descConsistent',
  irregular:  'descIrregular',
  inactive:   'descInactive',
  mixed:      'descMixed',
};

export function PFDTrackingSetup({ onStart, defaults = {} }) {
  // ── State ─────────────────────────────────────────────────────────
  const [selectedPreset, setSelectedPreset] = useState(defaults.preset ?? 'easy');
  const [checkedLevels, setCheckedLevels] = useState(() => {
    const init = defaults.checkedLevels;
    if (Array.isArray(init) && init.length) return new Set(init);
    return new Set(levelsByGroup('easy').map((l) => l.id));
  });
  const [secondsPerLevel, setSecondsPerLevel] =
    useState(defaults.secondsPerLevel ?? PRESET_DEFAULT_SECONDS.easy);
  const [locale,         setLocale]         = useState(defaults.locale ?? 'en');
  const [enableAltitude, setEnableAltitude] = useState(defaults.enableAltitude ?? true);
  const [enableHeading,  setEnableHeading]  = useState(defaults.enableHeading ?? true);
  const [enableSpeed,    setEnableSpeed]    = useState(defaults.enableSpeed ?? true);

  const t = (k, vars = {}) => {
    let s = T[locale]?.[k] ?? T.en[k] ?? k;
    for (const [name, val] of Object.entries(vars)) s = s.replace(`{${name}}`, val);
    return s;
  };

  // Levels visible in the current preset filter
  const visibleLevels = useMemo(() => (
    selectedPreset === 'all' ? LEVELS : levelsByGroup(selectedPreset)
  ), [selectedPreset]);

  // ── Active-channel summary (driven by checked levels + overrides) ──
  // For each channel, collect the set of modes used across the selected
  // levels. The badge + description in the right panel show:
  //   - inactive : no selected level uses this channel
  //   - <mode>   : every selected level uses the same mode
  //   - mixed    : selected levels use different modes
  // If the user has flipped the per-channel override off, that wins —
  // the channel is shown as "forced off".
  const channelSummary = useMemo(() => {
    const channels = ['altitude', 'heading', 'speed'];
    const overrides = { altitude: enableAltitude, heading: enableHeading, speed: enableSpeed };
    const result = {};
    for (const ch of channels) {
      const modes = new Set();
      for (const lvl of LEVELS) {
        if (checkedLevels.has(lvl.id)) modes.add(lvl.mode[ch]);
      }
      const active = [...modes].filter((m) => m !== 'inactive');
      let status;
      if (!overrides[ch])         status = 'forced-off';
      else if (active.length === 0) status = 'inactive';
      else if (active.length === 1) status = active[0];
      else                          status = 'mixed';
      result[ch] = { status, modes: active };
    }
    return result;
  }, [checkedLevels, enableAltitude, enableHeading, enableSpeed]);

  // ── Preset / level handlers ───────────────────────────────────────
  const pickPreset = useCallback((preset) => {
    setSelectedPreset(preset);
    const groupLevels = preset === 'all' ? LEVELS : levelsByGroup(preset);
    setCheckedLevels(new Set(groupLevels.map((l) => l.id)));
    if (preset !== 'all') setSecondsPerLevel(PRESET_DEFAULT_SECONDS[preset]);
  }, []);

  const toggleLevel = useCallback((id) => {
    setCheckedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const allVisibleChecked = visibleLevels.every((l) => checkedLevels.has(l.id));
  const toggleAllVisible = useCallback(() => {
    setCheckedLevels((prev) => {
      const next = new Set(prev);
      if (allVisibleChecked) for (const l of visibleLevels) next.delete(l.id);
      else                   for (const l of visibleLevels) next.add(l.id);
      return next;
    });
  }, [allVisibleChecked, visibleLevels]);

  // ── Derived ───────────────────────────────────────────────────────
  const checkedCount = checkedLevels.size;
  const totalSec     = checkedCount * secondsPerLevel;
  const totalMin     = Math.floor(totalSec / 60);
  const totalRemSec  = totalSec % 60;
  const canStart     = checkedCount > 0;

  const start = () => {
    if (!canStart) return;
    const legs = buildLegsFromSelection([...checkedLevels], secondsPerLevel);
    const order = ['easy', 'medium', 'hard', 'expert'];
    let difficulty = 'easy';
    for (const lvl of LEVELS) {
      if (!checkedLevels.has(lvl.id)) continue;
      if (order.indexOf(lvl.group) > order.indexOf(difficulty)) difficulty = lvl.group;
    }
    const cfgDifficulty = difficulty === 'expert' ? 'hard' : difficulty;
    onStart({
      legs,
      duration: totalSec,
      difficulty: cfgDifficulty,
      enableAltitude,
      enableHeading,
      enableSpeed,
      locale,
    });
  };

  const SLIDER_MIN = 15, SLIDER_MAX = 300, SLIDER_STEP = 15;

  // ── Channel-row helper ────────────────────────────────────────────
  const ChannelRow = ({ chKey, labelKey, ctlKey, enabled, setEnabled }) => {
    const { status } = channelSummary[chKey];
    const isOff      = status === 'forced-off' || status === 'inactive';
    const statusLabel = status === 'forced-off' ? t('forcedOff')
                      : status === 'inactive'   ? t('statusInactive')
                      : status === 'mixed'      ? t('statusMixed')
                      : t(MODE_KEYS[status]);
    const descKey = status === 'forced-off' ? 'descForcedOff'
                  : DESC_KEYS[status === 'mixed' ? 'mixed'
                            : status === 'inactive' ? 'inactive'
                            : status];
    // Status pill colour: green for an active mode, slate for inactive/off,
    // amber for mixed (so the user notices when selection is heterogeneous)
    const pillCls =
      status === 'forced-off' ? 'bg-slate-200 text-slate-600 line-through'
    : status === 'inactive'   ? 'bg-slate-100 text-slate-500'
    : status === 'mixed'      ? 'bg-amber-100 text-amber-800'
    : status === 'maintain'   ? 'bg-emerald-100 text-emerald-800'
    : status === 'consistent' ? 'bg-blue-100 text-blue-800'
    : status === 'irregular'  ? 'bg-rose-100 text-rose-800'
    : 'bg-slate-100 text-slate-600';
    return (
      <div className={`px-3 py-3 border rounded transition ${
        isOff ? 'bg-slate-50/60 border-slate-200' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
              isOff ? 'bg-slate-300' : 'bg-emerald-500'
            }`} />
            <span className={`text-base font-semibold ${
              isOff ? 'text-slate-500' : 'text-slate-800'
            }`}>{t(labelKey)}</span>
            <span className={`text-xs font-mono uppercase tracking-wide px-1.5 py-0.5 rounded ${pillCls}`}>
              {statusLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            title={enabled ? t('overrideOn') : t('overrideOff')}
            className={`text-sm px-2 py-0.5 rounded border transition ${
              enabled
                ? 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                : 'bg-slate-700 border-slate-700 text-white hover:bg-slate-800'
            }`}
          >
            {enabled ? 'on' : 'off'}
          </button>
        </div>
        <div className="text-sm text-slate-600 leading-snug pl-4">
          {t(descKey)}
        </div>
        <div className="text-[11px] text-slate-400 pl-4 mt-1 font-mono">
          {t(ctlKey)}
        </div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-gray-50 p-6">
      <div className="bg-white rounded-lg shadow border border-gray-200 w-full max-w-[1600px] mx-auto p-10 flex flex-col">
        <div className="mb-8">
          <h1 className="text-4xl font-semibold text-gray-900">{t('title')}</h1>
          <p className="text-base text-gray-500 mt-1">{t('blurb')}</p>
        </div>

        {/* Two-column landscape layout. On narrow screens it falls back to a
            single column so the page is still usable on small displays. */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10">

          {/* ── LEFT: selection ─────────────────────────────────────── */}
          <div>
            {/* PRESETS */}
            <section className="mb-5">
              <h2 className="text-base font-semibold text-gray-700 mb-2">{t('presets')}</h2>
              <div className="flex flex-wrap gap-2">
                {['all', ...PRESETS].map((p) => {
                  const active = selectedPreset === p;
                  return (
                    <button
                      key={p}
                      onClick={() => pickPreset(p)}
                      className={`px-4 py-2 rounded-full text-base border transition ${
                        active
                          ? 'bg-blue-100 text-blue-900 border-blue-300 font-medium'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {active && <span className="mr-1">✓</span>}
                      {t(PRESET_KEYS[p])}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* LEVELS */}
            <section className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-semibold text-gray-700">{t('levels')}</h2>
                <button
                  type="button"
                  onClick={toggleAllVisible}
                  className="text-sm text-blue-600 hover:text-blue-800 underline-offset-2 hover:underline"
                >
                  {allVisibleChecked ? t('selectNone') : t('selectAll')}
                </button>
              </div>
              <ul className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                {visibleLevels.map((lvl) => {
                  const checked = checkedLevels.has(lvl.id);
                  return (
                    <li key={lvl.id}>
                      <label className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                        checked
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}>
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-blue-600"
                          checked={checked}
                          onChange={() => toggleLevel(lvl.id)}
                        />
                        <span className="text-base font-mono font-semibold text-gray-700 w-6 flex-shrink-0">
                          {lvl.id}
                        </span>
                        <span className="text-base text-gray-800">
                          {lvl.label[locale] ?? lvl.label.en}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {!canStart && (
                <p className="mt-2 text-sm text-red-600">{t('chooseLevel')}</p>
              )}
            </section>

            {/* SECONDS PER LEVEL */}
            <section>
              <div className="flex items-center justify-between mb-1">
                <label className="text-base font-medium text-gray-700">
                  {t('secondsLevel')}:{' '}
                  <span className="font-mono font-semibold text-gray-900">{secondsPerLevel}</span>
                </label>
                <span className="text-sm text-gray-500">
                  {canStart && t('sessionLen', {
                    n: checkedCount,
                    plural: locale === 'en' && checkedCount !== 1 ? 's' : '',
                    min: totalMin,
                    sec: String(totalRemSec).padStart(2, '0'),
                  })}
                </span>
              </div>
              <input
                type="range"
                min={SLIDER_MIN}
                max={SLIDER_MAX}
                step={SLIDER_STEP}
                value={secondsPerLevel}
                onChange={(e) => setSecondsPerLevel(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
            </section>
          </div>

          {/* ── RIGHT: active channels + meta ──────────────────────── */}
          <div className="space-y-5">

            <section>
              <h2 className="text-base font-semibold text-gray-700">{t('activeChannels')}</h2>
              <p className="text-sm text-gray-500 mb-2">{t('activeChDescr')}</p>
              <div className="space-y-2">
                <ChannelRow
                  chKey="altitude" labelKey="altitude" ctlKey="altCtl"
                  enabled={enableAltitude} setEnabled={setEnableAltitude}
                />
                <ChannelRow
                  chKey="heading"  labelKey="heading"  ctlKey="hdgCtl"
                  enabled={enableHeading}  setEnabled={setEnableHeading}
                />
                <ChannelRow
                  chKey="speed"    labelKey="speed"    ctlKey="spdCtl"
                  enabled={enableSpeed}    setEnabled={setEnableSpeed}
                />
              </div>
            </section>

          </div>
        </div>

        {/* ── BOTTOM: Start ────────────────────────────────────────── */}
        <div className="mt-8 flex justify-center">
          <button
            className={`px-12 py-3 text-lg font-medium rounded shadow transition flex items-center gap-2 ${
              canStart
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            onClick={start}
            disabled={!canStart}
          >
            <span className="text-xs">▶</span>
            {t('start')}
          </button>
        </div>
      </div>
    </div>
  );
}
