import sharp from 'sharp';
import fetch from 'node-fetch';
export const resizeImage = async (imageUrl) => {
    try {
        // Fetch the image
        const response = await fetch(imageUrl);
        const imageBuffer = await response.arrayBuffer();
        // Resize image to 150x150 while maintaining aspect ratio
        const resizedImageBuffer = await sharp(Buffer.from(imageBuffer))
            .resize(150, 150, {
            fit: 'inside',
            withoutEnlargement: true,
        })
            .toBuffer();
        // Convert to base64
        const base64Image = `data:image/jpeg;base64,${resizedImageBuffer.toString('base64')}`;
        return base64Image;
    }
    catch (error) {
        console.error('Error resizing image:', error);
        throw new Error('Failed to process image');
    }
};
