import type { SparkFeedbackKind } from '../../store/sparkFeedbackStore';

export interface SparkFeedbackOption {
  kind: SparkFeedbackKind;
  icon: string;
  title: string;
  subtitle: string;
}

export const SPARK_FEEDBACK_OPTIONS: SparkFeedbackOption[] = [
  {
    kind: 'bug',
    icon: '🛠',
    title: 'Something broke',
    subtitle: 'It crashed, failed, or looks wrong',
  },
  {
    kind: 'feature',
    icon: '💡',
    title: 'I have an idea',
    subtitle: 'A feature I wish existed',
  },
  {
    kind: 'improvement',
    icon: '✨',
    title: 'Make it smoother',
    subtitle: 'It works, but could be easier',
  },
];

export const SPARK_IMPROVEMENT_AREAS = [
  'Receipt',
  'Split',
  'Guests / SMS',
  'Pay',
] as const;

export function sparkNoteTitle(kind: SparkFeedbackKind): string {
  switch (kind) {
    case 'bug':
      return 'Something broke';
    case 'feature':
      return 'I have an idea';
    case 'improvement':
      return 'Make it smoother';
  }
}

export function sparkNotePlaceholder(kind: SparkFeedbackKind): string {
  switch (kind) {
    case 'bug':
      return 'What were you trying to do? What happened instead?';
    case 'feature':
      return 'I wish LetsSplyt could…';
    case 'improvement':
      return 'What felt confusing or slow? (optional if you picked an area)';
  }
}
