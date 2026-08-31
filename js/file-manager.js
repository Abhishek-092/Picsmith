// File loading, drag and drop, and clipboard manager

import { validateImageFile } from './utils/validation.js';
import { detectFormat } from './format-detector.js';
import { AdvancedEngine } from './engines/advanced-engine.js';

export class FileManager {
    constructor({ onFileLoaded, onError }) {
        this.onFileLoaded = onFileLoaded;
        this.onError = onError;
        this.advancedEngine = new AdvancedEngine();
    }

    async processFile(file) {
        const validation = validateImageFile(file);
        if (!validation.valid) {
            this.onError(validation.error);
            return;
        }

        try {
            const formatInfo = await detectFormat(file);

            // Handle TIFF format decoding via AdvancedEngine
            if (formatInfo.format === 'tiff') {
                const arrayBuffer = await file.arrayBuffer();
                const canvas = await this.advancedEngine.parseTiffToCanvas(arrayBuffer);
                const dataUrl = canvas.toDataURL('image/png');

                const img = new Image();
                img.onload = () => {
                    this.onFileLoaded({
                        file,
                        image: img,
                        dataUrl,
                        name: file.name,
                        size: file.size,
                        type: 'image/tiff',
                        format: 'tiff',
                        width: canvas.width,
                        height: canvas.height,
                        aspectRatio: canvas.width / canvas.height
                    });
                };
                img.src = dataUrl;
                return;
            }

            const dataUrl = await this.readFileAsDataUrl(file);

            const img = new Image();
            img.onload = () => {
                const width = img.naturalWidth || img.width;
                const height = img.naturalHeight || img.height;

                this.onFileLoaded({
                    file,
                    image: img,
                    dataUrl,
                    name: file.name,
                    size: file.size,
                    type: formatInfo.mimeType || file.type,
                    format: formatInfo.format,
                    width,
                    height,
                    aspectRatio: width / height
                });
            };

            img.onerror = () => {
                this.onError('Failed to decode image data. The file may be corrupt.');
            };

            img.src = dataUrl;
        } catch (err) {
            this.onError(`Error reading file: ${err.message}`);
        }
    }

    readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    setupDragAndDrop(dropZoneElement, onHoverStateChange = () => {}) {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZoneElement.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZoneElement.classList.add('drag-over');
                onHoverStateChange(true);
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZoneElement.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZoneElement.classList.remove('drag-over');
                onHoverStateChange(false);
            });
        });

        dropZoneElement.addEventListener('drop', (e) => {
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                this.processFile(files[0]);
            }
        });
    }

    setupFileInput(fileInputElement) {
        fileInputElement.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                this.processFile(e.target.files[0]);
            }
        });
    }

    setupClipboard() {
        window.addEventListener('paste', (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                        const file = new File(
                            [blob],
                            `pasted-image-${Date.now()}.${blob.type.split('/')[1] || 'png'}`,
                            { type: blob.type }
                        );
                        this.processFile(file);
                        break;
                    }
                }
            }
        });
    }
}
