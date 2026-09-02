// UI Controller managing DOM interactions, estimation and view updates

import { formatBytes, calculateAspectRatio, generateOutputFilename } from './utils/filename.js';

export class UIController {
    constructor() {
        this.dom = {
            errorBanner: document.getElementById('error-banner'),
            errorMessage: document.getElementById('error-message'),
            dismissErrorBtn: document.getElementById('dismiss-error-btn'),
            
            panelInput: document.getElementById('panel-input'),
            panelSourceInfo: document.getElementById('panel-source-info'),
            panelSettings: document.getElementById('panel-settings'),
            panelAction: document.getElementById('panel-action'),
            panelOutput: document.getElementById('panel-output'),
            
            dropZone: document.getElementById('drop-zone'),
            dropIconBox: document.querySelector('.drop-icon-box'),
            fileInput: document.getElementById('file-input'),
            
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
            
            liveEstSize: document.getElementById('live-est-size'),
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
            outputPreviewTag: document.getElementById('output-preview-tag'),
            btnViewOutput: document.getElementById('btn-view-output'),
            btnViewOriginal: document.getElementById('btn-view-original'),
            outMetricFormat: document.getElementById('out-metric-format'),
            outMetricSize: document.getElementById('out-metric-size'),
            outMetricDimensions: document.getElementById('out-metric-dimensions'),
            outMetricTime: document.getElementById('out-metric-time'),
            btnDownloadArtifact: document.getElementById('btn-download-artifact'),
            btnCopyClipboard: document.getElementById('btn-copy-clipboard'),
            btnConvertAnother: document.getElementById('btn-convert-another')
        };
    }

