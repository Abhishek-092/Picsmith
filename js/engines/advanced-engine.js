// Advanced conversion engine: TIFF decoding and codec coordination

export class AdvancedEngine {
    constructor() {
        this.loadedCodecs = new Map();
    }

    requiresAdvancedCodec(inputFormat, outputFormat) {
        return inputFormat === 'tiff' || outputFormat === 'tiff' || inputFormat === 'avif' || outputFormat === 'avif';
    }

    async loadCodec(codecName) {
        if (this.loadedCodecs.has(codecName)) {
            return this.loadedCodecs.get(codecName);
        }

        try {
            const { quantizePixelsWasm } = await import('../../wasm/codecs/pixel-transformer.js');
            const codec = {
                name: codecName,
                ready: true,
                quantize: quantizePixelsWasm
            };
            this.loadedCodecs.set(codecName, codec);
            return codec;
        } catch {
            return null;
        }
    }

    // Binary TIFF parser for browser decoding (supports uncompressed & PackBits RGB/Grayscale TIFFs)
    async parseTiffToCanvas(arrayBuffer) {
        const view = new DataView(arrayBuffer);
        const isLittleEndian = view.getUint16(0, false) === 0x4949; // 'II'

        const magic = view.getUint16(2, isLittleEndian);
        if (magic !== 42) {
            throw new Error('Invalid TIFF file signature.');
        }

        const firstIFDOffset = view.getUint32(4, isLittleEndian);
        let ifdOffset = firstIFDOffset;

        // Tags to extract
        let width = 0;
        let height = 0;
        let bitsPerSample = [8, 8, 8];
        let compression = 1; // 1 = uncompressed
        let photometric = 2; // 1 = BlackIsZero, 2 = RGB
        let stripOffsets = [];
        let stripByteCounts = [];
        let samplesPerPixel = 3;

        const numEntries = view.getUint16(ifdOffset, isLittleEndian);
        let entryOffset = ifdOffset + 2;

        for (let i = 0; i < numEntries; i++) {
            const tag = view.getUint16(entryOffset, isLittleEndian);
            const type = view.getUint16(entryOffset + 2, isLittleEndian);
            const count = view.getUint32(entryOffset + 4, isLittleEndian);
            const valueOffset = entryOffset + 8;

            const readVal = () => {
                if (type === 3) return view.getUint16(valueOffset, isLittleEndian); // SHORT
                if (type === 4) return view.getUint32(valueOffset, isLittleEndian); // LONG
                return view.getUint32(valueOffset, isLittleEndian);
            };

            const readArray = () => {
                if (count === 1) return [readVal()];
                const offset = view.getUint32(valueOffset, isLittleEndian);
                const arr = [];
                for (let c = 0; c < count; c++) {
                    if (type === 3) arr.push(view.getUint16(offset + c * 2, isLittleEndian));
                    else if (type === 4) arr.push(view.getUint32(offset + c * 4, isLittleEndian));
                }
                return arr;
            };

            switch (tag) {
                case 256: // ImageWidth
                    width = readVal();
                    break;
                case 257: // ImageLength (Height)
                    height = readVal();
                    break;
                case 258: // BitsPerSample
                    bitsPerSample = count === 1 ? [readVal()] : readArray();
                    break;
                case 259: // Compression
                    compression = readVal();
                    break;
                case 262: // PhotometricInterpretation
                    photometric = readVal();
                    break;
                case 273: // StripOffsets
                    stripOffsets = readArray();
                    break;
                case 277: // SamplesPerPixel
                    samplesPerPixel = readVal();
                    break;
                case 279: // StripByteCounts
                    stripByteCounts = readArray();
                    break;
            }

            entryOffset += 12;
        }

        if (!width || !height || stripOffsets.length === 0) {
            throw new Error('TIFF IFD headers missing required dimension or strip data.');
        }

        // Render decoded pixels onto Canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        let pixelIndex = 0;

        for (let s = 0; s < stripOffsets.length; s++) {
            const offset = stripOffsets[s];
            const count = stripByteCounts[s] || (width * height * samplesPerPixel);
            const stripBytes = new Uint8Array(arrayBuffer, offset, Math.min(count, arrayBuffer.byteLength - offset));

            // Uncompressed RGB / Grayscale
            if (compression === 1) {
                let byteIdx = 0;
                while (byteIdx < stripBytes.length && pixelIndex < data.length) {
                    if (samplesPerPixel >= 3) {
                        data[pixelIndex] = stripBytes[byteIdx];         // R
                        data[pixelIndex + 1] = stripBytes[byteIdx + 1]; // G
                        data[pixelIndex + 2] = stripBytes[byteIdx + 2]; // B
                        data[pixelIndex + 3] = samplesPerPixel >= 4 ? stripBytes[byteIdx + 3] : 255;
                        byteIdx += samplesPerPixel;
                    } else if (samplesPerPixel === 1) {
                        // Grayscale
                        const gray = photometric === 0 ? 255 - stripBytes[byteIdx] : stripBytes[byteIdx];
                        data[pixelIndex] = gray;
                        data[pixelIndex + 1] = gray;
                        data[pixelIndex + 2] = gray;
                        data[pixelIndex + 3] = 255;
                        byteIdx += 1;
                    }
                    pixelIndex += 4;
                }
            } else if (compression === 32773) {
                // PackBits decompression
                let byteIdx = 0;
                while (byteIdx < stripBytes.length && pixelIndex < data.length) {
                    const n = view.getInt8(offset + byteIdx);
                    byteIdx++;
                    if (n >= 0 && n <= 127) {
                        for (let k = 0; k <= n; k++) {
                            const val = stripBytes[byteIdx++];
                            data[pixelIndex] = val;
                            data[pixelIndex + 1] = val;
                            data[pixelIndex + 2] = val;
                            data[pixelIndex + 3] = 255;
                            pixelIndex += 4;
                        }
                    } else if (n >= -127 && n <= -1) {
                        const val = stripBytes[byteIdx++];
                        for (let k = 0; k <= -n; k++) {
                            data[pixelIndex] = val;
                            data[pixelIndex + 1] = val;
                            data[pixelIndex + 2] = val;
                            data[pixelIndex + 3] = 255;
                            pixelIndex += 4;
                        }
                    }
                }
            }
        }

        ctx.putImageData(imgData, 0, 0);
        return canvas;
    }
}
