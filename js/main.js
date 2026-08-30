// Application state
const state = {
    sourceFile: null,
    sourceImage: null,
    sourceBitmap: null,
    sourceDataUrl: null,
    sourceWidth: 0,
    sourceHeight: 0,
    sourceSize: 0,
    sourceType: '',
    sourceName: '',
    
    // Target parameters
    targetFormat: 'webp',
    targetQuality: 0.85,
    targetWidth: 0,
    targetHeight: 0,
    aspectLocked: true,
    aspectRatio: 1,
    matteColor: '#ffffff',
    icoSizes: [16, 32, 48, 64],
    svgMode: 'vector-trace',
    
    // Output artifact
    outputBlob: null,
    outputUrl: null,
    outputSize: 0,
    outputWidth: 0,
    outputHeight: 0,
    conversionTimeMs: 0
};

// DOM references
const DOM = {
    engineStatus: document.getElementById('engine-status-text'),
    errorBanner: document.getElementById('error-banner'),
    errorMessage: document.getElementById('error-message'),
    dismissErrorBtn: document.getElementById('dismiss-error-btn'),
    
    panelInput: document.getElementById('panel-input'),
    panelSourceInfo: document.getElementById('panel-source-info'),
    panelSettings: document.getElementById('panel-settings'),
    panelAction: document.getElementById('panel-action'),
    panelOutput: document.getElementById('panel-output'),
    
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    btnLoadSample: document.getElementById('btn-load-sample'),
    
    sourcePreviewImg: document.getElementById('source-preview-img'),
    metricName: document.getElementById('metric-name'),
    metricType: document.getElementById('metric-type'),
    metricSize: document.getElementById('metric-size'),
    metricDimensions: document.getElementById('metric-dimensions'),
    metricAspect: document.getElementById('metric-aspect'),
    metricMegapixels: document.getElementById('metric-megapixels'),
    btnRemoveSource: document.getElementById('btn-remove-source'),
    
    formatCards: document.querySelectorAll('#format-selector-grid .format-card'),
    cardQualityControl: document.getElementById('card-quality-control'),
    inputQuality: document.getElementById('input-quality'),
    qualityValDisplay: document.getElementById('quality-val-display'),
    qualityPresets: document.querySelectorAll('#card-quality-control .preset-pill'),
    
    inputWidth: document.getElementById('input-width'),
    inputHeight: document.getElementById('input-height'),
    btnLockAspect: document.getElementById('btn-lock-aspect'),
    scaleIndicatorText: document.getElementById('scale-indicator-text'),
    dimPresets: document.querySelectorAll('[data-scale], [data-preset-size]'),
    
    optJpgMatte: document.getElementById('opt-jpg-matte'),
    inputMatteColor: document.getElementById('input-matte-color'),
    matteColorHex: document.getElementById('matte-color-hex'),
    optIcoSizes: document.getElementById('opt-ico-sizes'),
    optSvgMode: document.getElementById('opt-svg-mode'),
    icoCheckboxes: {
        16: document.getElementById('ico-sz-16'),
        32: document.getElementById('ico-sz-32'),
        48: document.getElementById('ico-sz-48'),
        64: document.getElementById('ico-sz-64')
    },
    
    btnConvertAction: document.getElementById('btn-convert-action'),
    actionTriggerBox: document.getElementById('action-trigger-box'),
    conversionProgressBox: document.getElementById('conversion-progress-box'),
    progressPhaseLabel: document.getElementById('progress-phase-label'),
    progressPhasePercent: document.getElementById('progress-phase-percent'),
    progressBarFill: document.getElementById('progress-bar-fill'),
    
    outputSavingsBadge: document.getElementById('output-savings-badge'),
    outputPreviewImg: document.getElementById('output-preview-img'),
    outMetricFormat: document.getElementById('out-metric-format'),
    outMetricSize: document.getElementById('out-metric-size'),
    outMetricDimensions: document.getElementById('out-metric-dimensions'),
    outMetricTime: document.getElementById('out-metric-time'),
    btnDownloadArtifact: document.getElementById('btn-download-artifact'),
    btnCopyClipboard: document.getElementById('btn-copy-clipboard'),
    btnConvertAnother: document.getElementById('btn-convert-another')
};

