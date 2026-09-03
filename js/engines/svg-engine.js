// Comprehensive SVG conversion engine: SVG to Raster & Smooth Bézier Contour Vector Tracing

export class SvgEngine {
    // 1. Convert SVG to Raster (PNG, JPG, WebP)
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

        canvas.width = 0;
        canvas.height = 0;

        return {
            blob: outputBlob,
            width,
            height,
            format
        };
    }

    // 2. Convert Raster to SVG with Multi-Pass Bézier Curve Vector Tracing
    async rasterToSvg({ imageSource, targetWidth, targetHeight, mode = 'vector-trace' }, onProgress = () => {}) {
        const width = targetWidth;
        const height = targetHeight;

        if (mode === 'embed-raster') {
            onProgress(50, 'PACKAGING HIGH-RES SVG CONTAINER...');
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imageSource, 0, 0, width, height);

            let dataUrl;
            try {
                dataUrl = canvas.toDataURL('image/webp', 0.85);
                if (!dataUrl.startsWith('data:image/webp')) {
                    dataUrl = canvas.toDataURL('image/png');
                }
            } catch {
                dataUrl = canvas.toDataURL('image/png');
            }

            const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <!-- PICSMITH High-Res SVG Container -->
  <image width="${width}" height="${height}" xlink:href="${dataUrl}" />
</svg>`;

            canvas.width = 0;
            canvas.height = 0;

            return {
                blob: new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' }),
                width,
                height,
                format: 'svg'
            };
        }

        // True Smooth Bézier Contour Vector Tracing
        onProgress(15, 'SAMPLING COLOR CLUSTERS...');
        await this.delay(20);

        const maxDim = 320;
        let traceW = width;
        let traceH = height;
        if (traceW > maxDim || traceH > maxDim) {
            if (traceW >= traceH) {
                traceH = Math.max(1, Math.round((traceH / traceW) * maxDim));
                traceW = maxDim;
            } else {
                traceW = Math.max(1, Math.round((traceW / traceH) * maxDim));
                traceH = maxDim;
            }
        }

        const canvas = document.createElement('canvas');
        canvas.width = traceW;
        canvas.height = traceH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(imageSource, 0, 0, traceW, traceH);

        const imgData = ctx.getImageData(0, 0, traceW, traceH);
        const pixels = imgData.data;

        onProgress(35, 'DETECTING CONTOUR BOUNDARIES...');
        await this.delay(30);

        // Quantize colors into palette buckets (step of 32 for clean vector posterization)
        const quantizeStep = 32;
        const colorBuckets = new Map();

        for (let y = 0; y < traceH; y++) {
            for (let x = 0; x < traceW; x++) {
                const idx = (y * traceW + x) * 4;
                const a = pixels[idx + 3];
                if (a < 30) continue;

                const r = Math.min(255, Math.round(pixels[idx] / quantizeStep) * quantizeStep);
                const g = Math.min(255, Math.round(pixels[idx + 1] / quantizeStep) * quantizeStep);
                const b = Math.min(255, Math.round(pixels[idx + 2] / quantizeStep) * quantizeStep);
                const key = `rgb(${r},${g},${b})`;

                if (!colorBuckets.has(key)) {
                    colorBuckets.set(key, new Uint8Array(traceW * traceH));
                }
                colorBuckets.get(key)[y * traceW + x] = 1;
            }
        }

        onProgress(60, 'FITTING SMOOTH BÉZIER SPLINES...');
        await this.delay(40);

        const scaleX = width / traceW;
        const scaleY = height / traceH;
        let svgPaths = '';

        // Extract boundary polygon contours and fit Bézier splines
        for (const [color, mask] of colorBuckets.entries()) {
            const loops = this.extractContourLoops(mask, traceW, traceH);
            for (const loop of loops) {
                if (loop.length < 3) continue;
                // Simplify points with RDP algorithm
                const simplified = this.simplifyRDP(loop, 1.2);
                if (simplified.length >= 3) {
                    const bezierPath = this.pointsToBezierPath(simplified, scaleX, scaleY);
                    if (bezierPath) {
                        svgPaths += `  <path d="${bezierPath}" fill="${color}" fill-rule="evenodd" />\n`;
                    }
                }
            }
        }

        onProgress(90, 'COMPOSING FINAL SVG...');
        await this.delay(20);

        const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <!-- PICSMITH Smooth Bézier Vector Tracing -->
${svgPaths}</svg>`;

        canvas.width = 0;
        canvas.height = 0;

        return {
            blob: new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' }),
            width,
            height,
            format: 'svg'
        };
    }

    // Extract closed contour loops from a binary mask using boundary run clustering
    extractContourLoops(mask, width, height) {
        const loops = [];
        const visited = new Uint8Array(width * height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (mask[idx] === 1 && !visited[idx]) {
                    // Trace connected contour perimeter
                    const loop = this.tracePerimeter(mask, visited, x, y, width, height);
                    if (loop && loop.length >= 4) {
                        loops.push(loop);
                    }
                }
            }
        }
        return loops;
    }

    // Moore-Neighbor perimeter tracer
    tracePerimeter(mask, visited, startX, startY, width, height) {
        const loop = [{ x: startX, y: startY }];
        visited[startY * width + startX] = 1;

        let curX = startX;
        let curY = startY;
        let dir = 0;

        // 8-directional offsets
        const dx = [1, 1, 0, -1, -1, -1, 0, 1];
        const dy = [0, 1, 1, 1, 0, -1, -1, -1];

        const maxSteps = 1200;
        let steps = 0;

        while (steps < maxSteps) {
            steps++;
            let found = false;

            for (let i = 0; i < 8; i++) {
                const checkDir = (dir + i) % 8;
                const nx = curX + dx[checkDir];
                const ny = curY + dy[checkDir];

                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    if (mask[ny * width + nx] === 1) {
                        curX = nx;
                        curY = ny;
                        dir = (checkDir + 6) % 8;
                        visited[ny * width + nx] = 1;
                        loop.push({ x: curX, y: curY });
                        found = true;
                        break;
                    }
                }
            }

            if (!found || (curX === startX && curY === startY && loop.length > 3)) {
                break;
            }
        }

        return loop;
    }

    // Ramer-Douglas-Peucker polygon simplification
    simplifyRDP(points, epsilon) {
        if (points.length <= 2) return points;

        let maxDist = 0;
        let index = 0;
        const end = points.length - 1;

        for (let i = 1; i < end; i++) {
            const d = this.perpendicularDistance(points[i], points[0], points[end]);
            if (d > maxDist) {
                index = i;
                maxDist = d;
            }
        }

        if (maxDist > epsilon) {
            const rec1 = this.simplifyRDP(points.slice(0, index + 1), epsilon);
            const rec2 = this.simplifyRDP(points.slice(index), epsilon);
            return rec1.slice(0, rec1.length - 1).concat(rec2);
        } else {
            return [points[0], points[end]];
        }
    }

    perpendicularDistance(p, p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        if (dx === 0 && dy === 0) {
            return Math.hypot(p.x - p1.x, p.y - p1.y);
        }
        const num = Math.abs(dy * p.x - dx * p.y + p2.x * p1.y - p2.y * p1.x);
        return num / Math.hypot(dx, dy);
    }

    // Convert polygon points into smooth cubic Bézier spline SVG commands
    pointsToBezierPath(points, scaleX, scaleY) {
        if (!points || points.length < 3) return '';

        const pts = points.map(p => ({
            x: +(p.x * scaleX).toFixed(1),
            y: +(p.y * scaleY).toFixed(1)
        }));

        let d = `M${pts[0].x} ${pts[0].y}`;
        const n = pts.length;

        // Fit smooth cubic splines using Catmull-Rom tangent projection
        const tension = 0.25;

        for (let i = 0; i < n; i++) {
            const p0 = pts[(i - 1 + n) % n];
            const p1 = pts[i];
            const p2 = pts[(i + 1) % n];
            const p3 = pts[(i + 2) % n];

            const cp1x = +(p1.x + (p2.x - p0.x) * tension).toFixed(1);
            const cp1y = +(p1.y + (p2.y - p0.y) * tension).toFixed(1);
            const cp2x = +(p2.x - (p3.x - p1.x) * tension).toFixed(1);
            const cp2y = +(p2.y - (p3.y - p1.y) * tension).toFixed(1);

            d += ` C${cp1x} ${cp1y},${cp2x} ${cp2y},${p2.x} ${p2.y}`;
        }

        d += ' Z';
        return d;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
