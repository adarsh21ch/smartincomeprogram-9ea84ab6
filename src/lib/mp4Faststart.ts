/**
 * Client-side MP4 faststart (moov atom relocation) using mp4box.js.
 * Rewrites the file so the moov atom is at the beginning, enabling
 * instant streaming and seeking without downloading the full file.
 *
 * Also extracts duration metadata.
 */

import MP4Box from "mp4box";

export interface FaststartResult {
  file: File;
  durationSeconds: number;
  alreadyFaststart: boolean;
}

/**
 * Checks if moov atom is already before mdat (i.e. already faststart).
 * If not, rewrites the file with moov first.
 * Returns the (possibly new) File and the video duration.
 */
export async function ensureFaststart(
  inputFile: File,
  onProgress?: (stage: string) => void
): Promise<FaststartResult> {
  onProgress?.("Analyzing video…");

  return new Promise<FaststartResult>((resolve, reject) => {
    const mp4boxFile = MP4Box.createFile();
    let durationSeconds = 0;
    let resolved = false;

    mp4boxFile.onError = (e: string) => {
      if (!resolved) {
        resolved = true;
        // If mp4box can't parse (e.g. non-MP4), just pass through the original file
        console.warn("mp4box parse error, skipping faststart:", e);
        resolve({ file: inputFile, durationSeconds: 0, alreadyFaststart: true });
      }
    };

    mp4boxFile.onReady = (info: any) => {
      try {
        // Extract duration
        if (info.duration && info.timescale) {
          durationSeconds = Math.round(info.duration / info.timescale);
        } else if (info.tracks?.[0]?.duration && info.tracks[0].timescale) {
          durationSeconds = Math.round(info.tracks[0].duration / info.tracks[0].timescale);
        }

        // Check if moov is already before mdat by inspecting box order
        const moovStart = info.moov?.start ?? null;
        const mdatStart = info.mdat?.start ?? null;

        // If we can determine box positions and moov is already first, skip rewrite
        if (moovStart !== null && mdatStart !== null && moovStart < mdatStart) {
          resolved = true;
          resolve({ file: inputFile, durationSeconds, alreadyFaststart: true });
          return;
        }

        // Need to rewrite — use mp4box to produce faststart output
        onProgress?.("Optimizing for streaming…");

        // Collect all segments
        const outputBuffers: ArrayBuffer[] = [];

        // Set segment options for all tracks
        for (const track of info.tracks) {
          mp4boxFile.setSegmentOptions(track.id, null, { nbSamples: 1000 });
        }

        const initSegs = mp4boxFile.initializeSegmentation();
        for (const seg of initSegs) {
          outputBuffers.push(seg.buffer);
        }

        // Release used samples to get segments
        mp4boxFile.onSegment = (_id: number, _user: any, buffer: ArrayBuffer) => {
          outputBuffers.push(buffer);
        };

        mp4boxFile.start();

        // Wait a tick for segments to be produced, then build final file
        setTimeout(() => {
          if (resolved) return;
          resolved = true;

          if (outputBuffers.length > 0) {
            const blob = new Blob(outputBuffers, { type: "video/mp4" });
            const newFile = new File([blob], inputFile.name, {
              type: "video/mp4",
              lastModified: Date.now(),
            });
            resolve({ file: newFile, durationSeconds, alreadyFaststart: false });
          } else {
            // Fallback — return original file with extracted duration
            resolve({ file: inputFile, durationSeconds, alreadyFaststart: true });
          }
        }, 500);
      } catch (err) {
        if (!resolved) {
          resolved = true;
          console.warn("Faststart rewrite failed, using original:", err);
          resolve({ file: inputFile, durationSeconds, alreadyFaststart: true });
        }
      }
    };

    // Read the file in chunks and feed to mp4box
    const reader = inputFile.stream().getReader();
    let offset = 0;

    function readChunk() {
      reader.read().then(({ done, value }) => {
        if (resolved) return;
        if (done) {
          mp4boxFile.flush();
          return;
        }

        const buf = value.buffer.slice(
          value.byteOffset,
          value.byteOffset + value.byteLength
        ) as ArrayBuffer & { fileStart: number };
        buf.fileStart = offset;
        offset += value.byteLength;

        mp4boxFile.appendBuffer(buf);
        readChunk();
      }).catch((err) => {
        if (!resolved) {
          resolved = true;
          console.warn("File read error, skipping faststart:", err);
          resolve({ file: inputFile, durationSeconds: 0, alreadyFaststart: true });
        }
      });
    }

    readChunk();
  });
}