// Formatting helpers
function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 BYTES';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['BYTES', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function calculateAspectRatio(width, height) {
    function gcd(a, b) {
        return b ? gcd(b, a % b) : a;
    }
    const divisor = gcd(width, height);
    const rW = width / divisor;
    const rH = height / divisor;
    
    if ((rW === 16 && rH === 9) || (rW === 4 && rH === 3) || (rW === 1 && rH === 1) || (rW === 3 && rH === 2)) {
        return `${rW}:${rH}`;
    }
    const decimal = (width / height).toFixed(2);
    return `${decimal}:1 (${rW}:${rH})`;
}

function showError(msg) {
    DOM.errorMessage.textContent = msg;
    DOM.errorBanner.classList.remove('hidden');
    DOM.errorBanner.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideError() {
    DOM.errorBanner.classList.add('hidden');
}

// App initialization
function init() {
    setupDragAndDrop();
    setupFileInput();
    setupClipboardPaste();
    setupSampleLoader();
    setupSettingsEvents();
    setupConversionAction();
    setupOutputEvents();

    DOM.dismissErrorBtn.addEventListener('click', hideError);
    DOM.engineStatus.textContent = 'READY // HARDWARE ACCELERATED';
}

// Drag and drop handlers
function setupDragAndDrop() {
    const dropZone = DOM.dropZone;

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            handleFileSelection(files[0]);
        }
    });

    dropZone.addEventListener('click', (e) => {
        if (e.target !== DOM.btnLoadSample && !DOM.btnLoadSample.contains(e.target)) {
            DOM.fileInput.click();
        }
    });
}

// File and clipboard inputs
function setupFileInput() {
    DOM.fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    });
}

function setupClipboardPaste() {
    window.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    const file = new File([blob], `pasted-image-${Date.now()}.${blob.type.split('/')[1] || 'png'}`, { type: blob.type });
                    handleFileSelection(file);
                    break;
                }
            }
        }
    });
}

// Demo image generator
function setupSampleLoader() {
    DOM.btnLoadSample.addEventListener('click', (e) => {
        e.stopPropagation();
        createDemoImage();
    });
}

