// Native browser raster conversion engine

export class NativeRasterEngine {
    async convert({ imageSource, targetWidth, targetHeight, format, quality = 0.85, matteColor }) {
        const width = targetWidth;
        const height = targetHeight;

        // Use standard DOM canvas for 100% reliable hardware-accelerated codec support
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: false });

        // Fill background matte if converting transparent image to JPEG
        if (format === 'jpeg') {
            ctx.fillStyle = matteColor || '#ffffff';
            ctx.fillRect(0, 0, width, height);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
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

    async encodeCanvasToBlob(canvas, mimeType, quality) {
        // 1. Try canvas.toBlob with target quality
        const blob = await new Promise((resolve) => {
            try {
                canvas.toBlob(
                    (b) => resolve(b),
                    mimeType,
                    quality
                );
            } catch {
                resolve(null);
            }
        });

        // Verify the blob was created with the requested MIME type
        if (blob && (blob.type === mimeType || (mimeType === 'image/jpeg' && blob.type === 'image/jpeg') || (mimeType === 'image/webp' && blob.type === 'image/webp'))) {
            return blob;
        }

        // 2. Fallback to toDataURL binary stream if toBlob returned mismatched/null mime
        try {
            const dataUrl = canvas.toDataURL(mimeType, quality);
            if (dataUrl.startsWith(`data:${mimeType}`)) {
                return this.dataUrlToBlob(dataUrl);
            }
        } catch {
            // Continue to fallback
        }

        // 3. Fallback for AVIF to WebP if AVIF is unsupported by browser encoder
        if (mimeType === 'image/avif') {
            const webpBlob = await new Promise((resolve) => {
                canvas.toBlob((b) => resolve(b), 'image/webp', quality);
            });
            if (webpBlob) return webpBlob;
        }

        // 4. Last resort PNG
        return new Promise((resolve, reject) => {
            canvas.toBlob((b) => {
                if (b) resolve(b);
                else reject(new Error(`Failed to encode canvas to ${mimeType}`));
            }, 'image/png');
        });
    }

    dataUrlToBlob(dataUrl) {
        const parts = dataUrl.split(',');
        const mime = parts[0].match(/:(.*?);/)[1];
        const binary = atob(parts[1]);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
        }
        return new Blob([array], { type: mime });
    }
}
