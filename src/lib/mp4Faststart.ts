/**
 * Client-side MP4 faststart (moov atom relocation) using mp4box.js.
 * Rewrites the file so the moov atom is at the beginning, enabling
 * instant streaming and seeking without downloading the full file.
 *
 * Also extracts duration metadata.
 */

import { createFile, DataStream } from "mp4box";

export interface FaststartResult {
  file: File;
  durationSeconds: number;
  alreadyFaststart: boolean;
}

/**
 * Detect moov/mdat atom order by scanning the top-level boxes.
 * Returns true if moov appears before mdat (already faststart).
 */
function checkMoovBeforeMdat(buffer: ArrayBuffer): boolean {
  const view = new DataView(buffer);
  let offset = 0;
  let moovOffset = -1;
  let mdatOffset = -1;

  while (offset < buffer.byteLength - 8) {
    const size = view.getUint32(offset);
    const type = String.fromCharCode(
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7)
    );

    if (type === "moov" && moovOffset === -1) moovOffset = offset;
    if (type === "mdat" && mdatOffset === -1) mdatOffset = offset;

    if (moovOffset >= 0 && mdatOffset >= 0) break;

    // Handle size=0 (box extends to EOF) and size=1 (64-bit size)
    if (size === 0) break;
    if (size === 1) {
      // 64-bit box size
      if (offset + 16 > buffer.byteLength) break;
      const hi = view.getUint32(offset + 8);
      const lo = view.getUint32(offset + 12);
      const bigSize = hi * 0x100000000 + lo;
      offset += bigSize;
    } else {
      if (size < 8) break; // malformed
      offset += size;
    }
  }

  if (moovOffset === -1 || mdatOffset === -1) return true; // can't tell, assume ok
  return moovOffset < mdatOffset;
}

/**
 * Rewrite the MP4 file with moov atom moved before mdat.
 * Uses a manual byte-level approach: reads the file, finds moov and mdat,
 * and reconstructs the file with moov first.
 */
