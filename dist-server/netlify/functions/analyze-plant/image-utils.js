import Jimp from 'jimp';
const MIME_TYPES = {
    'ffd8ffe0': Jimp.MIME_JPEG,
    '89504e47': Jimp.MIME_PNG,
    '47494638': Jimp.MIME_GIF
};
export const validateImageBuffer = (buffer) => {
    const magic = buffer.subarray(0, 4).toString('hex');
    const mimeType = MIME_TYPES[magic];
    if (!mimeType) {
        throw new Error(`Unsupported file type: ${magic}`);
    }
    return mimeType;
};
