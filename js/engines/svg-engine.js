// SVG conversion engine: SVG to Raster & Raster to SVG vector tracing

export class SvgEngine {
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

    async rasterToSvg({ imageSource, targetWidth, targetHeight, mode = 'vector-trace' }) {
        const width = targetWidth;
        const height = targetHeight;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(imageSource, 0, 0, width, height);

        let svgContent = '';

        if (mode === 'vector-trace' && width <= 600 && height <= 600) {
            // Quantized path vectorizer
            const imgData = ctx.getImageData(0, 0, width, height);
            const pixels = imgData.data;

            // Map color groups to SVG path definitions
            const colorPaths = new Map();

            // Quantize colors (step by 16 to reduce SVG path count)
            const quantize = (val) => Math.round(val / 16) * 16;

            for (let y = 0; y < height; y++) {
                let startX = 0;
                let curKey = null;

                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    const a = pixels[idx + 3];

                    if (a < 15) {
                        if (curKey && (x - startX) > 0) {
                            this.appendRectToMap(colorPaths, curKey, startX, y, x - startX, 1);
                        }
                        curKey = null;
                        continue;
                    }

                    const r = quantize(pixels[idx]);
                    const g = quantize(pixels[idx + 1]);
                    const b = quantize(pixels[idx + 2]);
                    const key = `rgb(${r},${g},${b})`;

                    if (key !== curKey) {
                        if (curKey && (x - startX) > 0) {
                            this.appendRectToMap(colorPaths, curKey, startX, y, x - startX, 1);
                        }
                        curKey = key;
                        startX = x;
                    }
                }

                if (curKey && (width - startX) > 0) {
                    this.appendRectToMap(colorPaths, curKey, startX, y, width - startX, 1);
                }
            }

            svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;
            svgContent += `<!-- PICSMITH Quantized Vector Output -->\n`;

            for (const [color, pathData] of colorPaths.entries()) {
                svgContent += `<path d="${pathData}" fill="${color}" shape-rendering="crispEdges" />\n`;
            }

            svgContent += `</svg>`;
        } else {
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

    appendRectToMap(map, colorKey, x, y, w, h) {
        const cmd = `M${x} ${y}h${w}v${h}h-${w}z `;
        if (!map.has(colorKey)) {
            map.set(colorKey, cmd);
        } else {
            map.set(colorKey, map.get(colorKey) + cmd);
        }
    }
}