async function relocateMoov(
  inputFile: File,
  onProgress?: (stage: string) => void
): Promise<File> {
  onProgress?.("Optimizing video for streaming…");

  const buffer = await inputFile.arrayBuffer();
  const view = new DataView(buffer);

  // Parse top-level boxes
  interface Box {
    type: string;
    offset: number;
    size: number;
  }

  const boxes: Box[] = [];
  let offset = 0;

  while (offset < buffer.byteLength - 8) {
    let size = view.getUint32(offset);
    const type = String.fromCharCode(
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7)
    );

    if (size === 0) {
      // Box extends to end of file
      size = buffer.byteLength - offset;
    } else if (size === 1) {
      // 64-bit size
      if (offset + 16 > buffer.byteLength) break;
      const hi = view.getUint32(offset + 8);
      const lo = view.getUint32(offset + 12);
      size = hi * 0x100000000 + lo;
    }

    if (size < 8) break; // malformed

    boxes.push({ type, offset, size });
    offset += size;
  }

  // Find moov and mdat
  const moovBox = boxes.find((b) => b.type === "moov");
  const mdatBox = boxes.find((b) => b.type === "mdat");

  if (!moovBox || !mdatBox) {
    console.warn("Could not find moov/mdat boxes, returning original");
    return inputFile;
  }

  // If moov is already before mdat, no rewrite needed
  if (moovBox.offset < mdatBox.offset) {
    return inputFile;
  }

  onProgress?.("Moving metadata to start…");

  // Calculate the offset shift: moov will move from after mdat to before mdat
  // All chunk offsets in moov's stco/co64 tables need adjustment
  const moovData = new Uint8Array(buffer, moovBox.offset, moovBox.size);
  const moovCopy = new Uint8Array(moovData.length);
  moovCopy.set(moovData);

  // The shift amount: moov is moving from its current position to just before mdat
  // mdat and everything between old-mdat-start and old-moov-start shifts forward by moov.size
  // Actually: we reorder boxes as: [pre-mdat boxes] [moov] [mdat] [post-moov boxes]
  // So mdat's data shifts by +moov.size, meaning chunk offsets in moov decrease by the distance moov moved

  // Simpler: rebuild file as [everything before mdat] + [moov] + [mdat] + [everything after moov]
  // Calculate new positions
  const beforeMdat: Uint8Array[] = [];
  let beforeMdatSize = 0;
  const afterMoov: Uint8Array[] = [];

  for (const box of boxes) {
    if (box.offset < mdatBox.offset) {
      const slice = new Uint8Array(buffer, box.offset, box.size);
      beforeMdat.push(slice);
      beforeMdatSize += box.size;
    }
  }

  // Boxes between mdat and moov (exclusive)
  const betweenBoxes: Uint8Array[] = [];
  let betweenSize = 0;
  for (const box of boxes) {
    if (box.offset > mdatBox.offset && box.offset < moovBox.offset && box.type !== "moov") {
      const slice = new Uint8Array(buffer, box.offset, box.size);
      betweenBoxes.push(slice);
      betweenSize += box.size;
    }
  }

  // Boxes after moov
  for (const box of boxes) {
    if (box.offset > moovBox.offset) {
      const slice = new Uint8Array(buffer, box.offset, box.size);
      afterMoov.push(slice);
    }
  }

  // New layout: [beforeMdat] [moov] [between] [mdat] [afterMoov]
  // mdat was at beforeMdatSize, now at beforeMdatSize + moovBox.size + betweenSize
  // Wait, between boxes were between mdat and moov originally.
  // New layout: [beforeMdat] [moov] [mdat] [between] [afterMoov]
  // Actually simplest correct layout:
  // [beforeMdat] [moov] [mdat] [afterMoov-minus-moov]
  // where afterMoov-minus-moov is everything after mdat that isn't moov

  // Let's do it cleanly:
  // Original order: [pre-mdat boxes] [mdat] [boxes-between] [moov] [post-moov boxes]
  // New order:      [pre-mdat boxes] [moov'] [mdat] [boxes-between] [post-moov boxes]
  // Offset change for chunk offsets: mdat moved from beforeMdatSize to (beforeMdatSize + moovBox.size)
  // So all chunk offsets need to increase by moovBox.size

  const offsetDelta = moovBox.size;

  // Fix stco (32-bit chunk offsets) and co64 (64-bit chunk offsets) in moov
  fixChunkOffsets(moovCopy, offsetDelta);

  // Build the new file
  const mdatData = new Uint8Array(buffer, mdatBox.offset, mdatBox.size);
  const totalSize = buffer.byteLength;
  const result = new Uint8Array(totalSize);
  let writePos = 0;

  // Write pre-mdat boxes
  for (const slice of beforeMdat) {
    result.set(slice, writePos);
    writePos += slice.length;
  }

  // Write moov (with fixed offsets)
  result.set(moovCopy, writePos);
  writePos += moovCopy.length;

  // Write mdat
  result.set(mdatData, writePos);
  writePos += mdatData.length;

  // Write between boxes
  for (const slice of betweenBoxes) {
    result.set(slice, writePos);
    writePos += slice.length;
  }

  // Write after-moov boxes
  for (const slice of afterMoov) {
    result.set(slice, writePos);
    writePos += slice.length;
  }

  onProgress?.("Optimization complete");

  return new File([result], inputFile.name, { type: inputFile.type || "video/mp4" });
}

/**
 * Walk through the moov box and fix all stco/co64 chunk offset entries.
 */
