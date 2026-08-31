// Conversion router coordinating engines and worker offloading

import { NativeRasterEngine } from './engines/native-engine.js';
import { SvgEngine } from './engines/svg-engine.js';
import { FaviconEngine } from './engines/favicon-engine.js';
import { AdvancedEngine } from './engines/advanced-engine.js';

export class ConversionRouter {
    constructor() {
        this.nativeEngine = new NativeRasterEngine();
        this.svgEngine = new SvgEngine();
        this.faviconEngine = new FaviconEngine();
        this.advancedEngine = new AdvancedEngine();
        
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
            svgMode
        } = options;

        onProgress(15, 'ROUTING CONVERSION PIPELINE...');

        // 1. Favicon format route
        if (targetFormat === 'ico') {
            onProgress(40, 'BUILDING MULTI-RES FAVICON...');
            const result = await this.faviconEngine.convert({
                imageSource: sourceImage,
                sizes: icoSizes
            });
            onProgress(90, 'PACKAGING ICO BINARY...');
            return result;
        }

        // 2. SVG output route (vector tracing or embedded vector)
        if (targetFormat === 'svg') {
            const result = await this.svgEngine.rasterToSvg({
                imageSource: sourceImage,
                targetWidth,
                targetHeight,
                mode: svgMode
            }, onProgress);
            return result;
        }

        // 3. SVG input to raster route
        if (sourceFormat === 'svg') {
            onProgress(40, 'RASTERIZING VECTOR CANVAS...');
            const svgText = await sourceFile.text();
            const result = await this.svgEngine.svgToRaster({
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

        // 4. Advanced format route
        if (this.advancedEngine.requiresAdvancedCodec(sourceFormat, targetFormat)) {
            onProgress(35, 'LOADING CODEC MODULE...');
            await this.advancedEngine.loadCodec(targetFormat);
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
