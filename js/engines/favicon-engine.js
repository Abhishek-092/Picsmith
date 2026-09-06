// Favicon package engine with multi-resolution ICO, standardized PNG icons, and site.webmanifest
import { createZipArchive } from '../utils/zip.js';
import { getFileBaseName } from '../utils/filename.js';

export const FAVICON_SPECS = [
    { filename: 'favicon-16x16.png', size: 16, purpose: 'Browser favicon', inIco: true },
    { filename: 'favicon-32x32.png', size: 32, purpose: 'High-density browser favicon', inIco: true },
    { filename: 'favicon-48x48.png', size: 48, purpose: 'Legacy / desktop favicon support', inIco: true },
    { filename: 'apple-touch-icon.png', size: 180, purpose: 'Apple / iOS home screen icon', inIco: false },
    { filename: 'favicon-192x192.png', size: 192, purpose: 'Android / PWA icon', inIco: false },
    { filename: 'favicon-512x512.png', size: 512, purpose: 'High-resolution / PWA splash icon', inIco: false }
];

export class FaviconEngine {
    async convert({ imageSource, baseName = 'favicon', fit = 'contain', onProgress = () => {} }) {
        const imgW = imageSource.naturalWidth || imageSource.width || 100;
        const imgH = imageSource.naturalHeight || imageSource.height || 100;

        const renderedIcons = [];
        const icoBuffers = [];

        // 1. Render all specified resolutions
        for (let i = 0; i < FAVICON_SPECS.length; i++) {
            const spec = FAVICON_SPECS[i];
            const size = spec.size;

            const iconCanvas = document.createElement('canvas');
            iconCanvas.width = size;
            iconCanvas.height = size;
            const ctx = iconCanvas.getContext('2d');

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Fit inside square canvas without distortion
            let dx = 0;
            let dy = 0;
            let dWidth = size;
            let dHeight = size;

            if (fit === 'cover') {
                // Square center-crop (cover)
                const scale = Math.max(size / imgW, size / imgH);
                dWidth = imgW * scale;
                dHeight = imgH * scale;
                dx = (size - dWidth) / 2;
                dy = (size - dHeight) / 2;
            } else {
                // Square contain with centered transparent padding (default)
                const scale = Math.min(size / imgW, size / imgH);
                dWidth = imgW * scale;
                dHeight = imgH * scale;
                dx = (size - dWidth) / 2;
                dy = (size - dHeight) / 2;
            }

            ctx.drawImage(imageSource, dx, dy, dWidth, dHeight);

            const pngBlob = await new Promise(r => iconCanvas.toBlob(r, 'image/png'));
            const arrayBuffer = await pngBlob.arrayBuffer();
            const uint8Data = new Uint8Array(arrayBuffer);

            renderedIcons.push({
                ...spec,
                blob: pngBlob,
                data: uint8Data,
                sizeBytes: uint8Data.length
            });

            // Pack frames meant for multi-resolution favicon.ico (16, 32, 48)
            if (spec.inIco) {
                icoBuffers.push({
                    width: size,
                    height: size,
                    data: uint8Data
                });
            }

            // Clean up canvas
            iconCanvas.width = 0;
            iconCanvas.height = 0;
        }

        // 2. Build multi-resolution favicon.ico (16, 32, 48)
        const icoBlob = this.buildIcoBinary(icoBuffers);
        const icoArrayBuffer = await icoBlob.arrayBuffer();
        const icoUint8Data = new Uint8Array(icoArrayBuffer);

        // 3. Build site.webmanifest JSON
        const appName = getFileBaseName(baseName) || 'PicSmith App';
        const manifestData = {
            name: appName,
            short_name: appName,
            icons: [
                {
                    src: 'favicon-192x192.png',
                    sizes: '192x192',
                    type: 'image/png'
                },
                {
                    src: 'favicon-512x512.png',
                    sizes: '512x512',
                    type: 'image/png'
                }
            ],
            theme_color: '#ffffff',
            background_color: '#ffffff',
            display: 'standalone'
        };
        const manifestJsonString = JSON.stringify(manifestData, null, 2);

        // 4. Assemble files for ZIP archive
        const zipFiles = [
            { name: 'favicon.ico', data: icoUint8Data },
            ...renderedIcons.map(icon => ({ name: icon.filename, data: icon.data })),
            { name: 'site.webmanifest', data: manifestJsonString }
        ];

        const zipBlob = await createZipArchive(zipFiles);

        // Metadata for UI asset list
        const fileList = [
            { name: 'favicon.ico', resolution: '16×16, 32×32, 48×48', size: icoUint8Data.length, purpose: 'Multi-resolution Windows & Browser Favicon' },
            ...renderedIcons.map(i => ({
                name: i.filename,
                resolution: `${i.size}×${i.size}`,
                size: i.sizeBytes,
                purpose: i.purpose
            })),
            { name: 'site.webmanifest', resolution: 'JSON', size: new TextEncoder().encode(manifestJsonString).length, purpose: 'Web App & PWA Manifest' }
        ];

        return {
            blob: icoBlob,
            icoBlob,
            zipBlob,
            files: fileList,
            width: 512,
            height: 512,
            format: 'ico',
            isPackage: true
        };
    }

    buildIcoBinary(imageBuffers) {
        const numImages = imageBuffers.length;
        const headerSize = 6;
        const dirEntrySize = 16;
        let totalSize = headerSize + (dirEntrySize * numImages);

        for (const img of imageBuffers) {
            totalSize += img.data.length;
        }

        const buffer = new Uint8Array(totalSize);
        const view = new DataView(buffer.buffer);

        // ICO Header
        view.setUint16(0, 0, true); // Reserved
        view.setUint16(2, 1, true); // Type 1 = ICO
        view.setUint16(4, numImages, true); // Number of images

        let dataOffset = headerSize + (dirEntrySize * numImages);

        // Directory Entries and Payload placement
        for (let i = 0; i < numImages; i++) {
            const img = imageBuffers[i];
            const entryOffset = headerSize + (i * dirEntrySize);

            buffer[entryOffset + 0] = img.width >= 256 ? 0 : img.width;
            buffer[entryOffset + 1] = img.height >= 256 ? 0 : img.height;
            buffer[entryOffset + 2] = 0; // Palette count
            buffer[entryOffset + 3] = 0; // Reserved
            view.setUint16(entryOffset + 4, 1, true); // Color planes
            view.setUint16(entryOffset + 6, 32, true); // Bits per pixel
            view.setUint32(entryOffset + 8, img.data.length, true); // Data size
            view.setUint32(entryOffset + 12, dataOffset, true); // Data offset

            buffer.set(img.data, dataOffset);
            dataOffset += img.data.length;
        }

        return new Blob([buffer], { type: 'image/x-icon' });
    }
}