function createDemoImage() {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#f5f3ea';
    ctx.fillRect(0, 0, 1200, 800);

    // Acid yellow banner
    ctx.fillStyle = '#e8ff00';
    ctx.fillRect(60, 60, 1080, 680);
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 12;
    ctx.strokeRect(60, 60, 1080, 680);

    // Decorative pink block
    ctx.fillStyle = '#ff5e8a';
    ctx.fillRect(120, 120, 360, 240);
    ctx.strokeRect(120, 120, 360, 240);

    // Accent circle
    ctx.fillStyle = '#5ec8ff';
    ctx.beginPath();
    ctx.arc(880, 240, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Halftone dots
    ctx.fillStyle = '#0a0a0a';
    for (let x = 600; x < 1000; x += 24) {
        for (let y = 440; y < 680; y += 24) {
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Typography
    ctx.fillStyle = '#0a0a0a';
    ctx.font = '900 84px Archivo, sans-serif';
    ctx.fillText('PICSMITH', 120, 480);

    ctx.font = '700 32px "JetBrains Mono", monospace';
    ctx.fillText('NEO-BRUTALIST DEMO SAMPLE', 120, 550);
    ctx.font = '700 24px "JetBrains Mono", monospace';
    ctx.fillText('100% IN-BROWSER IMAGE PROCESSOR', 120, 610);

    canvas.toBlob((blob) => {
        const file = new File([blob], 'picsmith-demo-sample.png', { type: 'image/png' });
        handleFileSelection(file);
    }, 'image/png');
}

// File loading and metadata inspection
async function handleFileSelection(file) {
    hideError();
    if (!file || !file.type.startsWith('image/') && !file.name.match(/\.(jpg|jpeg|png|webp|avif|svg|ico|bmp|gif|tiff)$/i)) {
        showError('Invalid file type. Please choose a valid image file (JPG, PNG, WebP, AVIF, SVG, ICO, BMP).');
        return;
    }

    state.sourceFile = file;
    state.sourceName = file.name;
    state.sourceSize = file.size;
    state.sourceType = file.type || 'image/unknown';

    try {
        const dataUrl = await readFileAsDataUrl(file);
        state.sourceDataUrl = dataUrl;

        const img = new Image();
        img.onload = () => {
            state.sourceImage = img;
            state.sourceWidth = img.naturalWidth || img.width;
            state.sourceHeight = img.naturalHeight || img.height;
            state.aspectRatio = state.sourceWidth / state.sourceHeight;
            state.targetWidth = state.sourceWidth;
            state.targetHeight = state.sourceHeight;

            renderSourceMetrics();
            updateSettingsUI();
            showStepPanels();
        };
        img.onerror = () => {
            showError('Failed to decode the selected image. The file may be corrupted.');
        };
        img.src = dataUrl;

    } catch (err) {
        showError(`Error reading image: ${err.message}`);
    }
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function renderSourceMetrics() {
    DOM.sourcePreviewImg.src = state.sourceDataUrl;
    DOM.metricName.textContent = state.sourceName;
    DOM.metricType.textContent = (state.sourceType.split('/')[1] || state.sourceName.split('.').pop() || 'IMAGE').toUpperCase();
    DOM.metricSize.textContent = formatBytes(state.sourceSize);
    DOM.metricDimensions.textContent = `${state.sourceWidth} × ${state.sourceHeight} PX`;
    DOM.metricAspect.textContent = calculateAspectRatio(state.sourceWidth, state.sourceHeight);
    
    const megapixels = ((state.sourceWidth * state.sourceHeight) / 1000000).toFixed(2);
    DOM.metricMegapixels.textContent = `${megapixels} MP`;

    DOM.inputWidth.value = state.sourceWidth;
    DOM.inputHeight.value = state.sourceHeight;
}

function showStepPanels() {
    DOM.panelSourceInfo.classList.remove('hidden');
    DOM.panelSettings.classList.remove('hidden');
    DOM.panelAction.classList.remove('hidden');
    DOM.panelOutput.classList.add('hidden');
    DOM.panelSourceInfo.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Settings and parameters
function setupSettingsEvents() {
    // Format card selection
    DOM.formatCards.forEach(card => {
        card.addEventListener('click', () => {
            DOM.formatCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            state.targetFormat = card.dataset.format;
            updateFormatSpecificControls();
        });
    });

    // Quality slider
    DOM.inputQuality.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        state.targetQuality = val / 100;
        DOM.qualityValDisplay.textContent = `${val}%`;

        DOM.qualityPresets.forEach(pill => {
            pill.classList.toggle('active', parseInt(pill.dataset.quality, 10) === val);
        });
    });

    // Quality presets
    DOM.qualityPresets.forEach(pill => {
        pill.addEventListener('click', () => {
            const q = parseInt(pill.dataset.quality, 10);
            DOM.inputQuality.value = q;
            state.targetQuality = q / 100;
            DOM.qualityValDisplay.textContent = `${q}%`;
            DOM.qualityPresets.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
        });
    });

    // Aspect ratio lock toggle
    DOM.btnLockAspect.addEventListener('click', () => {
        state.aspectLocked = !state.aspectLocked;
        DOM.btnLockAspect.classList.toggle('active', state.aspectLocked);
    });

    // Dimensions
    DOM.inputWidth.addEventListener('input', () => {
        const w = parseInt(DOM.inputWidth.value, 10);
        if (!isNaN(w) && w > 0) {
            state.targetWidth = w;
            if (state.aspectLocked && state.aspectRatio) {
                state.targetHeight = Math.round(w / state.aspectRatio);
                DOM.inputHeight.value = state.targetHeight;
            }
            updateScaleIndicator();
        }
    });

    DOM.inputHeight.addEventListener('input', () => {
        const h = parseInt(DOM.inputHeight.value, 10);
        if (!isNaN(h) && h > 0) {
            state.targetHeight = h;
            if (state.aspectLocked && state.aspectRatio) {
                state.targetWidth = Math.round(h * state.aspectRatio);
                DOM.inputWidth.value = state.targetWidth;
            }
            updateScaleIndicator();
        }
    });

    // Scale presets
    DOM.dimPresets.forEach(btn => {
        btn.addEventListener('click', () => {
            DOM.dimPresets.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (btn.dataset.scale) {
                const scale = parseFloat(btn.dataset.scale);
                state.targetWidth = Math.round(state.sourceWidth * scale);
                state.targetHeight = Math.round(state.sourceHeight * scale);
            } else if (btn.dataset.presetSize) {
                const targetSize = parseInt(btn.dataset.presetSize, 10);
                if (state.sourceWidth >= state.sourceHeight) {
                    state.targetWidth = targetSize;
                    state.targetHeight = Math.round(targetSize / state.aspectRatio);
                } else {
                    state.targetHeight = targetSize;
                    state.targetWidth = Math.round(targetSize * state.aspectRatio);
                }
            }

            DOM.inputWidth.value = state.targetWidth;
            DOM.inputHeight.value = state.targetHeight;
            updateScaleIndicator();
        });
    });

    // Matte color picker for JPG
    DOM.inputMatteColor.addEventListener('input', (e) => {
        state.matteColor = e.target.value;
        DOM.matteColorHex.textContent = `${state.matteColor.toUpperCase()} (${state.matteColor === '#ffffff' ? 'WHITE' : 'CUSTOM'})`;
    });

    // SVG mode
    document.querySelectorAll('input[name="svg-engine-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            state.svgMode = e.target.value;
        });
    });

    // Reset button
    DOM.btnRemoveSource.addEventListener('click', resetAll);
}

