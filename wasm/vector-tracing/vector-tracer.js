// WebAssembly accelerated vector edge tracer

let wasmInstance = null;

export async function loadEdgeTracer() {
    if (wasmInstance) return wasmInstance;

    try {
        const response = await fetch('wasm/vector-tracing/edge-tracer.wasm');
        const bytes = await response.arrayBuffer();
        const module = await WebAssembly.instantiate(bytes);
        wasmInstance = module.instance.exports;
        return wasmInstance;
    } catch {
        return null;
    }
}

export async function detectEdgesWasm(imageData, threshold = 128) {
    const wasm = await loadEdgeTracer();
    const width = imageData.width;
    const height = imageData.height;
    const totalPixels = width * height;
    const totalBytes = totalPixels * 4;

    if (!wasm) {
        // Fallback edge mask if WASM unavailable
        const mask = new Uint8Array(totalPixels);
        const data = imageData.data;
        for (let i = 0; i < totalPixels; i++) {
            mask[i] = data[i * 4] > threshold ? 255 : 0;
        }
        return mask;
    }

    const pagesNeeded = Math.ceil(totalBytes / 65536);
    const currentPages = wasm.memory.buffer.byteLength / 65536;
    if (pagesNeeded > currentPages) {
        wasm.memory.grow(pagesNeeded - currentPages);
    }

    const wasmMem = new Uint8Array(wasm.memory.buffer, 0, totalBytes);
    wasmMem.set(imageData.data);

    // Run WASM edge detection
    wasm.detectEdges(width, height, threshold);

    // Read back 1-byte-per-pixel edge mask from WASM memory
    const edgeMask = new Uint8Array(wasm.memory.buffer, 0, totalPixels);
    return new Uint8Array(edgeMask);
}
