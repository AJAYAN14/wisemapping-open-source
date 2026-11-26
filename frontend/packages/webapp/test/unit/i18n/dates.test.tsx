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

import { renderHook } from '@testing-library/react';
import dayjs from 'dayjs';
import { useDate } from '../../../src/classes/app-i18n/dates';
import { loadMessages } from '../../../src/classes/app-i18n/messages';
import type { LocaleCode } from '../../../src/classes/app-i18n';
// Jest maps react-intl to this mock (see jest.config.js): its locale is the one useIntl returns.
import { intl } from '../mocks/react-intl';

const dateIn = (locale: LocaleCode) => {
  intl.locale = locale;
  return renderHook(() => useDate()).result.current;
};

afterEach(() => {
  intl.locale = 'zh';
});

describe('useDate', () => {
  test('formats zh and zh-CN in Simplified Chinese', async () => {
    await loadMessages('zh');
    expect(dateIn('zh')('2020-01-15T10:00:00').format('LL')).toBe('2020年1月15日');
    expect(dateIn('zh-CN')(dayjs().subtract(2, 'day')).fromNow()).toBe('2 天前');
  });

  test('leaves the global dayjs locale alone', async () => {
    await loadMessages('zh-CN');
    dateIn('zh-CN')('2020-01-15T10:00:00');
    expect(dayjs.locale()).toBe('en');
  });
});
