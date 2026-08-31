// Image format detector

export async function detectFormat(file) {
    if (!file) return { format: 'unknown', mimeType: 'application/octet-stream', extension: '' };

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    let mimeType = file.type || '';

    // Inspect magic numbers from binary header
    try {
        const headerBytes = await readHeaderBytes(file, 16);
        const detectedFromBytes = detectFormatFromMagicBytes(headerBytes);
        if (detectedFromBytes) {
            return {
                format: detectedFromBytes.format,
                mimeType: detectedFromBytes.mimeType,
                extension: ext || detectedFromBytes.extension
            };
        }
    } catch {
        // Fallback to extension and browser mime
    }

    const formatByExt = mapExtensionToFormat(ext);
    return {
        format: formatByExt,
        mimeType: mimeType || mapFormatToMime(formatByExt),
        extension: ext
    };
}

function readHeaderBytes(file, byteCount = 16) {
    return new Promise((resolve, reject) => {
        const slice = file.slice(0, byteCount);
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result));
        reader.onerror = reject;
        reader.readAsArrayBuffer(slice);
    });
}

function detectFormatFromMagicBytes(bytes) {
    if (!bytes || bytes.length < 4) return null;

    // PNG: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
        return { format: 'png', mimeType: 'image/png', extension: 'png' };
    }

    // JPEG: FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
        return { format: 'jpeg', mimeType: 'image/jpeg', extension: 'jpg' };
    }

    // GIF: 47 49 46 38 ('GIF8')
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
        return { format: 'gif', mimeType: 'image/gif', extension: 'gif' };
    }

    // BMP: 42 4D ('BM')
    if (bytes[0] === 0x42 && bytes[1] === 0x4D) {
        return { format: 'bmp', mimeType: 'image/bmp', extension: 'bmp' };
    }

    // WebP: RIFF ... WEBP (52 49 46 46 ... 57 45 42 50)
    if (bytes.length >= 12 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
        return { format: 'webp', mimeType: 'image/webp', extension: 'webp' };
    }

    // ICO: 00 00 01 00
    if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
        return { format: 'ico', mimeType: 'image/x-icon', extension: 'ico' };
    }

    // TIFF: 49 49 2A 00 (little endian) or 4D 4D 00 2A (big endian)
    if ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2A && bytes[3] === 0x00) ||
        (bytes[0] === 0x4D && bytes[1] === 0x4D && bytes[2] === 0x00 && bytes[3] === 0x2A)) {
        return { format: 'tiff', mimeType: 'image/tiff', extension: 'tiff' };
    }

    // AVIF: ....ftypavif (bytes 4-11)
    if (bytes.length >= 12 &&
        bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70 &&
        bytes[8] === 0x61 && bytes[9] === 0x76 && bytes[10] === 0x69 && bytes[11] === 0x66) {
        return { format: 'avif', mimeType: 'image/avif', extension: 'avif' };
    }

    return null;
}

function mapExtensionToFormat(ext) {
    switch (ext) {
        case 'jpg':
        case 'jpeg':
            return 'jpeg';
        case 'png':
            return 'png';
        case 'webp':
            return 'webp';
        case 'avif':
            return 'avif';
        case 'svg':
            return 'svg';
        case 'ico':
            return 'ico';
        case 'bmp':
            return 'bmp';
        case 'gif':
            return 'gif';
        case 'tif':
        case 'tiff':
            return 'tiff';
        default:
            return 'unknown';
    }
}

function mapFormatToMime(format) {
    switch (format) {
        case 'jpeg':
            return 'image/jpeg';
        case 'png':
            return 'image/png';
        case 'webp':
            return 'image/webp';
        case 'avif':
            return 'image/avif';
        case 'svg':
            return 'image/svg+xml';
        case 'ico':
            return 'image/x-icon';
        case 'bmp':
            return 'image/bmp';
        case 'gif':
            return 'image/gif';
        case 'tiff':
            return 'image/tiff';
        default:
            return 'image/unknown';
    }
}
