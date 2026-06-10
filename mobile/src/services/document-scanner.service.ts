import { Platform, PermissionsAndroid } from 'react-native';
import DocumentScanner, {
  ScanDocumentResponseStatus,
} from 'react-native-document-scanner-plugin';

const RECEIPT_SCAN_QUALITY = 85;

export class DocumentScannerPermissionError extends Error {
  constructor() {
    super('Camera permission is required to scan receipts.');
    this.name = 'DocumentScannerPermissionError';
  }
}

/** Launch the native document scanner (VisionKit / ML Kit). Returns cropped image URI or null if cancelled. */
export async function scanReceiptDocument(): Promise<string | null> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new DocumentScannerPermissionError();
    }
  }

  const { scannedImages, status } = await DocumentScanner.scanDocument({
    maxNumDocuments: 1,
    croppedImageQuality: RECEIPT_SCAN_QUALITY,
  });

  if (status === ScanDocumentResponseStatus.Cancel || !scannedImages?.length) {
    return null;
  }

  return scannedImages[0];
}
