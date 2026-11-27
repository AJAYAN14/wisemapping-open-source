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
import type React from 'react';
import I18nMsg from '@wisemapping/editor/classes/i18n-msg';
import type Client from '../../../src/classes/client';
import queryClient from '../../../src/queryClient';
import {
  handleSpaLinkClick,
  hasRouterNavigate,
  navigateTo,
  registerRouterNavigate,
} from '../../../src/utils/appNavigation';
import {
  cancelHoverPrefetchMapForOpen,
  loadEditorPage,
  prefetchMapForOpen,
  preloadEditorFonts,
  preloadEditorResources,
  scheduleHoverPrefetchMapForOpen,
  scheduleIdleEditorPreload,
} from '../../../src/utils/editorPreload';

jest.mock('../../../src/components/editor-page', () => ({
  __esModule: true,
  default: () => null,
}));

describe('appNavigation', () => {
  afterEach(() => {
    registerRouterNavigate(undefined);
  });

  it('uses registered SPA navigator when available and falls back otherwise', () => {
    expect(hasRouterNavigate()).toBe(false);
    // Calling navigateTo without a registered navigator runs fallback safely in jsdom.
    expect(() => navigateTo('/test/edit')).not.toThrow();

    const nav = jest.fn();
    registerRouterNavigate(nav);
    expect(hasRouterNavigate()).toBe(true);

    navigateTo('/alpha/edit');
    expect(nav).toHaveBeenCalledWith('/alpha/edit');
  });

  it('intercepts plain primary clicks and preserves modifier/middle clicks', () => {
    const nav = jest.fn();
    registerRouterNavigate(nav);

    const makeEvent = (overrides: Partial<React.MouseEvent<HTMLElement>> = {}) =>
      ({
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        ...overrides,
      }) as unknown as React.MouseEvent<HTMLElement>;

    const plain = makeEvent();
    handleSpaLinkClick(plain, '/map/edit');
    expect(plain.stopPropagation).toHaveBeenCalled();
    expect(plain.preventDefault).toHaveBeenCalled();
    expect(nav).toHaveBeenCalledWith('/map/edit');

    const ctrlClick = makeEvent({ ctrlKey: true });
    handleSpaLinkClick(ctrlClick, '/map/edit', false);
    expect(ctrlClick.stopPropagation).not.toHaveBeenCalled();
    expect(ctrlClick.preventDefault).not.toHaveBeenCalled();
    expect(nav).toHaveBeenCalledTimes(1);

    const middleClick = makeEvent({ button: 1 });
    handleSpaLinkClick(middleClick, '/map/edit');
    expect(middleClick.preventDefault).not.toHaveBeenCalled();
    expect(nav).toHaveBeenCalledTimes(1);
  });
});

describe('editorPreload', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it('preloads editor module and messages and deduplicates calls', async () => {
    const loadMsgSpy = jest.spyOn(I18nMsg, 'load').mockResolvedValue({});
    const mod1 = await loadEditorPage();
    const mod2 = await loadEditorPage();
    expect(mod1).toBe(mod2);

    await preloadEditorResources();
    expect(loadMsgSpy).toHaveBeenCalled();
  });

  it('schedules and cancels idle preload with requestIdleCallback and setTimeout fallback', () => {
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const origRic = win.requestIdleCallback;
    const origCancelRic = win.cancelIdleCallback;

    const cancelRic = jest.fn();
    win.requestIdleCallback = jest.fn((cb) => {
      cb();
      return 42;
    });
    win.cancelIdleCallback = cancelRic;

    const cleanupRic = scheduleIdleEditorPreload();
    cleanupRic();
    expect(cancelRic).toHaveBeenCalledWith(42);

    delete (win as { requestIdleCallback?: unknown }).requestIdleCallback;
    jest.useFakeTimers();
    const cleanupTimer = scheduleIdleEditorPreload();
    jest.advanceTimersByTime(450);
    cleanupTimer();
    jest.useRealTimers();

    if (origRic) {
      win.requestIdleCallback = origRic;
    } else {
      delete (win as { requestIdleCallback?: unknown }).requestIdleCallback;
    }
    if (origCancelRic) {
      win.cancelIdleCallback = origCancelRic;
    } else {
      delete (win as { cancelIdleCallback?: unknown }).cancelIdleCallback;
    }
  });

  it('prefetches map metadata with xml when client supports fetchMapMetadataByPath', async () => {
    const fetchMapMetadataByPath = jest.fn().mockResolvedValue({
      id: 9,
      title: 'Plan',
      folderPath: 'work/',
      creatorFullName: 'Ada',
      isLocked: false,
      jsonProps: '{"zoom":0.8}',
      role: 'owner',
      xml: '<map/>',
    });
    const fakeClient = { fetchMapMetadataByPath } as unknown as Client;

    prefetchMapForOpen(undefined, '', 'Plan');
    prefetchMapForOpen(fakeClient, 'work/', '');
    expect(fetchMapMetadataByPath).not.toHaveBeenCalled();

    prefetchMapForOpen(fakeClient, 'work', 'Plan');
    await Promise.resolve();
    expect(fetchMapMetadataByPath).toHaveBeenCalledWith('work/', 'Plan', true);
    expect(fetchMapMetadataByPath).toHaveBeenCalledTimes(1);
  });

  it('preloads editor font stylesheets idempotently', () => {
    document.head.querySelectorAll('link[href*="Material+Icons"], link[href*="Inter"]').forEach((n) =>
      n.remove(),
    );

    preloadEditorFonts();
    preloadEditorFonts();

    expect(document.head.querySelectorAll('link[href*="Material+Icons"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('link[href*="Inter"]')).toHaveLength(1);
  });

  it('schedules hover prefetch after intent delay and cancels on pointer leave', async () => {
    jest.useFakeTimers();
    const fetchMapMetadataByPath = jest.fn().mockResolvedValue({
      id: 10,
      title: 'HoverMap',
      folderPath: 'docs/',
      creatorFullName: 'Ada',
      isLocked: false,
      jsonProps: '{"zoom":0.8}',
      role: 'owner',
      xml: '<map/>',
    });
    const fakeClient = { fetchMapMetadataByPath } as unknown as Client;

    scheduleHoverPrefetchMapForOpen(fakeClient, 'docs/', 'HoverMap');
    cancelHoverPrefetchMapForOpen('docs/', 'HoverMap');
    jest.advanceTimersByTime(150);
    expect(fetchMapMetadataByPath).not.toHaveBeenCalled();

    scheduleHoverPrefetchMapForOpen(fakeClient, 'docs/', 'HoverMap');
    jest.advanceTimersByTime(150);
    await Promise.resolve();
    expect(fetchMapMetadataByPath).toHaveBeenCalledWith('docs/', 'HoverMap', true);
    jest.useRealTimers();
  });
});
