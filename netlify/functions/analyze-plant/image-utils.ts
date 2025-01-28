import { MIME_TYPE } from '@jimp/core';

export const validateImageBuffer = (buffer: Buffer) => {
  const signatures: Record<string, MIME_TYPE> = {
    'ffd8ffe0': Jimp.MIME_JPEG,
    '89504e47': Jimp.MIME_PNG,
    '47494638': Jimp.MIME_GIF
  };

  const magic = buffer.subarray(0, 4).toString('hex');
  const mimeType = signatures[magic];

  if (!mimeType) {
    throw new Error(`Unsupported file type: ${magic}`);
  }

  return mimeType;
}; 