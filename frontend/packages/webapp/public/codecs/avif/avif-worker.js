/*
 * Based on GoogleChromeLabs/squoosh AVIF encoder worker (Apache-2.0).
 * See ./LICENSE.txt for the Apache License 2.0 notice.
 */
import avifEncFactory from './avif_enc.js';

let encoderPromise = null;

async function getEncoder() {
  if (!encoderPromise) {
    encoderPromise = avifEncFactory({ noInitialRun: true });
  }
  return encoderPromise;
}

self.addEventListener('message', async (event) => {
  const payload = event.data || {};
  const { id, rgbaBuffer, width, height, options } = payload;

  try {
    const module = await getEncoder();
    const rgba = new Uint8ClampedArray(rgbaBuffer);
    const encoded = module.encode(rgba, width, height, options);
    if (!encoded || encoded.byteLength === 0) {
      self.postMessage({ id, error: 'AVIF encoding returned empty output.' });
      return;
    }

    const outputBuffer = encoded.slice().buffer;
    self.postMessage({ id, buffer: outputBuffer }, [outputBuffer]);
  } catch (err) {
    self.postMessage({
      id,
      error: err instanceof Error ? err.message : String(err || 'AVIF encoding failed.'),
    });
  }
});
