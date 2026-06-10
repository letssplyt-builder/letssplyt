import { useCallback, useEffect, useRef, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DocumentScannerPermissionError,
  scanReceiptDocument,
} from '../../services/document-scanner.service';
import type { EventsStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<EventsStackParamList, 'ReceiptScan'>;

type ScanState = 'launching' | 'error';

export function ReceiptScanScreen({ navigation, route }: Props) {
  const { eventId } = route.params;
  const insets = useSafeAreaInsets();
  const scanStarted = useRef(false);
  const [scanState, setScanState] = useState<ScanState>('launching');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const goToManualEntry = useCallback(() => {
    navigation.replace('SplitEntry', { eventId, mode: 'manual' });
  }, [navigation, eventId]);

  const openScanner = useCallback(async () => {
    setScanState('launching');
    setErrorMessage(null);

    try {
      const imageUri = await scanReceiptDocument();

      if (!imageUri) {
        navigation.goBack();
        return;
      }

      navigation.replace('ReceiptPreview', { eventId, imageUri });
    } catch (err) {
      setScanState('error');
      if (err instanceof DocumentScannerPermissionError) {
        setErrorMessage('Allow camera access to scan your receipt, or enter the total manually.');
        return;
      }

      setErrorMessage('Could not open the document scanner. Try again or enter the total manually.');
    }
  }, [navigation, eventId]);

  useEffect(() => {
    if (scanStarted.current) return;
    scanStarted.current = true;
    void openScanner();
  }, [openScanner]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <StatusBar style="light" />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => navigation.goBack()}
        style={styles.back}
      >
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      {scanState === 'launching' ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.statusText}>Opening scanner…</Text>
          <Text style={styles.hintText}>
            Position the receipt in frame. The scanner will detect edges and crop automatically.
          </Text>
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Scanner unavailable</Text>
          {errorMessage ? <Text style={styles.errorBody}>{errorMessage}</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try scanning again"
            onPress={() => void openScanner()}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skip scanner and enter total manually"
        onPress={goToManualEntry}
        style={styles.manualLink}
      >
        <Text style={styles.manualLinkText}>Enter total manually</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 24,
  },
  back: {
    marginBottom: 24,
  },
  backText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  hintText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
    textAlign: 'center',
  },
  errorTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorBody: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  manualLink: {
    alignSelf: 'center',
    paddingVertical: 12,
  },
  manualLinkText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontWeight: '500',
  },
});
