import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PermissionsAndroid, Platform } from 'react-native';
import DocumentScanner, {
  ScanDocumentResponseStatus,
} from 'react-native-document-scanner-plugin';
import {
  DocumentScannerPermissionError,
  scanReceiptDocument,
} from '../../../services/document-scanner.service';

jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(
  PermissionsAndroid.RESULTS.GRANTED,
);

describe('document-scanner.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
    (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
      PermissionsAndroid.RESULTS.GRANTED,
    );
  });

  it('returns cropped image URI on success', async () => {
    const scanMock = DocumentScanner.scanDocument as jest.MockedFunction<
      typeof DocumentScanner.scanDocument
    >;
    scanMock.mockResolvedValueOnce({
      scannedImages: ['file://receipt-cropped.jpg'],
      status: ScanDocumentResponseStatus.Success,
    });

    const uri = await scanReceiptDocument();

    expect(uri).toBe('file://receipt-cropped.jpg');
    expect(scanMock).toHaveBeenCalledWith({
      maxNumDocuments: 1,
      croppedImageQuality: 85,
    });
  });

  it('returns null when user cancels', async () => {
    const scanMock = DocumentScanner.scanDocument as jest.MockedFunction<
      typeof DocumentScanner.scanDocument
    >;
    scanMock.mockResolvedValueOnce({
      scannedImages: [],
      status: ScanDocumentResponseStatus.Cancel,
    });

    const uri = await scanReceiptDocument();

    expect(uri).toBeNull();
  });

  it('requests camera permission on Android before scanning', async () => {
    Platform.OS = 'android';
    const requestMock = PermissionsAndroid.request as jest.MockedFunction<
      typeof PermissionsAndroid.request
    >;
    requestMock.mockResolvedValueOnce(PermissionsAndroid.RESULTS.GRANTED);

    const scanMock = DocumentScanner.scanDocument as jest.MockedFunction<
      typeof DocumentScanner.scanDocument
    >;
    scanMock.mockResolvedValueOnce({
      scannedImages: ['file://receipt-android.jpg'],
      status: ScanDocumentResponseStatus.Success,
    });

    const uri = await scanReceiptDocument();

    expect(requestMock).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.CAMERA);
    expect(uri).toBe('file://receipt-android.jpg');
  });

  it('throws when Android camera permission is denied', async () => {
    Platform.OS = 'android';
    const requestMock = PermissionsAndroid.request as jest.MockedFunction<
      typeof PermissionsAndroid.request
    >;
    requestMock.mockResolvedValueOnce(PermissionsAndroid.RESULTS.DENIED);

    await expect(scanReceiptDocument()).rejects.toBeInstanceOf(DocumentScannerPermissionError);
  });
});
