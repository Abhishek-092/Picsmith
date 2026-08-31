// Input validation helpers

const SUPPORTED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/svg+xml',
    'image/x-icon',
    'image/vnd.microsoft.icon',
    'image/bmp',
    'image/gif',
    'image/tiff'
];

const SUPPORTED_EXTENSIONS = [
    'jpg',
    'jpeg',
    'png',
    'webp',
    'avif',
    'svg',
    'ico',
    'bmp',
    'gif',
    'tif',
    'tiff'
];

export function validateImageFile(file) {
    if (!file) {
        return { valid: false, error: 'No file provided.' };
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isMimeValid = SUPPORTED_MIME_TYPES.includes(file.type);
    const isExtValid = SUPPORTED_EXTENSIONS.includes(ext);

    if (!isMimeValid && !isExtValid) {
        return {
            valid: false,
            error: `Unsupported format (${file.type || ext.toUpperCase() || 'unknown'}). Supported: JPG, PNG, WebP, AVIF, SVG, ICO, BMP, GIF, TIFF.`
        };
    }

    // Limit to 100MB to avoid browser memory exhaustion
    const MAX_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        return {
            valid: false,
            error: 'File size exceeds maximum limit of 100MB.'
        };
    }

    return { valid: true };
}

export function validateDimensions(width, height) {
    const w = parseInt(width, 10);
    const h = parseInt(height, 10);

    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
        return { valid: false, error: 'Width and height must be positive numbers.' };
    }

    if (w > 16384 || h > 16384) {
        return { valid: false, error: 'Max supported dimension is 16384px.' };
    }

    return { valid: true, width: w, height: h };
}