function updateFormatSpecificControls() {
    const fmt = state.targetFormat;
    
    if (fmt === 'png') {
        DOM.cardQualityControl.style.opacity = '0.5';
        DOM.qualityValDisplay.textContent = 'LOSSLESS';
    } else if (fmt === 'svg') {
        DOM.cardQualityControl.style.opacity = '0.5';
        DOM.qualityValDisplay.textContent = 'VECTOR';
    } else {
        DOM.cardQualityControl.style.opacity = '1';
        DOM.qualityValDisplay.textContent = `${Math.round(state.targetQuality * 100)}%`;
    }

    DOM.optJpgMatte.classList.toggle('hidden', fmt !== 'jpeg');
    DOM.optIcoSizes.classList.toggle('hidden', fmt !== 'ico');
    DOM.optSvgMode.classList.toggle('hidden', fmt !== 'svg');
}

function updateSettingsUI() {
    updateFormatSpecificControls();
    updateScaleIndicator();
}

function updateScaleIndicator() {
    if (!state.sourceWidth || !state.targetWidth) return;
    const ratio = (state.targetWidth / state.sourceWidth).toFixed(2);
    if (ratio === '1.00') {
        DOM.scaleIndicatorText.textContent = 'ORIGINAL SCALE (1.0X)';
    } else {
        DOM.scaleIndicatorText.textContent = `SCALED (${ratio}X)`;
    }
}

// Conversion execution
function setupConversionAction() {
    DOM.btnConvertAction.addEventListener('click', executeConversion);
}

async function executeConversion() {
    if (!state.sourceImage) {
        showError('No source image selected.');
        return;
    }

    hideError();
    const startTime = performance.now();

    DOM.actionTriggerBox.classList.add('hidden');
    DOM.conversionProgressBox.classList.remove('hidden');
    updateProgress(15, 'DECODING SOURCE PIXEL BUFFER...');

    try {
        await sleep(60);
        updateProgress(35, 'INITIALIZING RESAMPLING MATRIX...');

        const canvas = document.createElement('canvas');
        canvas.width = state.targetWidth || state.sourceWidth;
        canvas.height = state.targetHeight || state.sourceHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Add solid background matte if target format does not support transparency
        if (state.targetFormat === 'jpeg') {
            ctx.fillStyle = state.matteColor || '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(state.sourceImage, 0, 0, canvas.width, canvas.height);

        updateProgress(65, `ENCODING TARGET [${state.targetFormat.toUpperCase()}] BUFFER...`);
        await sleep(50);

        let outputBlob = null;

        if (state.targetFormat === 'ico') {
            outputBlob = await generateIcoBlob(canvas);
        } else if (state.targetFormat === 'svg') {
            outputBlob = await generateSvgBlob(canvas);
        } else {
            outputBlob = await convertCanvasToBlob(canvas, state.targetFormat, state.targetQuality);
        }

        if (!outputBlob) {
            throw new Error(`Failed to generate ${state.targetFormat.toUpperCase()} blob.`);
        }

        updateProgress(90, 'FINALIZING ARTIFACT METRICS...');
        await sleep(40);

        const endTime = performance.now();
        state.conversionTimeMs = Math.round(endTime - startTime);
        state.outputBlob = outputBlob;
        state.outputSize = outputBlob.size;
        state.outputWidth = canvas.width;
        state.outputHeight = canvas.height;

        if (state.outputUrl) {
            URL.revokeObjectURL(state.outputUrl);
        }
        state.outputUrl = URL.createObjectURL(outputBlob);

        updateProgress(100, 'CONVERSION COMPLETE!');
        await sleep(100);

        renderOutputArtifact();

    } catch (err) {
        showError(`Conversion failed: ${err.message}`);
    } finally {
        DOM.actionTriggerBox.classList.remove('hidden');
        DOM.conversionProgressBox.classList.add('hidden');
    }
}

function updateProgress(percent, text) {
    DOM.progressBarFill.style.width = `${percent}%`;
    DOM.progressPhasePercent.textContent = `${percent}%`;
    DOM.progressPhaseLabel.textContent = text;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Convert canvas to blob with format fallback
function convertCanvasToBlob(canvas, format, quality) {
    return new Promise((resolve, reject) => {
        let mimeType = 'image/png';
        if (format === 'jpeg') mimeType = 'image/jpeg';
        else if (format === 'webp') mimeType = 'image/webp';
        else if (format === 'avif') mimeType = 'image/avif';

        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                if (format === 'avif') {
                    canvas.toBlob((fallbackBlob) => {
                        resolve(fallbackBlob);
                    }, 'image/webp', quality);
                } else {
                    reject(new Error(`Browser does not support direct export for ${mimeType}`));
                }
            }
        }, mimeType, quality);
    });
}

