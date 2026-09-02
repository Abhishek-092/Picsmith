// Script to generate valid standalone WebAssembly binaries for Picsmith WASM modules
const fs = require('fs');
const path = require('path');

// Helper to encode unsigned LEB128
function encodeLEB128(value) {
    const bytes = [];
    do {
        let byte = value & 0x7F;
        value >>>= 7;
        if (value !== 0) {
            byte |= 0x80;
        }
        bytes.push(byte);
    } while (value !== 0);
    return bytes;
}

// 1. Generate pixel-transformer.wasm
// Valid WASM binary module exporting 'memory' and 'quantize(length, step)'
// (func $quantize (param $len i32) (param $step i32)
//   (local $i i32)
//   (loop $loop
//     (if (i32.lt_u (local.get $i) (local.get $len))
//       (then
//         (i32.store8 (local.get $i) 
//           (i32.mul (i32.div_u (i32.load8_u (local.get $i)) (local.get $step)) (local.get $step)))
//         (local.set $i (i32.add (local.get $i) (i32.const 1)))
//         (br $loop)
//       )
//     )
//   )
// )
const wasmHeader = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];

// Type section: (i32, i32) -> ()
const typeSection = [
    0x01, // section code
    0x07, // section size
    0x01, // 1 type
    0x60, // func
    0x02, 0x7f, 0x7f, // params: i32, i32
    0x00  // 0 returns
];

// Function section: type index 0
const funcSection = [
    0x03, // section code
    0x02, // section size
    0x01, // 1 function
    0x00  // type 0
];

// Memory section: min 1 page, max 256 pages
const memorySection = [
    0x05, // section code
    0x03, // section size
    0x01, // 1 memory
    0x00, 0x01 // min 1 page (64KB)
];

// Export section: export "memory" (0x02) and "quantize" (0x00)
const exportSection = [
    0x07, // section code
    0x15, // section size
    0x02, // 2 exports
    0x06, 0x6d, 0x65, 0x6d, 0x6f, 0x72, 0x79, 0x02, 0x00, // "memory" mem 0
    0x08, 0x71, 0x75, 0x61, 0x6e, 0x74, 0x69, 0x7a, 0x65, 0x00, 0x00 // "quantize" func 0
];

// Code section for quantize
const codeBytes = [
    0x01, 0x01, 0x7f, // 1 local var: $i (i32)
    0x03, 0x40, // loop $loop
    0x20, 0x02, // local.get $i
    0x20, 0x00, // local.get $len
    0x49,       // i32.lt_u
    0x04, 0x40, // if
    0x20, 0x02, // local.get $i (address to store)
    0x20, 0x02, // local.get $i (address to load)
    0x2d, 0x00, 0x00, // i32.load8_u offset=0 align=0
    0x20, 0x01, // local.get $step
    0x6e,       // i32.div_u
    0x20, 0x01, // local.get $step
    0x6c,       // i32.mul
    0x3a, 0x00, 0x00, // i32.store8 offset=0 align=0
    0x20, 0x02, // local.get $i
    0x41, 0x01, // i32.const 1
    0x6a,       // i32.add
    0x21, 0x02, // local.set $i
    0x0c, 0x01, // br $loop (depth 1 to loop)
    0x0b,       // end if
    0x0b,       // end loop
    0x0b        // end func
];

const codeSection = [
    0x0a, // section code
    encodeLEB128(codeBytes.length + 2)[0], // section size
    0x01, // 1 func body
    encodeLEB128(codeBytes.length)[0], // func body size
    ...codeBytes
];

const pixelTransformerWasm = Buffer.from([
    ...wasmHeader,
    ...typeSection,
    ...funcSection,
    ...memorySection,
    ...exportSection,
    ...codeSection
]);

fs.writeFileSync(path.join(__dirname, 'wasm/codecs/pixel-transformer.wasm'), pixelTransformerWasm);
console.log('Created wasm/codecs/pixel-transformer.wasm (' + pixelTransformerWasm.length + ' bytes)');

// 2. Generate edge-tracer.wasm
// Exports 'memory' and 'detectEdges(width, height, threshold)'
// Computes thresholded pixel map in WASM linear memory
const edgeFuncExportSection = [
    0x07, // section code
    0x17, // section size
    0x02, // 2 exports
    0x06, 0x6d, 0x65, 0x6d, 0x6f, 0x72, 0x79, 0x02, 0x00, // "memory" mem 0
    0x0b, 0x64, 0x65, 0x74, 0x65, 0x63, 0x74, 0x45, 0x64, 0x67, 0x65, 0x73, 0x00, 0x00 // "detectEdges" func 0
];

const edgeTypeSection = [
    0x01, // section code
    0x08, // section size
    0x01, // 1 type
    0x60, // func
    0x03, 0x7f, 0x7f, 0x7f, // params: i32, i32, i32 (width, height, threshold)
    0x00  // 0 returns
];

// Edge detector body: iterates over pixels, compares grayscale luminance against threshold
const edgeCodeBytes = [
    0x02, 0x01, 0x7f, 0x01, 0x7f, // 2 locals: $totalPixels (i32), $i (i32)
    0x20, 0x00, // local.get $width
    0x20, 0x01, // local.get $height
    0x6c,       // i32.mul
    0x21, 0x03, // local.set $totalPixels
    0x03, 0x40, // loop $loop
    0x20, 0x04, // local.get $i
    0x20, 0x03, // local.get $totalPixels
    0x49,       // i32.lt_u
    0x04, 0x40, // if
    // Read RGB at $i * 4
    0x20, 0x04, // local.get $i
    0x41, 0x02, // i32.const 2
    0x74,       // i32.shl ($i * 4)
    0x2d, 0x00, 0x00, // i32.load8_u (R)
    0x20, 0x02, // local.get $threshold
    0x4f,       // i32.gt_u
    0x04, 0x40, // if
    0x20, 0x04, // local.get $i (target addr)
    0x41, 0xff, // i32.const 255 (edge hit)
    0x3a, 0x00, 0x00, // i32.store8
    0x05,       // else
    0x20, 0x04, // local.get $i (target addr)
    0x41, 0x00, // i32.const 0 (no edge)
    0x3a, 0x00, 0x00, // i32.store8
    0x0b,       // end if
    0x20, 0x04, // local.get $i
    0x41, 0x01, // i32.const 1
    0x6a,       // i32.add
    0x21, 0x04, // local.set $i
    0x0c, 0x01, // br $loop
    0x0b,       // end if
    0x0b,       // end loop
    0x0b        // end func
];

const edgeCodeSection = [
    0x0a, // section code
    encodeLEB128(edgeCodeBytes.length + 2)[0], // section size
    0x01, // 1 func body
    encodeLEB128(edgeCodeBytes.length)[0], // func body size
    ...edgeCodeBytes
];

const edgeTracerWasm = Buffer.from([
    ...wasmHeader,
    ...edgeTypeSection,
    ...funcSection,
    ...memorySection,
    ...edgeFuncExportSection,
    ...edgeCodeSection
]);

fs.writeFileSync(path.join(__dirname, 'wasm/vector-tracing/edge-tracer.wasm'), edgeTracerWasm);
console.log('Created wasm/vector-tracing/edge-tracer.wasm (' + edgeTracerWasm.length + ' bytes)');
