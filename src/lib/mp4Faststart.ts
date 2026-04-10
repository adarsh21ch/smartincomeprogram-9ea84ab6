/**
 * Lightweight MP4 duration extraction using mp4box.js.
 * Moov relocation removed — handled at encoding time or by CDN.
 */

import { createFile } from "mp4box";

/**
 * Extract duration from MP4 using mp4box.js (streams the file, low memory).
 */
export function extractDuration(file: File): Promise<number> {
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
