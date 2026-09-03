// Advanced conversion engine: Professional TIFF decoding (uncompressed, LZW, Deflate, PackBits) and codec coordination

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

    // Binary TIFF parser for browser decoding (supports uncompressed, LZW, Deflate, and PackBits)
    async parseTiffToCanvas(arrayBuffer) {
        const view = new DataView(arrayBuffer);
        const isLittleEndian = view.getUint16(0, false) === 0x4949; // 'II' (Intel) vs 'MM' (Motorola)

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
        let compression = 1; // 1 = None, 5 = LZW, 8 = Deflate, 32773 = PackBits
        let photometric = 2; // 0 = WhiteIsZero, 1 = BlackIsZero, 2 = RGB
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
                case 256: width = readVal(); break;
                case 257: height = readVal(); break;
                case 258: bitsPerSample = count === 1 ? [readVal()] : readArray(); break;
                case 259: compression = readVal(); break;
                case 262: photometric = readVal(); break;
                case 273: stripOffsets = readArray(); break;
                case 277: samplesPerPixel = readVal(); break;
                case 279: stripByteCounts = readArray(); break;
            }

            entryOffset += 12;
        }

        if (!width || !height || stripOffsets.length === 0) {
            throw new Error('TIFF IFD headers missing required dimension or strip data.');
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        let pixelIndex = 0;

        for (let s = 0; s < stripOffsets.length; s++) {
            const offset = stripOffsets[s];
            const byteCount = stripByteCounts[s] || (arrayBuffer.byteLength - offset);
            const rawStripBytes = new Uint8Array(arrayBuffer, offset, Math.min(byteCount, arrayBuffer.byteLength - offset));

            let decompressedBytes = rawStripBytes;

            if (compression === 32773) {
                // PackBits decompression
                decompressedBytes = this.decompressPackBits(rawStripBytes);
            } else if (compression === 5) {
                // LZW decompression
                decompressedBytes = this.decompressLZW(rawStripBytes);
            } else if (compression === 8 || compression === 32946) {
                // Deflate/ZIP decompression
                try {
                    decompressedBytes = await this.decompressDeflate(rawStripBytes);
                } catch {
                    decompressedBytes = rawStripBytes;
                }
            }

            // Copy pixels into ImageData
            let byteIdx = 0;
            while (byteIdx < decompressedBytes.length && pixelIndex < data.length) {
                if (samplesPerPixel >= 3) {
                    data[pixelIndex] = decompressedBytes[byteIdx];         // R
                    data[pixelIndex + 1] = decompressedBytes[byteIdx + 1]; // G
                    data[pixelIndex + 2] = decompressedBytes[byteIdx + 2]; // B
                    data[pixelIndex + 3] = samplesPerPixel >= 4 ? decompressedBytes[byteIdx + 3] : 255;
                    byteIdx += samplesPerPixel;
                } else if (samplesPerPixel === 1) {
                    const gray = photometric === 0 ? 255 - decompressedBytes[byteIdx] : decompressedBytes[byteIdx];
                    data[pixelIndex] = gray;
                    data[pixelIndex + 1] = gray;
                    data[pixelIndex + 2] = gray;
                    data[pixelIndex + 3] = 255;
                    byteIdx += 1;
                }
                pixelIndex += 4;
            }
        }

        ctx.putImageData(imgData, 0, 0);
        return canvas;
    }

    // PackBits (MacPaint RLE) decompressor
    decompressPackBits(input) {
        const output = [];
        let i = 0;
        while (i < input.length) {
            const n = input[i] > 127 ? input[i] - 256 : input[i];
            i++;
            if (n >= 0 && n <= 127) {
                for (let k = 0; k <= n; k++) {
                    output.push(input[i++]);
                }
            } else if (n >= -127 && n <= -1) {
                const val = input[i++];
                for (let k = 0; k <= -n; k++) {
                    output.push(val);
                }
            }
        }
        return new Uint8Array(output);
    }

    // Standard TIFF LZW decompressor (MSB-first variable bit width 9-12 bits)
    decompressLZW(input) {
        const CLEAR_CODE = 256;
        const EOI_CODE = 257;

        let bitPos = 0;
        const getBits = (numBits) => {
            let val = 0;
            for (let b = 0; b < numBits; b++) {
                const byteIdx = (bitPos + b) >> 3;
                if (byteIdx >= input.length) return null;
                const bitIdx = 7 - ((bitPos + b) & 7);
                const bit = (input[byteIdx] >> bitIdx) & 1;
                val = (val << 1) | bit;
            }
            bitPos += numBits;
            return val;
        };

        const out = [];
        let dictionary = [];

        const resetDict = () => {
            dictionary = [];
            for (let i = 0; i < 256; i++) {
                dictionary[i] = [i];
            }
            dictionary[256] = []; // CLEAR
            dictionary[257] = []; // EOI
        };

        resetDict();
        let codeSize = 9;
        let oldCode = null;

        while (bitPos < input.length * 8) {
            const code = getBits(codeSize);
            if (code === null || code === EOI_CODE) break;

            if (code === CLEAR_CODE) {
                resetDict();
                codeSize = 9;
                oldCode = null;
                continue;
            }

            let entry;
            if (dictionary[code]) {
                entry = dictionary[code];
            } else if (code === dictionary.length && oldCode !== null) {
                entry = dictionary[oldCode].concat(dictionary[oldCode][0]);
            } else {
                break;
            }

            for (let k = 0; k < entry.length; k++) {
                out.push(entry[k]);
            }

            if (oldCode !== null) {
                dictionary.push(dictionary[oldCode].concat(entry[0]));
                if (dictionary.length === (1 << codeSize) - 1 && codeSize < 12) {
                    codeSize++;
                }
            }
            oldCode = code;
        }

        return new Uint8Array(out);
    }

    // Web Streams Deflate decompressor
    async decompressDeflate(input) {
        if (typeof DecompressionStream !== 'undefined') {
            const ds = new DecompressionStream('deflate');
            const writer = ds.writable.getWriter();
            writer.write(input);
            writer.close();
            const reader = ds.readable.getReader();
            const chunks = [];
            let totalLen = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                totalLen += value.length;
            }
            const res = new Uint8Array(totalLen);
            let offset = 0;
            for (const chunk of chunks) {
                res.set(chunk, offset);
                offset += chunk.length;
            }
            return res;
        }
        return input;
    }
}
