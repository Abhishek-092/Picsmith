// Native browser raster conversion engine

export class NativeRasterEngine {
    constructor() {
        this.supportsOffscreen = typeof OffscreenCanvas !== 'undefined';
    }

    async convert({ imageSource, targetWidth, targetHeight, format, quality, matteColor }) {
        const width = targetWidth;
        const height = targetHeight;

        let canvas;
        let ctx;

        if (this.supportsOffscreen) {
            canvas = new OffscreenCanvas(width, height);
            ctx = canvas.getContext('2d', { willReadFrequently: true });
        } else {
            canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            ctx = canvas.getContext('2d', { willReadFrequently: true });
        }

        // Fill background matte if converting transparent image to JPEG
        if (format === 'jpeg') {
            ctx.fillStyle = matteColor || '#ffffff';
            ctx.fillRect(0, 0, width, height);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw image bitmap or HTMLImageElement
        ctx.drawImage(imageSource, 0, 0, width, height);

        const mimeType = this.mapFormatToMime(format);
        const blob = await this.encodeCanvasToBlob(canvas, mimeType, quality);

        return {
            blob,
            width,
            height,
            format
        };
    }

    mapFormatToMime(format) {
        switch (format) {
            case 'jpeg':
                return 'image/jpeg';
            case 'png':
                return 'image/png';
            case 'webp':
                return 'image/webp';
            case 'avif':
                return 'image/avif';
            case 'bmp':
                return 'image/bmp';
            default:
                return 'image/png';
        }
    }

    encodeCanvasToBlob(canvas, mimeType, quality) {
        if (canvas instanceof OffscreenCanvas && typeof canvas.convertToBlob === 'function') {
            return canvas.convertToBlob({ type: mimeType, quality }).catch(() => {
                // If AVIF fails in OffscreenCanvas, fallback to WebP
                if (mimeType === 'image/avif') {
                    return canvas.convertToBlob({ type: 'image/webp', quality });
                }
                return canvas.convertToBlob({ type: 'image/png' });
            });
        }

        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else if (mimeType === 'image/avif') {
                        // Fallback to WebP if AVIF is unsupported
                        canvas.toBlob((fallbackBlob) => {
                            if (fallbackBlob) resolve(fallbackBlob);
                            else reject(new Error('Canvas blob encoding failed.'));
                        }, 'image/webp', quality);
                    } else {
                        reject(new Error(`Encoding to ${mimeType} is not supported by this browser.`));
                    }
                },
                mimeType,
                quality
            );
        });
    }
}
