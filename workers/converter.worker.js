// Web Worker for off-thread image processing and conversion

self.onmessage = async function (e) {
    const { id, type, payload } = e.data;

    if (type === 'CONVERT') {
        try {
            self.postMessage({ id, type: 'PROGRESS', progress: 20, stage: 'DECODING_BITMAP' });

            const { imageBitmap, targetWidth, targetHeight, format, quality, matteColor } = payload;

            self.postMessage({ id, type: 'PROGRESS', progress: 50, stage: 'TRANSFORMING_CANVAS' });

            const canvas = new OffscreenCanvas(targetWidth, targetHeight);
            const ctx = canvas.getContext('2d', { willReadFrequently: false });

            if (format === 'jpeg') {
                ctx.fillStyle = matteColor || '#ffffff';
                ctx.fillRect(0, 0, targetWidth, targetHeight);
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);

            self.postMessage({ id, type: 'PROGRESS', progress: 80, stage: 'ENCODING_BLOB' });

            let mimeType = 'image/png';
            if (format === 'jpeg') mimeType = 'image/jpeg';
            else if (format === 'webp') mimeType = 'image/webp';
            else if (format === 'avif') mimeType = 'image/avif';

            const blob = await canvas.convertToBlob({ type: mimeType, quality });

            // Ensure worker did not silently create wrong format
            if (blob.type !== mimeType && mimeType !== 'image/png') {
                throw new Error(`Worker OffscreenCanvas does not support encoding ${mimeType}`);
            }

            self.postMessage({
                id,
                type: 'SUCCESS',
                payload: {
                    blob,
                    width: targetWidth,
                    height: targetHeight,
                    format
                }
            });
        } catch (error) {
            self.postMessage({
                id,
                type: 'ERROR',
                error: error.message || 'Worker conversion failed.'
            });
        }
    }
};
