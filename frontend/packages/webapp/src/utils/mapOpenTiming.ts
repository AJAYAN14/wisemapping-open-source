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

export interface MapOpenTimingRecord {
  targetPath: string;
  title: string;
  source: 'list-click' | 'direct-url';
  startedAtMs: number;
  finishedAtMs: number;
  totalMs: number;
  routeCommitMs: number;
  metadataMs: number;
  renderMs: number;
  cacheHit: boolean;
  topicCount: number;
  apiDurationMs?: number;
  serverDbMs?: number;
  softNavFcpMs?: number;
}

interface ActiveTrace {
  targetPath: string;
  title?: string;
  source: 'list-click' | 'direct-url';
  startedAt: number;
  routeCommittedAt?: number;
  metadataReadyAt?: number;
  cacheHit?: boolean;
}

interface WmPerfApi {
  getLastOpen: () => MapOpenTimingRecord | undefined;
  getOpenHistory: () => MapOpenTimingRecord[];
  clear: () => void;
}

declare global {
  interface Window {
    __WM_PERF__?: WmPerfApi;
  }
}

const MAX_HISTORY = 20;
const MARK_START = 'wm:map-open:start';
const MARK_ROUTE = 'wm:map-open:route';
const MARK_METADATA = 'wm:map-open:metadata';
const MARK_READY = 'wm:map-open:ready';

let activeTrace: ActiveTrace | undefined;
let history: MapOpenTimingRecord[] = [];
const listeners = new Set<(record: MapOpenTimingRecord | undefined) => void>();
let softNavObserversInitialized = false;
let latestSoftNavFcpMs: number | undefined;

const normalizeTargetPath = (path: string): string => {
  try {
    return decodeURIComponent(path).replace(/\/+$/, '');
  } catch {
    return path.replace(/\/+$/, '');
  }
};

const safeMark = (name: string): void => {
  if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
    try {
      performance.mark(name);
    } catch {
      // Ignore User Timing failures in restricted runtimes.
    }
  }
};

const safeMeasure = (name: string, startMark: string, endMark: string): void => {
  if (typeof performance !== 'undefined' && typeof performance.measure === 'function') {
    try {
      performance.measure(name, startMark, endMark);
    } catch {
      // Ignore missing mark failures.
    }
  }
};

const initSoftNavigationObserver = (): void => {
  if (softNavObserversInitialized || typeof PerformanceObserver === 'undefined') {
    return;
  }
  softNavObserversInitialized = true;
  const supported = PerformanceObserver.supportedEntryTypes;
  if (!Array.isArray(supported) || !supported.includes('soft-navigation')) {
    return;
  }
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (typeof entry.duration === 'number' && Number.isFinite(entry.duration)) {
          latestSoftNavFcpMs = Math.round(entry.duration);
        }
      }
    });
    observer.observe({ type: 'soft-navigation', buffered: true });
  } catch {
    // Graceful no-op on browsers without soft-navigation observer support.
  }
};

const readLatestMetadataResourceTiming = (): {
  apiDurationMs?: number;
  serverDbMs?: number;
} => {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') {
    return {};
  }
  const resources = performance.getEntriesByType('resource') as Array<
    PerformanceResourceTiming & {
      serverTiming?: ReadonlyArray<{ name: string; duration: number }>;
    }
  >;
  for (let i = resources.length - 1; i >= 0; i -= 1) {
    const entry = resources[i];
    if (!entry?.name.includes('/api/restful/maps/by-path/metadata')) {
      continue;
    }
    const dbEntry = entry.serverTiming?.find((st) => st.name === 'db');
    return {
      ...(Number.isFinite(entry.duration) ? { apiDurationMs: Math.round(entry.duration) } : {}),
      ...(dbEntry && Number.isFinite(dbEntry.duration)
        ? { serverDbMs: Math.round(dbEntry.duration) }
        : {}),
    };
  }
  return {};
};

const ensureGlobalPerfApi = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.__WM_PERF__ = {
    getLastOpen: () => history[history.length - 1],
    getOpenHistory: () => [...history],
    clear: () => {
      history = [];
      activeTrace = undefined;
      listeners.forEach((cb) => cb(undefined));
    },
  };
};

