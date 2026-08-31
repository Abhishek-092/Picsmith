// Main application bootstrap and module coordinator

import { store } from './state.js';
import { UIController } from './ui.js';
import { FileManager } from './file-manager.js';
import { ConversionRouter } from './conversion-router.js';

class App {
    constructor() {
        this.ui = new UIController();
        this.router = new ConversionRouter();
        this.fileManager = new FileManager({
            onFileLoaded: (data) => this.handleFileLoaded(data),
            onError: (msg) => this.ui.showError(msg)
        });
    }

    init() {
        this.setupFileInputs();
        this.setupSettingsListeners();
        this.setupConversionActions();
        this.setupOutputActions();

        this.ui.dom.dismissErrorBtn.addEventListener('click', () => this.ui.hideError());
    }

    setupFileInputs() {
        this.fileManager.setupDragAndDrop(this.ui.dom.dropZone, (isHovered) => {
            if (isHovered) this.ui.triggerIconRise();
        });

        this.fileManager.setupFileInput(this.ui.dom.fileInput);
        this.fileManager.setupClipboard();

        this.ui.dom.dropZone.addEventListener('click', () => {
            this.ui.triggerIconRise();
            this.ui.dom.fileInput.click();
        });
    }

    handleFileLoaded(fileData) {
        this.ui.hideError();

        store.set({
            sourceFile: fileData.file,
            sourceImage: fileData.image,
            sourceDataUrl: fileData.dataUrl,
            sourceName: fileData.name,
            sourceSize: fileData.size,
            sourceType: fileData.type,
            sourceFormat: fileData.format,
            sourceWidth: fileData.width,
            sourceHeight: fileData.height,
            aspectRatio: fileData.aspectRatio,
            targetWidth: fileData.width,
            targetHeight: fileData.height
        });

        this.ui.renderSourceMetrics(store.get());
        this.ui.updateSettingsUI(store.get());
    }

