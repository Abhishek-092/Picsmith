// Conversion router coordinating engines, dynamic lazy-loading and worker offloading

import { NativeRasterEngine } from './engines/native-engine.js';

export class ConversionRouter {
    constructor() {
        this.nativeEngine = new NativeRasterEngine();
        this.worker = null;
        this.initWorker();
    }

    initWorker() {
        if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
            try {
                this.worker = new Worker('workers/converter.worker.js', { type: 'module' });
            } catch {
                this.worker = null;
            }
        }
    }

    async routeConversion(options, onProgress = () => {}) {
        const {
            sourceFile,
            sourceImage,
            sourceFormat,
            targetFormat,
            targetWidth,
            targetHeight,
            quality,
            matteColor,
            icoSizes,
            faviconFit = 'contain',
            svgMode
        } = options;

        onProgress(10, 'ROUTING CONVERSION PIPELINE...');

        // 1. Favicon format route (Dynamic lazy import)
        if (targetFormat === 'ico') {
            onProgress(25, 'LOADING FAVICON ENGINE...');
            const { FaviconEngine } = await import('./engines/favicon-engine.js');
            const faviconEngine = new FaviconEngine();

            onProgress(45, 'BUILDING MULTI-RES FAVICON...');
            const result = await faviconEngine.convert({
                imageSource: sourceImage,
                sizes: icoSizes,
                fit: faviconFit
            });
            onProgress(90, 'PACKAGING ICO BINARY...');
            return result;
        }

        // 2. SVG output route (Dynamic lazy import)
        if (targetFormat === 'svg') {
            onProgress(20, 'LOADING VECTOR ENGINE...');
            const { SvgEngine } = await import('./engines/svg-engine.js');
            const svgEngine = new SvgEngine();

            const result = await svgEngine.rasterToSvg({
                imageSource: sourceImage,
                targetWidth,
                targetHeight,
                mode: svgMode
            }, onProgress);
            return result;
        }

        // 3. SVG input to raster route (Dynamic lazy import)
        if (sourceFormat === 'svg') {
            onProgress(25, 'LOADING SVG RASTERIZER...');
            const { SvgEngine } = await import('./engines/svg-engine.js');
            const svgEngine = new SvgEngine();

            onProgress(45, 'RASTERIZING VECTOR CANVAS...');
            const svgText = await sourceFile.text();
            const result = await svgEngine.svgToRaster({
                svgText,
                targetWidth,
                targetHeight,
                format: targetFormat,
                quality,
                matteColor
            });
            onProgress(90, 'ENCODING RASTER STREAM...');
            return result;
        }

        // 4. Advanced format route (TIFF / Advanced codecs)
        if (sourceFormat === 'tiff' || targetFormat === 'tiff') {
            onProgress(30, 'LOADING ADVANCED CODEC...');
            const { AdvancedEngine } = await import('./engines/advanced-engine.js');
            const advancedEngine = new AdvancedEngine();
            await advancedEngine.loadCodec(targetFormat);
        }

        // 5. Worker offloaded raster conversion (if supported)
        if (this.worker && typeof createImageBitmap === 'function') {
            try {
                onProgress(30, 'DISPATCHING TO WEB WORKER...');
                const imageBitmap = await createImageBitmap(sourceFile);
                const workerResult = await this.convertWithWorker(imageBitmap, {
                    targetWidth,
                    targetHeight,
                    format: targetFormat,
                    quality,
                    matteColor
                }, onProgress);
                return workerResult;
            } catch {
                // Fallback to main thread native engine
            }
        }

        // 6. Native main-thread raster engine
        onProgress(50, `ENCODING ${targetFormat.toUpperCase()} PIXELS...`);
        const result = await this.nativeEngine.convert({
            imageSource: sourceImage,
            targetWidth,
            targetHeight,
            format: targetFormat,
            quality,
            matteColor
        });

        onProgress(90, 'FINALIZING ARTIFACT...');
        return result;
    }

    convertWithWorker(imageBitmap, payload, onProgress) {
        return new Promise((resolve, reject) => {
            const jobId = Math.random().toString(36).substring(2, 9);

            const handleMessage = (e) => {
                const { id, type, progress, stage, payload: resPayload, error } = e.data;
                if (id !== jobId) return;

                if (type === 'PROGRESS') {
                    onProgress(progress, stage.replace(/_/g, ' '));
                } else if (type === 'SUCCESS') {
                    this.worker.removeEventListener('message', handleMessage);
                    resolve(resPayload);
                } else if (type === 'ERROR') {
                    this.worker.removeEventListener('message', handleMessage);
                    reject(new Error(error));
                }
            };

            this.worker.addEventListener('message', handleMessage);
            this.worker.postMessage({
                id: jobId,
                type: 'CONVERT',
                payload: { imageBitmap, ...payload }
            }, [imageBitmap]);
        });
    }
}
