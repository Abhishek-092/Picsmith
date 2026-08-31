// File naming and formatting helpers

export function getFileBaseName(filename) {
    if (!filename) return 'image';
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) return filename;
    return filename.substring(0, lastDotIndex);
}

export function getFileExtension(filename) {
    if (!filename) return '';
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) return '';
    return filename.substring(lastDotIndex + 1).toLowerCase();
}

export function generateOutputFilename(originalName, targetFormat) {
    const base = getFileBaseName(originalName) || 'converted-image';
    const ext = targetFormat === 'jpeg' ? 'jpg' : targetFormat;
    // Sanitize filename to avoid invalid filesystem characters
    const sanitized = base.replace(/[^a-z0-9_\-\.]/gi, '_').replace(/_{2,}/g, '_');
    return `picsmith-${sanitized}.${ext}`;
}

export function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 BYTES';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['BYTES', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function calculateAspectRatio(width, height) {
    function gcd(a, b) {
        return b ? gcd(b, a % b) : a;
    }
    if (!width || !height) return 'N/A';
    const divisor = gcd(width, height);
    const rW = width / divisor;
    const rH = height / divisor;
    
    if ((rW === 16 && rH === 9) || (rW === 4 && rH === 3) || (rW === 1 && rH === 1) || (rW === 3 && rH === 2) || (rW === 2 && rH === 3) || (rW === 9 && rH === 16)) {
        return `${rW}:${rH}`;
    }
    const decimal = (width / height).toFixed(2);
    return `${decimal}:1 (${rW}:${rH})`;
}