    setupSettingsListeners() {
        const dom = this.ui.dom;

        // Format selector cards
        dom.formatCards.forEach(card => {
            card.addEventListener('click', () => {
                dom.formatCards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');

                store.set({ targetFormat: card.dataset.format });
                this.ui.updateSettingsUI(store.get());
            });
        });

        // Quality slider
        dom.inputQuality.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            store.set({ targetQuality: val / 100 });
            dom.qualityValDisplay.textContent = `${val}%`;

            dom.qualityPresets.forEach(pill => {
                pill.classList.toggle('active', parseInt(pill.dataset.quality, 10) === val);
            });
        });

        // Quality presets
        dom.qualityPresets.forEach(pill => {
            pill.addEventListener('click', () => {
                const q = parseInt(pill.dataset.quality, 10);
                dom.inputQuality.value = q;
                store.set({ targetQuality: q / 100 });
                dom.qualityValDisplay.textContent = `${q}%`;
                dom.qualityPresets.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
            });
        });

        // Aspect ratio lock toggle
        dom.btnLockAspect.addEventListener('click', () => {
            const currentState = store.get();
            const locked = !currentState.aspectLocked;
            store.set({ aspectLocked: locked });
            dom.btnLockAspect.classList.toggle('active', locked);
        });

        // Width / Height inputs
        dom.inputWidth.addEventListener('input', () => {
            const w = parseInt(dom.inputWidth.value, 10);
            const state = store.get();

            if (!isNaN(w) && w > 0) {
                const updates = { targetWidth: w };
                if (state.aspectLocked && state.aspectRatio) {
                    updates.targetHeight = Math.round(w / state.aspectRatio);
                    dom.inputHeight.value = updates.targetHeight;
                }
                store.set(updates);
                this.ui.updateSettingsUI(store.get());
            }
        });

        dom.inputHeight.addEventListener('input', () => {
            const h = parseInt(dom.inputHeight.value, 10);
            const state = store.get();

            if (!isNaN(h) && h > 0) {
                const updates = { targetHeight: h };
                if (state.aspectLocked && state.aspectRatio) {
                    updates.targetWidth = Math.round(h * state.aspectRatio);
                    dom.inputWidth.value = updates.targetWidth;
                }
                store.set(updates);
                this.ui.updateSettingsUI(store.get());
            }
        });

        // Scale & Dimension presets
        dom.dimPresets.forEach(btn => {
            btn.addEventListener('click', () => {
                dom.dimPresets.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const state = store.get();
                let newW = state.sourceWidth;
                let newH = state.sourceHeight;

                if (btn.dataset.scale) {
                    const scale = parseFloat(btn.dataset.scale);
                    newW = Math.round(state.sourceWidth * scale);
                    newH = Math.round(state.sourceHeight * scale);
                } else if (btn.dataset.presetSize) {
                    const targetSize = parseInt(btn.dataset.presetSize, 10);
                    if (state.sourceWidth >= state.sourceHeight) {
                        newW = targetSize;
                        newH = Math.round(targetSize / state.aspectRatio);
                    } else {
                        newH = targetSize;
                        newW = Math.round(targetSize * state.aspectRatio);
                    }
                }

                dom.inputWidth.value = newW;
                dom.inputHeight.value = newH;
                store.set({ targetWidth: newW, targetHeight: newH });
                this.ui.updateSettingsUI(store.get());
            });
        });

        // Matte color for JPEG
        dom.inputMatteColor.addEventListener('input', (e) => {
            const color = e.target.value;
            store.set({ matteColor: color });
            dom.matteColorHex.textContent = `${color.toUpperCase()} (${color === '#ffffff' ? 'WHITE' : 'CUSTOM'})`;
        });

        // SVG mode radios
        document.querySelectorAll('input[name="svg-engine-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                store.set({ svgMode: e.target.value });
            });
        });

        // Reset source button
        dom.btnRemoveSource.addEventListener('click', () => {
            store.reset();
            this.ui.resetView();
        });
    }

    setupConversionActions() {
        this.ui.dom.btnConvertAction.addEventListener('click', () => this.executeConversion());
    }

    async executeConversion() {
        const state = store.get();
        if (!state.sourceImage) {
            this.ui.showError('No source image loaded.');
            return;
        }

        this.ui.hideError();
        const startTime = performance.now();

        // Selected ICO sizes
        const icoSizes = [];
        if (this.ui.dom.icoCheckboxes[16]?.checked) icoSizes.push(16);
        if (this.ui.dom.icoCheckboxes[32]?.checked) icoSizes.push(32);
        if (this.ui.dom.icoCheckboxes[48]?.checked) icoSizes.push(48);
        if (this.ui.dom.icoCheckboxes[64]?.checked) icoSizes.push(64);

        try {
            const result = await this.router.routeConversion(
                {
                    sourceFile: state.sourceFile,
                    sourceImage: state.sourceImage,
                    sourceFormat: state.sourceFormat,
                    targetFormat: state.targetFormat,
                    targetWidth: state.targetWidth || state.sourceWidth,
                    targetHeight: state.targetHeight || state.sourceHeight,
                    quality: state.targetQuality,
                    matteColor: state.matteColor,
                    icoSizes: icoSizes.length > 0 ? icoSizes : [32],
                    svgMode: state.svgMode
                },
                (progress, label) => this.ui.setProgress(progress, label)
            );

            const endTime = performance.now();
            const duration = Math.round(endTime - startTime);

            const oldUrl = state.outputUrl;
            if (oldUrl) URL.revokeObjectURL(oldUrl);

            const outputUrl = URL.createObjectURL(result.blob);

            store.set({
                outputBlob: result.blob,
                outputUrl,
                outputSize: result.blob.size,
                outputWidth: result.width,
                outputHeight: result.height,
                conversionTimeMs: duration
            });

            this.ui.hideProgress();
            this.ui.renderOutputArtifact(store.get());

        } catch (err) {
            this.ui.hideProgress();
            this.ui.showError(`Conversion failed: ${err.message}`);
        }
    }

    setupOutputActions() {
        const dom = this.ui.dom;

        dom.btnCopyClipboard.addEventListener('click', async () => {
            const state = store.get();
            if (!state.outputBlob) return;

            try {
                let blobToCopy = state.outputBlob;

                // Transcode to PNG for clipboard compatibility if required
                if (state.targetFormat !== 'png') {
                    const canvas = document.createElement('canvas');
                    canvas.width = state.outputWidth;
                    canvas.height = state.outputHeight;
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    await new Promise(r => {
                        img.onload = r;
                        img.src = state.outputUrl;
                    });
                    ctx.drawImage(img, 0, 0);
                    blobToCopy = await new Promise(r => canvas.toBlob(r, 'image/png'));
                }

                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blobToCopy })
                ]);

                const prevText = dom.btnCopyClipboard.textContent;
                dom.btnCopyClipboard.textContent = 'COPIED!';
                setTimeout(() => {
                    dom.btnCopyClipboard.textContent = prevText;
                }, 2000);

            } catch {
                this.ui.showError('Clipboard copy is not supported for this format in this browser. Please use Download.');
            }
        });

        dom.btnViewOutput?.addEventListener('click', () => {
            this.ui.setComparisonView('output', store.get());
        });

        dom.btnViewOriginal?.addEventListener('click', () => {
            this.ui.setComparisonView('original', store.get());
        });

        dom.btnConvertAnother.addEventListener('click', () => {
            dom.panelOutput.classList.add('hidden');
            dom.panelInput.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
