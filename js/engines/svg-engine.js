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

        let svgContent = '';

        if (mode === 'vector-trace') {
            // Downsample trace grid to max 256px to keep vector XML compact
            const maxTraceDim = 256;
            let traceW = width;
            let traceH = height;
            if (traceW > maxTraceDim || traceH > maxTraceDim) {
                if (traceW >= traceH) {
                    traceH = Math.max(1, Math.round((traceH / traceW) * maxTraceDim));
                    traceW = maxTraceDim;
                } else {
                    traceW = Math.max(1, Math.round((traceW / traceH) * maxTraceDim));
                    traceH = maxTraceDim;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = traceW;
            canvas.height = traceH;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'medium';
            ctx.drawImage(imageSource, 0, 0, traceW, traceH);

            let imgData = ctx.getImageData(0, 0, traceW, traceH);

            // Attempt WASM quantization
            try {
                const { quantizePixelsWasm } = await import('../../wasm/codecs/pixel-transformer.js');
                imgData = await quantizePixelsWasm(imgData, 24);
            } catch {
                // Fallback
            }

            const pixels = imgData.data;
            const colorPaths = new Map();
            const quantize = (val) => Math.round(val / 24) * 24;

            const scaleX = width / traceW;
            const scaleY = height / traceH;

            for (let y = 0; y < traceH; y++) {
                let startX = 0;
                let curKey = null;

                for (let x = 0; x < traceW; x++) {
                    const idx = (y * traceW + x) * 4;
                    const a = pixels[idx + 3];

                    if (a < 20) {
                        if (curKey && (x - startX) > 0) {
                            this.appendScaledRect(colorPaths, curKey, startX, y, x - startX, 1, scaleX, scaleY);
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
                            this.appendScaledRect(colorPaths, curKey, startX, y, x - startX, 1, scaleX, scaleY);
                        }
                        curKey = key;
                        startX = x;
                    }
                }

                if (curKey && (traceW - startX) > 0) {
                    this.appendScaledRect(colorPaths, curKey, startX, y, traceW - startX, 1, scaleX, scaleY);
                }
            }

            svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;
            svgContent += `<!-- PICSMITH Optimized Vector Output -->\n`;

            for (const [color, pathData] of colorPaths.entries()) {
                svgContent += `<path d="${pathData}" fill="${color}" shape-rendering="crispEdges" />\n`;
            }

            svgContent += `</svg>`;
        } else {
            // High fidelity embedded container
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imageSource, 0, 0, width, height);

            // Use WebP if supported for smaller embedded payload, fallback to PNG
            let dataUrl;
            try {
                dataUrl = canvas.toDataURL('image/webp', 0.9);
                if (!dataUrl.startsWith('data:image/webp')) {
                    dataUrl = canvas.toDataURL('image/png');
                }
            } catch {
                dataUrl = canvas.toDataURL('image/png');
            }

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

    appendScaledRect(map, colorKey, x, y, w, h, sx, sy) {
        const rx = +(x * sx).toFixed(1);
        const ry = +(y * sy).toFixed(1);
        const rw = +(w * sx).toFixed(1);
        const rh = +(h * sy).toFixed(1);
        const cmd = `M${rx} ${ry}h${rw}v${rh}h-${rw}z `;

        if (!map.has(colorKey)) {
            map.set(colorKey, cmd);
        } else {
            map.set(colorKey, map.get(colorKey) + cmd);
        }
    }
}