// ICO icon generator
async function generateIcoBlob(sourceCanvas) {
    const selectedSizes = [];
    if (DOM.icoCheckboxes[16]?.checked) selectedSizes.push(16);
    if (DOM.icoCheckboxes[32]?.checked) selectedSizes.push(32);
    if (DOM.icoCheckboxes[48]?.checked) selectedSizes.push(48);
    if (DOM.icoCheckboxes[64]?.checked) selectedSizes.push(64);
    if (selectedSizes.length === 0) selectedSizes.push(32);

    const imageBuffers = [];

    for (const size of selectedSizes) {
        const iconCanvas = document.createElement('canvas');
        iconCanvas.width = size;
        iconCanvas.height = size;
        const iconCtx = iconCanvas.getContext('2d');
        iconCtx.imageSmoothingEnabled = true;
        iconCtx.imageSmoothingQuality = 'high';
        iconCtx.drawImage(sourceCanvas, 0, 0, size, size);

        const pngBlob = await new Promise(r => iconCanvas.toBlob(r, 'image/png'));
        const arrayBuf = await pngBlob.arrayBuffer();
        imageBuffers.push({
            width: size,
            height: size,
            data: new Uint8Array(arrayBuf)
        });
    }

    const numImages = imageBuffers.length;
    const headerSize = 6;
    const dirEntrySize = 16;
    let totalSize = headerSize + (dirEntrySize * numImages);

    imageBuffers.forEach(img => {
        totalSize += img.data.length;
    });

    const icoBuffer = new Uint8Array(totalSize);
    const view = new DataView(icoBuffer.buffer);

    // ICO header
    view.setUint16(0, 0, true);
    view.setUint16(2, 1, true);
    view.setUint16(4, numImages, true);

    let offset = headerSize + (dirEntrySize * numImages);

    // Directory entries
    for (let i = 0; i < numImages; i++) {
        const img = imageBuffers[i];
        const entryOffset = headerSize + (i * dirEntrySize);

        icoBuffer[entryOffset + 0] = img.width >= 256 ? 0 : img.width;
        icoBuffer[entryOffset + 1] = img.height >= 256 ? 0 : img.height;
        icoBuffer[entryOffset + 2] = 0;
        icoBuffer[entryOffset + 3] = 0;
        view.setUint16(entryOffset + 4, 1, true);
        view.setUint16(entryOffset + 6, 32, true);
        view.setUint32(entryOffset + 8, img.data.length, true);
        view.setUint32(entryOffset + 12, offset, true);

        icoBuffer.set(img.data, offset);
        offset += img.data.length;
    }

    return new Blob([icoBuffer], { type: 'image/x-icon' });
}

