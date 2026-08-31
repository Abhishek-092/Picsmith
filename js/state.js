// Global state management

const initialState = {
    // Source file data
    sourceFile: null,
    sourceImage: null,
    sourceBitmap: null,
    sourceDataUrl: null,
    sourceWidth: 0,
    sourceHeight: 0,
    sourceSize: 0,
    sourceType: '',
    sourceName: '',
    sourceFormat: '',
    
    // Target conversion settings
    targetFormat: 'webp',
    targetQuality: 0.75,
    targetWidth: 0,
    targetHeight: 0,
    aspectLocked: true,
    aspectRatio: 1,
    matteColor: '#ffffff',
    icoSizes: [16, 32, 48, 64],
    svgMode: 'vector-trace',
    
    // Output state
    isConverting: false,
    conversionProgress: 0,
    progressLabel: '',
    outputBlob: null,
    outputUrl: null,
    outputSize: 0,
    outputWidth: 0,
    outputHeight: 0,
    conversionTimeMs: 0,
    errorMessage: null
};

class StateStore {
    constructor() {
        this.state = { ...initialState };
        this.listeners = new Set();
    }

    get() {
        return this.state;
    }

    set(updates) {
        this.state = { ...this.state, ...updates };
        this.notify();
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        for (const listener of this.listeners) {
            listener(this.state);
        }
    }

    reset() {
        if (this.state.outputUrl) {
            URL.revokeObjectURL(this.state.outputUrl);
        }
        this.state = { ...initialState };
        this.notify();
    }
}

export const store = new StateStore();
