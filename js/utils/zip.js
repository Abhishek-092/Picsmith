// Pure client-side zero-dependency ZIP archive builder (PKZip standard)
// Supports binary Blobs, Uint8Arrays, ArrayBuffers, and UTF-8 strings

// IEEE 802.3 CRC-32 polynomial lookup table
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    CRC_TABLE[i] = c >>> 0;
}

export function computeCrc32(data) {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function getDosDateTime(date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = Math.floor(date.getSeconds() / 2);

    const dosTime = (hours << 11) | (minutes << 5) | seconds;
    const dosDate = ((year - 1980) << 9) | (month << 5) | day;

    return { dosTime, dosDate };
}

/**
 * Creates a valid PKZip archive Blob from a list of files.
 * @param {Array<{ name: string, data: Uint8Array|ArrayBuffer|string|Blob }>} files
 * @returns {Promise<Blob>}
 */
export async function createZipArchive(files) {
    const textEncoder = new TextEncoder();
    const { dosTime, dosDate } = getDosDateTime();

    const preparedFiles = [];

    for (const file of files) {
        let uint8Data;
        if (typeof file.data === 'string') {
            uint8Data = textEncoder.encode(file.data);
        } else if (file.data instanceof ArrayBuffer) {
            uint8Data = new Uint8Array(file.data);
        } else if (file.data instanceof Uint8Array) {
            uint8Data = file.data;
        } else if (file.data instanceof Blob) {
            const ab = await file.data.arrayBuffer();
            uint8Data = new Uint8Array(ab);
        } else {
            throw new Error(`Unsupported data format for ZIP file: ${file.name}`);
        }

        const nameBytes = textEncoder.encode(file.name);
        const crc = computeCrc32(uint8Data);

        preparedFiles.push({
            name: file.name,
            nameBytes,
            data: uint8Data,
            crc,
            size: uint8Data.length
        });
    }

    // Compute total byte sizes
    let localHeadersAndDataSize = 0;
    let centralDirectorySize = 0;

    for (const file of preparedFiles) {
        // Local header: 30 bytes + name length + data length
        localHeadersAndDataSize += 30 + file.nameBytes.length + file.size;
        // Central directory entry: 46 bytes + name length
        centralDirectorySize += 46 + file.nameBytes.length;
    }

    // End of Central Directory Record: 22 bytes
    const totalZipSize = localHeadersAndDataSize + centralDirectorySize + 22;
    const zipBuffer = new Uint8Array(totalZipSize);
    const view = new DataView(zipBuffer.buffer);

    let offset = 0;
    const fileOffsets = [];

    // 1. Write Local File Headers + File Data
    for (const file of preparedFiles) {
        fileOffsets.push(offset);

        // Local file header signature: 0x04034b50
        view.setUint32(offset, 0x04034b50, true);
        view.setUint16(offset + 4, 20, true); // Version needed to extract (2.0)
        view.setUint16(offset + 6, 0x0800, true); // General purpose flag: UTF-8 filename
        view.setUint16(offset + 8, 0, true); // Compression method: 0 = Store (Uncompressed)
        view.setUint16(offset + 10, dosTime, true); // File mod time
        view.setUint16(offset + 12, dosDate, true); // File mod date
        view.setUint32(offset + 14, file.crc, true); // CRC-32
        view.setUint32(offset + 18, file.size, true); // Compressed size
        view.setUint32(offset + 22, file.size, true); // Uncompressed size
        view.setUint16(offset + 26, file.nameBytes.length, true); // Filename length
        view.setUint16(offset + 28, 0, true); // Extra field length

        offset += 30;

        // Filename
        zipBuffer.set(file.nameBytes, offset);
        offset += file.nameBytes.length;

        // Data payload
        zipBuffer.set(file.data, offset);
        offset += file.size;
    }

    // 2. Write Central Directory Headers
    const centralDirectoryStartOffset = offset;

    for (let i = 0; i < preparedFiles.length; i++) {
        const file = preparedFiles[i];
        const relativeOffset = fileOffsets[i];

        // Central directory file header signature: 0x02014b50
        view.setUint32(offset, 0x02014b50, true);
        view.setUint16(offset + 4, 20, true); // Version made by (2.0)
        view.setUint16(offset + 6, 20, true); // Version needed to extract (2.0)
        view.setUint16(offset + 8, 0x0800, true); // General purpose flag: UTF-8
        view.setUint16(offset + 10, 0, true); // Compression method: 0
        view.setUint16(offset + 12, dosTime, true); // File mod time
        view.setUint16(offset + 14, dosDate, true); // File mod date
        view.setUint32(offset + 16, file.crc, true); // CRC-32
        view.setUint32(offset + 20, file.size, true); // Compressed size
        view.setUint32(offset + 24, file.size, true); // Uncompressed size
        view.setUint16(offset + 28, file.nameBytes.length, true); // Filename length
        view.setUint16(offset + 30, 0, true); // Extra field length
        view.setUint16(offset + 32, 0, true); // File comment length
        view.setUint16(offset + 34, 0, true); // Disk number start
        view.setUint16(offset + 36, 0, true); // Internal file attributes
        view.setUint32(offset + 38, 0, true); // External file attributes
        view.setUint32(offset + 42, relativeOffset, true); // Relative offset of local header

        offset += 46;

        // Filename
        zipBuffer.set(file.nameBytes, offset);
        offset += file.nameBytes.length;
    }

    const centralDirectoryEndOffset = offset;
    const actualCentralDirectorySize = centralDirectoryEndOffset - centralDirectoryStartOffset;

    // 3. Write End of Central Directory Record (EOCD)
    // EOCD signature: 0x06054b50
    view.setUint32(offset, 0x06054b50, true);
    view.setUint16(offset + 4, 0, true); // Number of this disk
    view.setUint16(offset + 6, 0, true); // Disk where central directory starts
    view.setUint16(offset + 8, preparedFiles.length, true); // Number of central directory records on this disk
    view.setUint16(offset + 10, preparedFiles.length, true); // Total number of central directory records
    view.setUint32(offset + 12, actualCentralDirectorySize, true); // Size of central directory
    view.setUint32(offset + 16, centralDirectoryStartOffset, true); // Offset of start of central directory
    view.setUint16(offset + 20, 0, true); // ZIP comment length

    return new Blob([zipBuffer], { type: 'application/zip' });
}
