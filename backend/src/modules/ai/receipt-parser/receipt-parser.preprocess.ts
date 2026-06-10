import sharp from 'sharp';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function assertImageSize(sizeBytes: number): void {
  if (sizeBytes > MAX_IMAGE_BYTES) {
    throw new Error(`Receipt image exceeds maximum size of ${MAX_IMAGE_BYTES} bytes`);
  }
}

export async function preprocessReceiptImage(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, 'base64');
  assertImageSize(buffer.byteLength);

  const processed = await sharp(buffer)
    .rotate()
    .resize(2048, 2048, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .normalize()
    .sharpen()
    .jpeg({ quality: 85 })
    .toBuffer();

  return processed.toString('base64');
}
