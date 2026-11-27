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
import {
  beginMapOpenTrace,
  finishMapOpenTrace,
  getLastMapOpenTiming,
  markMapOpenMetadataReady,
  markMapOpenRouteCommitted,
  subscribeMapOpenTiming,
} from '../../../src/utils/mapOpenTiming';

describe('mapOpenTiming', () => {
  beforeEach(() => {
    window.__WM_PERF__?.clear();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records route, metadata, and render phases and exposes window.__WM_PERF__', () => {
    const listener = jest.fn();
    const unsub = subscribeMapOpenTiming(listener);

    beginMapOpenTrace('/Work/Plan/edit', 'Plan', 'list-click');
    markMapOpenRouteCommitted('/Work/Plan/edit');
    markMapOpenMetadataReady('/Work/Plan/edit', true);
    const record = finishMapOpenTrace('/Work/Plan/edit', 'Plan', 42);

    unsub();

    expect(record).toMatchObject({
      targetPath: '/Work/Plan/edit',
      title: 'Plan',
      source: 'list-click',
      cacheHit: true,
      topicCount: 42,
    });
    expect(record!.totalMs).toBeGreaterThanOrEqual(0);
    expect(record!.renderMs).toBeGreaterThanOrEqual(0);
    expect(getLastMapOpenTiming()).toEqual(record);
    expect(window.__WM_PERF__?.getLastOpen()).toEqual(record);
    expect(window.__WM_PERF__?.getOpenHistory()).toHaveLength(1);
    expect(listener).toHaveBeenCalledWith(record);
  });

  it('falls back to direct-url when route commits without a list click', () => {
    markMapOpenRouteCommitted('/Direct%20Map/edit');
    markMapOpenMetadataReady('/Direct Map/edit', false);
    const record = finishMapOpenTrace('/Direct%20Map/edit', 'Direct Map', 10);

    expect(record?.source).toBe('direct-url');
    expect(record?.cacheHit).toBe(false);
    expect(record?.topicCount).toBe(10);
  });
});
