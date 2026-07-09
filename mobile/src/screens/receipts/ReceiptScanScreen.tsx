import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DocumentScannerPermissionError,
  scanReceiptDocument,
} from '../../services/document-scanner.service';
import type { EventsStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

type Props = NativeStackScreenProps<EventsStackParamList, 'ReceiptScan'>;

type ScanState = 'launching' | 'error';

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bgGradient[0],
      paddingHorizontal: 24,
    },
    back: {
      marginBottom: 24,
    },
    backText: {
      color: theme.ink2,
      fontSize: 16,
      fontWeight: '600',
      fontFamily: theme.fontBody,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    statusText: {
      color: theme.ink,
      fontSize: 17,
      fontWeight: '600',
      marginTop: 20,
      textAlign: 'center',
      fontFamily: theme.fontBody,
    },
    hintText: {
      color: theme.ink2,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 12,
      textAlign: 'center',
      fontFamily: theme.fontBody,
    },
    errorTitle: {
      color: theme.ink,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 8,
      textAlign: 'center',
      fontFamily: theme.fontBody,
    },
    errorBody: {
      color: theme.ink2,
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
      marginBottom: 20,
      fontFamily: theme.fontBody,
    },
    retryButton: {
      backgroundColor: theme.accent,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: theme.radiusSm,
    },
    retryButtonText: {
      color: theme.accentInk,
      fontWeight: '700',
      fontSize: 15,
      fontFamily: theme.fontBody,
    },
    manualLink: {
      alignSelf: 'center',
      paddingVertical: 12,
    },
    manualLinkText: {
      color: theme.ink2,
      fontSize: 15,
      fontWeight: '500',
      fontFamily: theme.fontBody,
    },
  });
}

export function ReceiptScanScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
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
          <ActivityIndicator color={theme.ink} size="large" />
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
