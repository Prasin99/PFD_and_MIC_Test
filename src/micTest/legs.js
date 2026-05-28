/**
 * MIC Test — three difficulty presets matching the SkyTest sample tasks.
 *
 * The user picks one preset on the setup screen and independently chooses
 * which instruments + listening task to include for the run.
 */
export const MIC_LEVELS = [
  {
    id: 'maintain',
    name: 'Maintain instrument indications',
    description:
      'Adjust instruments to the green dot values as exactly as possible. Target values stay fixed.',
    targetMode: 'static',
    difficulty: 'easy',
    duration: 60,
  },
  {
    id: 'consistent',
    name: 'Adjust to consistent updates',
    description:
      'Apply heading and altitude adjustments to continued consistent (clockwise) green dot movements.',
    targetMode: 'consistent',
    difficulty: 'medium',
    duration: 60,
  },
  {
    id: 'irregular',
    name: 'Adjust to irregular updates',
    description:
      'Apply heading and altitude adjustments to irregular green dot movements that may jump clockwise or counter-clockwise.',
    targetMode: 'irregular',
    difficulty: 'hard',
    duration: 60,
  },
];

export const MIC_DEFAULT_LEVEL_ID = 'maintain';