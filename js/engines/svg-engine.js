// SVG conversion engine (SVG to Raster & Raster to SVG vector tracing)

export class SvgEngine {
    // Convert SVG input into raster formats (PNG, JPG, WebP)
    async svgToRaster({ svgText, targetWidth, targetHeight, format, quality, matteColor }) {
        const width = targetWidth;
        const height = targetHeight;

        const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error('Failed to parse SVG markup.'));
            img.src = url;
        });

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (format === 'jpeg') {
            ctx.fillStyle = matteColor || '#ffffff';
            ctx.fillRect(0, 0, width, height);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        URL.revokeObjectURL(url);

        const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
        const outputBlob = await new Promise(r => canvas.toBlob(r, mime, quality));

        return {
            blob: outputBlob,
            width,
            height,
            format
        };
    }

    // Convert Raster input into SVG
    async rasterToSvg({ imageSource, targetWidth, targetHeight, mode = 'vector-trace' }) {
        const width = targetWidth;
        const height = targetHeight;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(imageSource, 0, 0, width, height);

        let svgContent = '';

        if (mode === 'vector-trace' && width <= 400 && height <= 400) {
            // Group horizontal pixels of identical color into SVG rectangles
            const imgData = ctx.getImageData(0, 0, width, height);
            const pixels = imgData.data;

            svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;
            svgContent += `<!-- PICSMITH Vector Trace Output -->\n`;

            for (let y = 0; y < height; y++) {
                let startX = 0;
                let curColor = null;

                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    const r = pixels[idx];
                    const g = pixels[idx + 1];
                    const b = pixels[idx + 2];
                    const a = pixels[idx + 3] / 255;

                    const color = a > 0.05 ? `rgba(${r},${g},${b},${a.toFixed(2)})` : null;

                    if (color !== curColor) {
                        if (curColor && (x - startX) > 0) {
                            svgContent += `<rect x="${startX}" y="${y}" width="${x - startX}" height="1" fill="${curColor}" />\n`;
                        }
                        curColor = color;
                        startX = x;
                    }
                }

                if (curColor && (width - startX) > 0) {
                    svgContent += `<rect x="${startX}" y="${y}" width="${width - startX}" height="1" fill="${curColor}" />\n`;
                }
            }

            svgContent += `</svg>`;
        } else {
            // High fidelity embedded raster container
            const dataUrl = canvas.toDataURL('image/png');
            svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <!-- PICSMITH High-Res SVG Container -->
  <image width="${width}" height="${height}" xlink:href="${dataUrl}" />
</svg>`;
        }

        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });

        return {
            blob,
            width,
            height,
            format: 'svg'
        };
    }
}