// SVG generator
async function generateSvgBlob(canvas) {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, width, height);
    const pixels = imgData.data;

    let svgContent = '';

    if (state.svgMode === 'vector-trace' && width <= 400 && height <= 400) {
        svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;
        svgContent += `<!-- PICSMITH Vector Output -->\n`;
        
        for (let y = 0; y < height; y++) {
            let startX = 0;
            let curColor = null;

            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const r = pixels[idx];
                const g = pixels[idx + 1];
                const b = pixels[idx + 2];
                const a = pixels[idx + 3] / 255;

                const color = a > 0.05 ? `rgba(${r},${g},${b},${a.toFixed(2)})` : null;

                if (color !== curColor) {
                    if (curColor && (x - startX) > 0) {
                        svgContent += `<rect x="${startX}" y="${y}" width="${x - startX}" height="1" fill="${curColor}" />\n`;
                    }
                    curColor = color;
                    startX = x;
                }
            }

            if (curColor && (width - startX) > 0) {
                svgContent += `<rect x="${startX}" y="${y}" width="${width - startX}" height="1" fill="${curColor}" />\n`;
            }
        }
        svgContent += `</svg>`;
    } else {
        const dataUrl = canvas.toDataURL('image/png');
        svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <!-- Embedded High-Resolution Raster -->
  <image width="${width}" height="${height}" xlink:href="${dataUrl}" />
</svg>`;
    }

    return new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
}

// Render output UI
function renderOutputArtifact() {
    DOM.outputPreviewImg.src = state.outputUrl;
    DOM.outMetricFormat.textContent = state.targetFormat.toUpperCase();
    DOM.outMetricSize.textContent = formatBytes(state.outputSize);
    DOM.outMetricDimensions.textContent = `${state.outputWidth} × ${state.outputHeight} PX`;
    DOM.outMetricTime.textContent = `${state.conversionTimeMs} MS`;

    const deltaBytes = state.outputSize - state.sourceSize;
    const deltaPercent = Math.round((deltaBytes / state.sourceSize) * 100);

    if (deltaPercent < 0) {
        DOM.outputSavingsBadge.textContent = `${Math.abs(deltaPercent)}% SMALLER (${formatBytes(Math.abs(deltaBytes))} SAVED)`;
        DOM.outputSavingsBadge.className = 'savings-badge';
    } else if (deltaPercent === 0) {
        DOM.outputSavingsBadge.textContent = 'IDENTICAL FILE SIZE';
        DOM.outputSavingsBadge.className = 'savings-badge';
    } else {
        DOM.outputSavingsBadge.textContent = `+${deltaPercent}% EXPANDED`;
        DOM.outputSavingsBadge.className = 'savings-badge increased';
    }

    const baseName = state.sourceName.substring(0, state.sourceName.lastIndexOf('.')) || 'converted-image';
    const ext = state.targetFormat === 'jpeg' ? 'jpg' : state.targetFormat;
    const downloadFilename = `picsmith-${baseName}.${ext}`;

    DOM.btnDownloadArtifact.href = state.outputUrl;
    DOM.btnDownloadArtifact.download = downloadFilename;

    DOM.panelOutput.classList.remove('hidden');
    DOM.panelOutput.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Output actions
function setupOutputEvents() {
    DOM.btnCopyClipboard.addEventListener('click', async () => {
        if (!state.outputBlob) return;

        try {
            let blobToCopy = state.outputBlob;
            if (state.targetFormat !== 'png') {
                const canvas = document.createElement('canvas');
                canvas.width = state.outputWidth;
                canvas.height = state.outputHeight;
                const ctx = canvas.getContext('2d');
                const img = new Image();
                await new Promise((resolve) => {
                    img.onload = resolve;
                    img.src = state.outputUrl;
                });
                ctx.drawImage(img, 0, 0);
                blobToCopy = await new Promise(r => canvas.toBlob(r, 'image/png'));
            }

            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blobToCopy })
            ]);

            const origText = DOM.btnCopyClipboard.textContent;
            DOM.btnCopyClipboard.textContent = 'COPIED TO CLIPBOARD!';
            setTimeout(() => {
                DOM.btnCopyClipboard.textContent = origText;
            }, 2000);
        } catch (err) {
            showError('Direct clipboard copy is not supported in this browser for this format. Please use the Download button.');
        }
    });

    DOM.btnConvertAnother.addEventListener('click', () => {
        DOM.panelOutput.classList.add('hidden');
        DOM.panelInput.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

function resetAll() {
    state.sourceFile = null;
    state.sourceImage = null;
    state.sourceDataUrl = null;
    if (state.outputUrl) {
        URL.revokeObjectURL(state.outputUrl);
        state.outputUrl = null;
    }
    DOM.fileInput.value = '';
    DOM.panelSourceInfo.classList.add('hidden');
    DOM.panelSettings.classList.add('hidden');
    DOM.panelAction.classList.add('hidden');
    DOM.panelOutput.classList.add('hidden');
    DOM.panelInput.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.addEventListener('DOMContentLoaded', init);