function fixChunkOffsets(moovData: Uint8Array, delta: number): void {
  const view = new DataView(moovData.buffer, moovData.byteOffset, moovData.byteLength);

  function walkBox(start: number, end: number) {
    let offset = start;

    while (offset < end - 8) {
      let size = view.getUint32(offset);
      const type = String.fromCharCode(
        view.getUint8(offset + 4),
        view.getUint8(offset + 5),
        view.getUint8(offset + 6),
        view.getUint8(offset + 7)
      );

      if (size === 0) size = end - offset;
      if (size === 1 && offset + 16 <= end) {
        const hi = view.getUint32(offset + 8);
        const lo = view.getUint32(offset + 12);
        size = hi * 0x100000000 + lo;
      }
      if (size < 8 || offset + size > end) break;

      if (type === "stco") {
        // 32-bit chunk offsets
        // Box: [size(4)][type(4)][version(1)][flags(3)][entry_count(4)][entries...]
        const entryCount = view.getUint32(offset + 12);
        for (let i = 0; i < entryCount; i++) {
          const entryOffset = offset + 16 + i * 4;
          if (entryOffset + 4 > offset + size) break;
          const oldVal = view.getUint32(entryOffset);
          view.setUint32(entryOffset, oldVal + delta);
        }
      } else if (type === "co64") {
        // 64-bit chunk offsets
        const entryCount = view.getUint32(offset + 12);
        for (let i = 0; i < entryCount; i++) {
          const entryOffset = offset + 16 + i * 8;
          if (entryOffset + 8 > offset + size) break;
          const hi = view.getUint32(entryOffset);
          const lo = view.getUint32(entryOffset + 4);
          const val = hi * 0x100000000 + lo + delta;
          view.setUint32(entryOffset, Math.floor(val / 0x100000000));
          view.setUint32(entryOffset + 4, val >>> 0);
        }
      } else if (
        type === "moov" || type === "trak" || type === "mdia" ||
        type === "minf" || type === "stbl" || type === "edts" ||
        type === "dinf" || type === "udta"
      ) {
        // Container box — recurse into children (skip 8-byte header)
        walkBox(offset + 8, offset + size);
      }

      offset += size;
    }
  }

  walkBox(0, moovData.byteLength);
}

/**
 * Extract duration from MP4 using mp4box.js.
 */
function extractDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const mp4boxFile = createFile();
    let resolved = false;

    (mp4boxFile as any).onError = () => {
      if (!resolved) { resolved = true; resolve(0); }
    };

    (mp4boxFile as any).onReady = (info: any) => {
      if (resolved) return;
      resolved = true;
      let dur = 0;
      if (info.duration && info.timescale) {
        dur = Math.round(info.duration / info.timescale);
      } else if (info.tracks?.[0]?.duration && info.tracks[0].timescale) {
        dur = Math.round(info.tracks[0].duration / info.tracks[0].timescale);
      }
      resolve(dur);
    };

    const reader = file.stream().getReader();
    let offset = 0;

    function readChunk() {
      reader.read().then(({ done, value }) => {
        if (resolved) return;
        if (done) { (mp4boxFile as any).flush(); return; }

        const buf = value.buffer.slice(
          value.byteOffset, value.byteOffset + value.byteLength
        ) as ArrayBuffer & { fileStart: number };
        buf.fileStart = offset;
        offset += value.byteLength;
        (mp4boxFile as any).appendBuffer(buf);
        readChunk();
      }).catch(() => {
        if (!resolved) { resolved = true; resolve(0); }
      });
    }

    readChunk();
    setTimeout(() => { if (!resolved) { resolved = true; resolve(0); } }, 15000);
  });
}

/**
 * Ensures the MP4 file has moov atom before mdat (faststart).
 * If moov is already first, returns the original file.
 * If not, rewrites the file with moov relocated.
 * Also extracts duration metadata.
 */
export async function ensureFaststart(
  inputFile: File,
  onProgress?: (stage: string) => void
): Promise<FaststartResult> {
  onProgress?.("Analyzing video…");

  // For very large files (>500MB), skip rewriting to avoid memory issues
  if (inputFile.size > 500 * 1024 * 1024) {
    onProgress?.("Large file — skipping optimization");
    const duration = await extractDuration(inputFile);
    return { file: inputFile, durationSeconds: duration, alreadyFaststart: true };
  }

  try {
    // Read enough to check moov/mdat order
    // We need to scan top-level boxes, so we need the full file
    const buffer = await inputFile.arrayBuffer();
    const isFaststart = checkMoovBeforeMdat(buffer);

    // Extract duration
    const duration = await extractDuration(inputFile);

    if (isFaststart) {
      onProgress?.("Video already optimized ✓");
      return { file: inputFile, durationSeconds: duration, alreadyFaststart: true };
    }

    // Need to relocate moov
    const optimizedFile = await relocateMoov(inputFile, onProgress);

    return {
      file: optimizedFile,
      durationSeconds: duration,
      alreadyFaststart: false,
    };
  } catch (err) {
    console.warn("Faststart optimization failed, using original:", err);
    onProgress?.("Optimization skipped");
    const duration = await extractDuration(inputFile);
    return { file: inputFile, durationSeconds: duration, alreadyFaststart: true };
  }
}
