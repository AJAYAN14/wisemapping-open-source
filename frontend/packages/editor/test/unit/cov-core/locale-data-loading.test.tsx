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

// Its own file: a module registry where no locale but English has been loaded yet.
import { renderHook } from '@testing-library/react';
import { useLocaleData } from '../../../src/classes/i18n-msg';
import zh from '../../../src/compiled-lang/zh.json';
import zhCn from '../../../src/compiled-lang/zh-CN.json';

describe('useLocaleData Chinese-only bundles', () => {
  it('serves zh-CN synchronously and falls back to zh for unsupported locales', () => {
    const { result: zhCnResult } = renderHook(() => useLocaleData('zh-CN'));
    expect(zhCnResult.current).toEqual({ locale: 'zh-CN', messages: zhCn });

    const { result: fallbackResult } = renderHook(() => useLocaleData('ja'));
    expect(fallbackResult.current).toEqual({ locale: 'zh', messages: zh });
  });
});
