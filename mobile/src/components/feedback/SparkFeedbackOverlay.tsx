import { StyleSheet, View } from 'react-native';
import { SparkFirstVisitHint } from './SparkFirstVisitHint';
import { SparkFeedbackNoteSheet } from './SparkFeedbackNoteSheet';
import { SparkFeedbackPickerSheet } from './SparkFeedbackPickerSheet';
import { SparkRibbon } from './SparkRibbon';
import { useSparkFeedbackStore } from '../../store/sparkFeedbackStore';

/**
 * Global spark feedback UI — ribbon + sheets over main tabs (preview only, no backend).
 */
export function SparkFeedbackOverlay() {
  const ribbonHiddenForSession = useSparkFeedbackStore((state) => state.ribbonHiddenForSession);
  const pickerVisible = useSparkFeedbackStore((state) => state.pickerVisible);
  const noteVisible = useSparkFeedbackStore((state) => state.noteVisible);
  const overlayActive = pickerVisible || noteVisible;

  return (
    <View
      pointerEvents={overlayActive ? 'auto' : 'box-none'}
      style={StyleSheet.absoluteFill}
    >
      {!ribbonHiddenForSession && !overlayActive ? (
        <>
          <SparkFirstVisitHint />
          <SparkRibbon />
        </>
      ) : null}
      <SparkFeedbackPickerSheet />
      <SparkFeedbackNoteSheet />
    </View>
  );
}
