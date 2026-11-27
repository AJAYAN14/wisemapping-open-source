/*
 *    Copyright [2007-2025] [wisemapping]
 *
 *   Licensed under WiseMapping Public License, Version 1.0 (the "License").
 *   It is basically the Apache License, Version 2.0 (the "License") plus the
 *   "powered by wisemapping" text requirement on every single page;
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the license at
 *
 *       https://github.com/wisemapping/wisemapping-open-source/blob/main/LICENSE.md
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */
import type PositionType from '../../PositionType';
import ElementPeer from './ElementPeer';

const MAX_PREDECODED_IMAGES = 160;
const predecodedCache = new Map<string, HTMLImageElement>();
const predecodeQueue: string[] = [];
const queuedUrls = new Set<string>();
let predecodeScheduled = false;
let predecodeInFlight = false;
let predecodePaused = false;

export const setImagePredecodePaused = (paused: boolean): void => {
  predecodePaused = paused;
  if (!paused && predecodeQueue.length > 0 && !predecodeInFlight) {
    schedulePredecodeFlush();
  }
};

const flushPredecodeQueue = (): void => {
  predecodeScheduled = false;
  if (predecodePaused || predecodeInFlight) {
    return;
  }
  if (typeof window === 'undefined' || typeof window.Image !== 'function') {
    predecodeQueue.length = 0;
    queuedUrls.clear();
    return;
  }

  let nextUrl: string | undefined;
  while (predecodeQueue.length > 0) {
    const candidate = predecodeQueue.shift()!;
    queuedUrls.delete(candidate);
    if (!predecodedCache.has(candidate)) {
      nextUrl = candidate;
      break;
    }
  }
  if (!nextUrl) {
    return;
  }

  predecodeInFlight = true;
  const img = new window.Image();
  img.decoding = 'async';
  img.src = nextUrl;
  if (predecodedCache.size >= MAX_PREDECODED_IMAGES) {
    const oldestKey = predecodedCache.keys().next().value;
    if (oldestKey !== undefined) {
      predecodedCache.delete(oldestKey);
    }
  }
  predecodedCache.set(nextUrl, img);

  const finish = () => {
    predecodeInFlight = false;
    if (predecodeQueue.length > 0 && !predecodePaused) {
      schedulePredecodeFlush();
    }
  };
  if (typeof img.decode === 'function') {
    img.decode().catch(() => undefined).finally(finish);
  } else {
    finish();
  }
};

const schedulePredecodeFlush = (): void => {
  if (predecodeScheduled || predecodePaused || predecodeInFlight || typeof window === 'undefined') {
    return;
  }
  predecodeScheduled = true;
  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof win.requestIdleCallback === 'function') {
    win.requestIdleCallback(flushPredecodeQueue, { timeout: 2000 });
  } else {
    window.setTimeout(flushPredecodeQueue, 32);
  }
};

const enqueueImagePredecode = (url: string): void => {
  if (!url || typeof window === 'undefined' || typeof window.Image !== 'function') {
    return;
  }
  if (predecodedCache.has(url)) {
    // Refresh LRU position so active map assets stay warm across long sessions.
    const existing = predecodedCache.get(url)!;
    predecodedCache.delete(url);
    predecodedCache.set(url, existing);
    return;
  }
  if (queuedUrls.has(url)) {
    return;
  }
  queuedUrls.add(url);
  predecodeQueue.push(url);
  schedulePredecodeFlush();
};

class ImagePeer extends ElementPeer<SVGImageElement> {
  private _position: PositionType;

  private _href: string;

  constructor() {
    super(ElementPeer.createNode('image'));
    this._position = { x: 0, y: 0 };
    this._href = '';
    this.attr('preserveAspectRatio', 'xMidYMid meet');
    this.attr('rx', '6');
    this.attr('ry', '6');
    this.attr('style', 'border-radius: 6px; overflow: hidden;');
  }

  protected override hasSizeAttributes(): boolean {
    return true;
  }

  setPosition(x: number, y: number): void {
    this._position = { x, y };
    this.attr('y', String(y));
    this.attr('x', String(x));
  }

  getPosition(): PositionType {
    return { x: this._position.x, y: this._position.y };
  }

  setHref(url: string): void {
    this._native.setAttributeNS(ElementPeer.linkNamespace, 'href', url);
    this._href = url;
    enqueueImagePredecode(url);
  }

  getHref(): string {
    return this._href;
  }
}

export default ImagePeer;