    showError(msg) {
        this.dom.errorMessage.textContent = msg;
        this.dom.errorBanner.classList.remove('hidden');
        this.dom.errorBanner.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    hideError() {
        this.dom.errorBanner.classList.add('hidden');
    }

    triggerIconRise() {
        if (this.dom.dropIconBox) {
            this.dom.dropIconBox.classList.remove('rise');
            void this.dom.dropIconBox.offsetWidth;
            this.dom.dropIconBox.classList.add('rise');
        }
    }

    renderSourceMetrics(state) {
        this.dom.sourcePreviewImg.src = state.sourceDataUrl;
        this.dom.metricName.textContent = state.sourceName;
        this.dom.metricType.textContent = (state.sourceType.split('/')[1] || state.sourceFormat || 'IMAGE').toUpperCase();
        this.dom.metricSize.textContent = formatBytes(state.sourceSize);
        this.dom.metricDimensions.textContent = `${state.sourceWidth} × ${state.sourceHeight} PX`;
        this.dom.metricAspect.textContent = calculateAspectRatio(state.sourceWidth, state.sourceHeight);

        const megapixels = ((state.sourceWidth * state.sourceHeight) / 1000000).toFixed(2);
        this.dom.metricMegapixels.textContent = `${megapixels} MP`;

        this.dom.inputWidth.value = state.targetWidth || state.sourceWidth;
        this.dom.inputHeight.value = state.targetHeight || state.sourceHeight;

        this.dom.panelSourceInfo.classList.remove('hidden');
        this.dom.panelSettings.classList.remove('hidden');
        this.dom.panelAction.classList.remove('hidden');
        this.dom.panelOutput.classList.add('hidden');
        this.dom.panelSourceInfo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    updateSettingsUI(state) {
        const fmt = state.targetFormat;

        // Quality slider visibility
        if (fmt === 'png') {
            this.dom.cardQualityControl.style.opacity = '0.5';
            this.dom.qualityValDisplay.textContent = 'LOSSLESS';
        } else if (fmt === 'svg') {
            this.dom.cardQualityControl.style.opacity = '0.5';
            this.dom.qualityValDisplay.textContent = 'VECTOR';
        } else {
            this.dom.cardQualityControl.style.opacity = '1';
            this.dom.qualityValDisplay.textContent = `${Math.round(state.targetQuality * 100)}%`;
        }

        // Format-specific option toggles
        this.dom.optJpgMatte.classList.toggle('hidden', fmt !== 'jpeg');
        this.dom.optIcoSizes.classList.toggle('hidden', fmt !== 'ico');
        this.dom.optSvgMode.classList.toggle('hidden', fmt !== 'svg');

        // Scale label
        if (state.sourceWidth && state.targetWidth) {
            const ratio = (state.targetWidth / state.sourceWidth).toFixed(2);
            this.dom.scaleIndicatorText.textContent = ratio === '1.00' ? 'ORIGINAL SCALE (1.0X)' : `SCALED (${ratio}X)`;
        }

        this.updateFormatAvailability(state);
        this.calculateEstimatedSize(state);
    }

    updateFormatAvailability(state) {
        const sourceFmt = state.sourceFormat;
        const isAvifEncodable = this.checkAvifEncodingSupport();
        let isCurrentTargetValid = true;

        this.dom.formatCards.forEach(card => {
            const fmt = card.dataset.format;
            let isSupported = true;

            // AVIF browser encoder support
            if (fmt === 'avif' && !isAvifEncodable) {
                isSupported = false;
            }

            // SVG to SVG is redundant / not a valid conversion
            if (sourceFmt === 'svg' && fmt === 'svg') {
                isSupported = false;
            }

            card.classList.toggle('disabled', !isSupported);

            if (state.targetFormat === fmt && !isSupported) {
                isCurrentTargetValid = false;
            }
        });

        return isCurrentTargetValid;
    }

    checkAvifEncodingSupport() {
        if (this._avifSupported !== undefined) return this._avifSupported;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const dataUrl = canvas.toDataURL('image/avif');
            this._avifSupported = dataUrl.startsWith('data:image/avif');
        } catch {
            this._avifSupported = false;
        }
        return this._avifSupported;
    }

    calculateEstimatedSize(state) {
        if (!state.sourceWidth || !state.targetWidth) return;

        const targetW = state.targetWidth || state.sourceWidth;
        const targetH = state.targetHeight || state.sourceHeight;
        const scaleX = targetW / state.sourceWidth;
        const scaleY = targetH / state.sourceHeight;
        const pixelRatio = scaleX * scaleY;
        const totalPixels = targetW * targetH;
        const q = state.targetQuality !== undefined ? state.targetQuality : 0.85;
        const fmt = state.targetFormat;
        const sourceSize = state.sourceSize || 50000;
        const isSourceLossy = state.sourceType?.includes('jpeg') || state.sourceFormat === 'jpeg' || state.sourceType?.includes('webp') || state.sourceFormat === 'webp';

        let estBytes = 0;

        if (fmt === 'webp') {
            if (isSourceLossy) {
                // Converting JPG to WebP at 85% yields ~45-55% of original JPEG size
                const qFactor = Math.pow(q, 1.6);
                estBytes = Math.round(sourceSize * pixelRatio * (0.15 + (qFactor * 0.42)));
            } else {
                const bpp = 0.04 + (Math.pow(q, 1.8) * 0.22);
                estBytes = Math.round(totalPixels * bpp);
            }
        } else if (fmt === 'jpeg') {
            if (isSourceLossy) {
                const qFactor = Math.pow(q, 1.7);
                estBytes = Math.round(sourceSize * pixelRatio * (0.3 + (qFactor * 0.65)));
            } else {
                const bpp = 0.05 + (Math.pow(q, 1.8) * 0.30);
                estBytes = Math.round(totalPixels * bpp);
            }
        } else if (fmt === 'avif') {
            if (isSourceLossy) {
                const qFactor = Math.pow(q, 1.6);
                estBytes = Math.round(sourceSize * pixelRatio * (0.10 + (qFactor * 0.32)));
            } else {
                const bpp = 0.02 + (Math.pow(q, 1.8) * 0.15);
                estBytes = Math.round(totalPixels * bpp);
            }
        } else if (fmt === 'png') {
            if (isSourceLossy) {
                // Lossless expansion from lossy source
                estBytes = Math.round(Math.min(totalPixels * 0.7, sourceSize * pixelRatio * 3.8));
            } else {
                estBytes = Math.round(sourceSize * pixelRatio);
            }
        } else if (fmt === 'ico') {
            const sizes = state.icoSizes || [16, 32, 48, 64];
            let icoBytes = 6 + (16 * sizes.length);
            for (const s of sizes) {
                icoBytes += Math.round(s * s * 0.5) + 40;
            }
            estBytes = icoBytes;
        } else if (fmt === 'svg') {
            if (state.svgMode === 'vector-trace') {
                const traceGrid = Math.min(256 * 256, totalPixels);
                estBytes = Math.round(traceGrid * 0.35 + 800);
            } else {
                estBytes = Math.round(sourceSize * pixelRatio * 1.35 + 400);
            }
        }

        if (this.dom.liveEstSize) {
            const isLosslessExpansion = fmt === 'png' && isSourceLossy;
            const expansionTag = isLosslessExpansion ? ' (LOSSLESS FORMAT)' : '';
            this.dom.liveEstSize.textContent = `~ ${formatBytes(estBytes)} ${expansionTag}`;
        }
    }

    setProgress(percent, label) {
        this.dom.actionTriggerBox.classList.add('hidden');
        this.dom.conversionProgressBox.classList.remove('hidden');
        this.dom.progressBarFill.style.width = `${percent}%`;
        this.dom.progressPhasePercent.textContent = `${percent}%`;
        this.dom.progressPhaseLabel.textContent = label;
    }

    hideProgress() {
        this.dom.actionTriggerBox.classList.remove('hidden');
        this.dom.conversionProgressBox.classList.add('hidden');
    }

    renderOutputArtifact(state) {
        this.dom.outputPreviewImg.src = state.outputUrl;
        this.dom.outputPreviewTag.textContent = 'TARGET READY';
        this.dom.btnViewOutput?.classList.add('active');
        this.dom.btnViewOriginal?.classList.remove('active');

        this.dom.outMetricFormat.textContent = state.targetFormat.toUpperCase();
        this.dom.outMetricSize.textContent = formatBytes(state.outputSize);
        this.dom.outMetricDimensions.textContent = `${state.outputWidth} × ${state.outputHeight} PX`;
        this.dom.outMetricTime.textContent = `${state.conversionTimeMs} MS`;

        // Size difference calculation
        const deltaBytes = state.outputSize - state.sourceSize;
        const deltaPercent = Math.round((deltaBytes / state.sourceSize) * 100);

        if (deltaPercent < 0) {
            this.dom.outputSavingsBadge.textContent = `${Math.abs(deltaPercent)}% SMALLER (${formatBytes(Math.abs(deltaBytes))} SAVED)`;
            this.dom.outputSavingsBadge.className = 'savings-badge';
        } else if (deltaPercent === 0) {
            this.dom.outputSavingsBadge.textContent = 'IDENTICAL FILE SIZE';
            this.dom.outputSavingsBadge.className = 'savings-badge';
        } else {
            this.dom.outputSavingsBadge.textContent = `+${deltaPercent}% EXPANDED`;
            this.dom.outputSavingsBadge.className = 'savings-badge increased';
        }

        const downloadFilename = generateOutputFilename(state.sourceName, state.targetFormat);
        this.dom.btnDownloadArtifact.href = state.outputUrl;
        this.dom.btnDownloadArtifact.download = downloadFilename;

        this.dom.panelOutput.classList.remove('hidden');
        this.dom.panelOutput.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setComparisonView(mode, state) {
        if (mode === 'original') {
            this.dom.outputPreviewImg.src = state.sourceDataUrl;
            this.dom.outputPreviewTag.textContent = 'ORIGINAL SOURCE';
            this.dom.btnViewOriginal?.classList.add('active');
            this.dom.btnViewOutput?.classList.remove('active');
        } else {
            this.dom.outputPreviewImg.src = state.outputUrl;
            this.dom.outputPreviewTag.textContent = 'CONVERTED TARGET';
            this.dom.btnViewOutput?.classList.add('active');
            this.dom.btnViewOriginal?.classList.remove('active');
        }
    }

    resetView() {
        this.dom.fileInput.value = '';
        this.dom.panelSourceInfo.classList.add('hidden');
        this.dom.panelSettings.classList.add('hidden');
        this.dom.panelAction.classList.add('hidden');
        this.dom.panelOutput.classList.add('hidden');
        this.dom.panelInput.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
