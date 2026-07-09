import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import { showPushToast } from './pushToastStore';
import { getSparkFeedbackContextLabel } from '../utils/sparkFeedbackNavigation';

export type SparkFeedbackKind = 'bug' | 'feature' | 'improvement';

export interface SparkFeedbackDraft {
  kind: SparkFeedbackKind;
  message: string;
  improvementArea: string | null;
}

interface SparkFeedbackState {
  ribbonHiddenForSession: boolean;
  showFirstVisitHint: boolean;
  hasRibbonPulsed: boolean;
  pickerVisible: boolean;
  noteVisible: boolean;
  draft: SparkFeedbackDraft | null;
  openPicker: () => void;
  openNote: (kind: SparkFeedbackKind) => void;
  closePicker: () => void;
  closeNote: () => void;
  closeAll: () => void;
  hideRibbonForSession: () => void;
  dismissFirstVisitHint: () => void;
  markRibbonPulsed: () => void;
  updateDraftMessage: (message: string) => void;
  updateImprovementArea: (area: string | null) => void;
  submitDraft: () => void;
}

export const useSparkFeedbackStore = create<SparkFeedbackState>((set, get) => ({
  ribbonHiddenForSession: false,
  showFirstVisitHint: true,
  hasRibbonPulsed: false,
  pickerVisible: false,
  noteVisible: false,
  draft: null,

  openPicker: () => {
    get().dismissFirstVisitHint();
    set({ pickerVisible: true, noteVisible: false });
  },

  openNote: (kind) => {
    set({
      pickerVisible: false,
      noteVisible: true,
      draft: { kind, message: '', improvementArea: null },
    });
  },

  closePicker: () => set({ pickerVisible: false }),

  closeNote: () => set({ noteVisible: false, draft: null }),

  closeAll: () => set({ pickerVisible: false, noteVisible: false, draft: null }),

  hideRibbonForSession: () => set({ ribbonHiddenForSession: true, showFirstVisitHint: false }),

  dismissFirstVisitHint: () => set({ showFirstVisitHint: false }),

  markRibbonPulsed: () => set({ hasRibbonPulsed: true }),

  updateDraftMessage: (message) => {
    const draft = get().draft;
    if (!draft) return;
    set({ draft: { ...draft, message } });
  },

  updateImprovementArea: (area) => {
    const draft = get().draft;
    if (!draft) return;
    set({ draft: { ...draft, improvementArea: area } });
  },

  submitDraft: () => {
    const draft = get().draft;
    if (!draft) return;

    const context = getSparkFeedbackContextLabel();
    if (__DEV__) {
      // Preview logging until backend wiring exists.
      // eslint-disable-next-line no-console -- dev-only spark note preview
      console.info('[SparkNote preview]', {
        kind: draft.kind,
        message: draft.message.trim(),
        improvementArea: draft.improvementArea,
        context,
      });
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showPushToast({
      title: 'Spark sent — thank you ✦',
      body: 'Preview only — not sent to the team yet.',
    });
    set({ noteVisible: false, draft: null });
  },
}));

export function openSparkFeedbackPicker(): void {
  useSparkFeedbackStore.getState().openPicker();
}