/** Starts an end-to-end map open measurement when the user clicks a map link. */
export const beginMapOpenTrace = (
  targetPath: string,
  title?: string,
  source: 'list-click' | 'direct-url' = 'list-click',
): void => {
  if (typeof performance === 'undefined') {
    return;
  }
  initSoftNavigationObserver();
  ensureGlobalPerfApi();
  const normalized = normalizeTargetPath(targetPath);
  if (
    activeTrace &&
    activeTrace.targetPath === normalized &&
    performance.now() - activeTrace.startedAt < 10_000
  ) {
    return;
  }
  activeTrace = {
    targetPath: normalized,
    ...(title ? { title } : {}),
    source,
    startedAt: performance.now(),
  };
  latestSoftNavFcpMs = undefined;
  safeMark(MARK_START);
};

/** Marks when React Router committed the editor route transition. */
export const markMapOpenRouteCommitted = (targetPath: string): void => {
  if (typeof performance === 'undefined') {
    return;
  }
  const normalized = normalizeTargetPath(targetPath);
  if (!activeTrace || activeTrace.targetPath !== normalized) {
    beginMapOpenTrace(targetPath, undefined, 'direct-url');
  }
  if (activeTrace && activeTrace.routeCommittedAt === undefined) {
    activeTrace.routeCommittedAt = performance.now();
    safeMark(MARK_ROUTE);
  }
};

/** Marks when map metadata and XML finished loading (from prefetch cache or network). */
export const markMapOpenMetadataReady = (targetPath: string, cacheHit: boolean): void => {
  if (typeof performance === 'undefined') {
    return;
  }
  const normalized = normalizeTargetPath(targetPath);
  if (!activeTrace || activeTrace.targetPath !== normalized) {
    return;
  }
  if (activeTrace.metadataReadyAt === undefined) {
    activeTrace.metadataReadyAt = performance.now();
    activeTrace.cacheHit = cacheHit;
    safeMark(MARK_METADATA);
  }
};

/** Completes the active map-open trace once the mindplot canvas fires loadSuccess. */
export const finishMapOpenTrace = (
  targetPath: string,
  title: string,
  topicCount: number,
): MapOpenTimingRecord | undefined => {
  if (typeof performance === 'undefined') {
    return undefined;
  }
  ensureGlobalPerfApi();
  const normalized = normalizeTargetPath(targetPath);
  if (!activeTrace || activeTrace.targetPath !== normalized) {
    return undefined;
  }

  const trace = activeTrace;
  activeTrace = undefined;
  const finishedAt = performance.now();
  safeMark(MARK_READY);
  safeMeasure('wm:map-open', MARK_START, MARK_READY);

  const totalMs = Math.max(0, Math.round(finishedAt - trace.startedAt));
  const routeCommitMs = Math.max(
    0,
    Math.round((trace.routeCommittedAt ?? finishedAt) - trace.startedAt),
  );
  const metadataMs = Math.max(
    0,
    Math.round((trace.metadataReadyAt ?? finishedAt) - trace.startedAt),
  );
  const renderMs = Math.max(0, totalMs - metadataMs);
  const resourceTiming = trace.cacheHit ? {} : readLatestMetadataResourceTiming();

  const record: MapOpenTimingRecord = {
    targetPath: normalized,
    title: title || trace.title || '',
    source: trace.source,
    startedAtMs: Math.round(trace.startedAt),
    finishedAtMs: Math.round(finishedAt),
    totalMs,
    routeCommitMs,
    metadataMs,
    renderMs,
    cacheHit: Boolean(trace.cacheHit),
    topicCount,
    ...resourceTiming,
    ...(latestSoftNavFcpMs !== undefined ? { softNavFcpMs: latestSoftNavFcpMs } : {}),
  };

  history = [...history.slice(-(MAX_HISTORY - 1)), record];
  listeners.forEach((cb) => cb(record));

  const cacheLabel = record.cacheHit ? '命中预取' : '网络拉取';
  const dbText = record.serverDbMs !== undefined ? ` | DB ${record.serverDbMs}ms` : '';
  console.info(
    `[WiseMapping Perf] 打开导图《${record.title}》: 总耗时 ${record.totalMs}ms (路由响应 ${record.routeCommitMs}ms | 数据 ${record.metadataMs}ms [${cacheLabel}]${dbText} | 画布渲染 ${record.renderMs}ms | 节点 ${record.topicCount})`,
  );

  return record;
};

/** Subscribes to newly completed map-open timing records. */
export const subscribeMapOpenTiming = (
  listener: (record: MapOpenTimingRecord | undefined) => void,
): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Returns the most recent completed map-open timing record. */
export const getLastMapOpenTiming = (): MapOpenTimingRecord | undefined =>
  history[history.length - 1];
