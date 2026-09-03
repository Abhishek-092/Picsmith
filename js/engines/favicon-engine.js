// Favicon and multi-resolution ICO packaging engine with aspect ratio normalization

export class FaviconEngine {
    async convert({ imageSource, sizes = [16, 32, 48, 64], fit = 'contain' }) {
        const selectedSizes = sizes.length > 0 ? sizes : [32];
        const imageBuffers = [];

        const imgW = imageSource.naturalWidth || imageSource.width || 100;
        const imgH = imageSource.naturalHeight || imageSource.height || 100;

        for (const size of selectedSizes) {
            const iconCanvas = document.createElement('canvas');
            iconCanvas.width = size;
            iconCanvas.height = size;
            const ctx = iconCanvas.getContext('2d');

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Calculate normalized destination dimensions to avoid geometric squashing
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

            imageBuffers.push({
                width: size,
                height: size,
                data: new Uint8Array(arrayBuffer)
            });

            // Clean up canvas
            iconCanvas.width = 0;
            iconCanvas.height = 0;
        }

        const icoBlob = this.buildIcoBinary(imageBuffers);

        return {
            blob: icoBlob,
            width: selectedSizes[selectedSizes.length - 1],
            height: selectedSizes[selectedSizes.length - 1],
            format: 'ico'
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
