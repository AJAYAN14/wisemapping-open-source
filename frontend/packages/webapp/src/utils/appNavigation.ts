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

export type RouterNavigateFn = (to: string) => void | Promise<void>;

let registeredNavigate: RouterNavigateFn | undefined;

/**
 * Registers the active React Router navigate callback so map links and dialogs
 * can transition between `/` and the editor without a full document reload.
 */
export const registerRouterNavigate = (fn: RouterNavigateFn | undefined): void => {
  registeredNavigate = fn;
};

/** Returns true when an in-app SPA router navigator is mounted. */
export const hasRouterNavigate = (): boolean => Boolean(registeredNavigate);

/** Navigates via SPA router when mounted, falling back to full document navigation. */
export const navigateTo = (to: string): void => {
  if (registeredNavigate) {
    void registeredNavigate(to);
    return;
  }
  window.location.href = to;
};

/**
 * Intercepts primary-button clicks on `<a href>` links to run SPA navigation while
 * preserving modifier-key / middle-click / context-menu new-tab behavior.
 */
export const handleSpaLinkClick = (
  event: React.MouseEvent<HTMLElement>,
  to: string,
  stopPropagation = true,
): void => {
  if (stopPropagation) {
    event.stopPropagation();
  }
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
    return;
  }
  if (registeredNavigate) {
    event.preventDefault();
    void registeredNavigate(to);
  }
};
