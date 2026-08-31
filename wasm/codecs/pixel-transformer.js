// WebAssembly pixel transformer module

let wasmInstance = null;

export async function loadPixelTransformer() {
    if (wasmInstance) return wasmInstance;

    try {
        const response = await fetch('wasm/codecs/pixel-transformer.wasm');
        const bytes = await response.arrayBuffer();
        const module = await WebAssembly.instantiate(bytes);
        wasmInstance = module.instance.exports;
        return wasmInstance;
    } catch (err) {
        return null;
    }
}

export async function quantizePixelsWasm(imageData, step = 16) {
    const wasm = await loadPixelTransformer();
    if (!wasm) return imageData; // Fallback to JS if WASM fails

    const data = imageData.data;
    const len = data.length;

    // Ensure memory has enough capacity
    const pagesNeeded = Math.ceil(len / 65536);
    const currentPages = wasm.memory.buffer.byteLength / 65536;
    if (pagesNeeded > currentPages) {
        wasm.memory.grow(pagesNeeded - currentPages);
    }

    const wasmMem = new Uint8Array(wasm.memory.buffer, 0, len);
    wasmMem.set(data);

    // Call compiled WebAssembly function
    wasm.quantize(len, step);

    // Copy modified buffer back into ImageData
    data.set(new Uint8Array(wasm.memory.buffer, 0, len));
    return imageData;
}
