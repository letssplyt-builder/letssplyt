import { useCallback, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../components/PrimaryButton';
import { isApiRequestError } from '../../services/api';
import * as receiptsService from '../../services/receipts.service';
import type { EventsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<EventsStackParamList, 'ReceiptPreview'>;

type UploadState = 'idle' | 'processing' | 'error';

function receiptFlowErrorMessage(err: unknown, phase: 'upload' | 'parse'): string {
  if (!isApiRequestError(err)) {
    return phase === 'upload'
      ? 'Upload failed. Check your connection and try again.'
      : 'We could not read this receipt. Try again or enter the total manually.';
  }

  if (err.code === 'AI_QUOTA_EXCEEDED') {
    return 'Receipt AI is temporarily unavailable (provider quota). Try again later or enter the total manually.';
  }

  if (err.code === 'PARSE_FAILED' || err.code === 'RECEIPT_UNREADABLE') {
    return err.message;
  }

  return err.message;
}

export function ReceiptPreviewScreen({ navigation, route }: Props) {
  const { eventId, imageUri } = route.params;
  const insets = useSafeAreaInsets();
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{
    uploadUrl: string;
    fileUri: string;
    storagePath: string;
    uploadToken: string;
  } | null>(null);
  const [uploadedStoragePath, setUploadedStoragePath] = useState<string | null>(null);

  const finishAfterParse = useCallback(
    async (
      storagePath: string,
      parseResult: Awaited<ReturnType<typeof receiptsService.parseReceipt>>,
    ) => {
      navigation.replace('ItemReview', {
        eventId,
        storagePath,
        parseResult,
      });
    },
    [navigation, eventId],
  );

  const runParse = useCallback(
    async (storagePath: string) => {
      const parseResult = await receiptsService.parseReceipt(eventId, storagePath);
      await finishAfterParse(storagePath, parseResult);
    },
    [eventId, finishAfterParse],
  );

  const runUpload = useCallback(
    async (
      uploadUrl: string,
      fileUri: string,
      storagePath: string,
      uploadToken: string,
    ) => {
      setUploadState('processing');
      setErrorMessage(null);
      try {
        await receiptsService.uploadReceiptToSignedUrl(
          uploadUrl,
          fileUri,
          storagePath,
          uploadToken,
        );
        setPendingUpload(null);
        setUploadedStoragePath(storagePath);
      } catch (err) {
        setUploadState('error');
        setPendingUpload({ uploadUrl, fileUri, storagePath, uploadToken });
        setErrorMessage(receiptFlowErrorMessage(err, 'upload'));
        return;
      }

      try {
        await runParse(storagePath);
      } catch (err) {
        setUploadState('error');
        setUploadedStoragePath(storagePath);
        setErrorMessage(receiptFlowErrorMessage(err, 'parse'));
      }
    },
    [runParse],
  );

  const handleConfirm = useCallback(async () => {
    if (uploadState === 'processing') return;

    setUploadState('processing');
    setErrorMessage(null);
    setUploadedStoragePath(null);

    try {
      const compressedUri = await receiptsService.compressReceiptImage(imageUri);
      const { upload_url, storage_path, upload_token } =
        await receiptsService.requestUploadUrl(eventId);
      await runUpload(upload_url, compressedUri, storage_path, upload_token);
    } catch (err) {
      if (isApiRequestError(err) && err.code === 'NETWORK_ERROR') {
        setUploadState('error');
        setErrorMessage('No connection. Connect to the internet to upload your receipt.');
        return;
      }

      setUploadState('error');
      setErrorMessage(
        isApiRequestError(err)
          ? err.message
          : 'Could not process the photo. Try again or enter the total manually.',
      );
    }
  }, [eventId, imageUri, runUpload, uploadState]);

  const handleRetryUpload = useCallback(() => {
    if (!pendingUpload) return;
    void runUpload(
      pendingUpload.uploadUrl,
      pendingUpload.fileUri,
      pendingUpload.storagePath,
      pendingUpload.uploadToken,
    );
  }, [pendingUpload, runUpload]);

  const handleRetryParse = useCallback(() => {
    if (!uploadedStoragePath) return;
    setUploadState('processing');
    setErrorMessage(null);
    void runParse(uploadedStoragePath).catch((err) => {
      setUploadState('error');
      setErrorMessage(receiptFlowErrorMessage(err, 'parse'));
    });
  }, [uploadedStoragePath, runParse]);

  const handleRetake = useCallback(() => {
    navigation.replace('ReceiptScan', { eventId });
  }, [navigation, eventId]);

  const goToManualEntry = useCallback(() => {
    navigation.replace('SplitEntry', { eventId, mode: 'manual' });
  }, [navigation, eventId]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Review scan</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <Text style={styles.subtitle}>
        Confirm the receipt is fully visible and readable before we process it.
      </Text>

      <View style={styles.previewFrame}>
        <Image
          accessibilityLabel="Scanned receipt preview"
          source={{ uri: imageUri }}
          resizeMode="contain"
          style={styles.previewImage}
        />
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 12 }]}>
        <PrimaryButton
          label="Use this photo"
          onPress={() => void handleConfirm()}
          loading={uploadState === 'processing'}
          disabled={uploadState === 'processing'}
          accessibilityLabel="Use this photo and upload receipt"
          style={styles.primaryAction}
        />
        <PrimaryButton
          label="Retake"
          variant="inverse"
          onPress={handleRetake}
          disabled={uploadState === 'processing'}
          accessibilityLabel="Retake receipt scan"
          style={styles.secondaryAction}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip and enter total manually"
          onPress={goToManualEntry}
          disabled={uploadState === 'processing'}
          style={styles.manualLink}
        >
          <Text style={styles.manualLinkText}>Enter total manually</Text>
        </Pressable>
      </View>

      {uploadState === 'processing' ? (
        <View style={styles.overlay}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.overlayText}>
            {uploadedStoragePath ? 'Reading receipt…' : 'Uploading receipt…'}
          </Text>
        </View>
      ) : null}

      {uploadState === 'error' && errorMessage ? (
        <View style={[styles.errorBanner, { bottom: insets.bottom + 160 }]}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          {uploadedStoragePath ? (
            <Pressable onPress={handleRetryParse} style={styles.retryLink}>
              <Text style={styles.retryText}>Retry reading receipt</Text>
            </Pressable>
          ) : pendingUpload ? (
            <Pressable onPress={handleRetryUpload} style={styles.retryLink}>
              <Text style={styles.retryText}>Retry upload</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => void handleConfirm()} style={styles.retryLink}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  backText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontWeight: '600',
    minWidth: 56,
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  topBarSpacer: {
    minWidth: 56,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  previewFrame: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  previewImage: {
    flex: 1,
    width: '100%',
  },
  actions: {
    paddingHorizontal: 20,
    gap: 10,
  },
  primaryAction: {
    alignSelf: 'stretch',
  },
  secondaryAction: {
    alignSelf: 'stretch',
  },
  manualLink: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  manualLinkText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontWeight: '500',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  overlayText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  errorBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(220, 38, 38, 0.92)',
    borderRadius: 12,
    padding: 14,
    zIndex: 4,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  retryLink: {
    marginTop: 10,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
