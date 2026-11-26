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
import Messages, { $msg } from '../../../src/components/Messages';
import Bundle from '../../../src/components/lang/Bundle';
import type { LocaleMessages } from '../../../src/components/lang/zh';

describe('Messages locale resolution', () => {
  afterEach(() => {
    Messages.init('zh');
  });

  it.each(['zh', 'zh-CN', 'zh_CN', 'en', 'xx', ''])('resolves %p to Simplified Chinese', (locale) => {
    Messages.init(locale);
    expect($msg('MAIN_TOPIC')).toBe(Bundle.zh.MAIN_TOPIC);
  });
});

describe('$msg fallback', () => {
  afterEach(() => {
    Messages.init('zh');
  });

  it('falls back to the Simplified Chinese bundle when the active bundle lacks the key', () => {
    Messages.__bundle = {} as LocaleMessages;
    expect($msg('MAIN_TOPIC')).toBe('重点主题');
  });

  it('returns the key only when no bundle has it', () => {
    Messages.init('zh');
    // @ts-expect-error an unknown key does not compile
    expect($msg('NO_SUCH_KEY')).toBe('NO_SUCH_KEY');
  });
});

describe('typed bundles (T4)', () => {
  it('a locale must translate every key, and only those', () => {
    const { NOTE, ...withoutNote } = Bundle.zh;
    expect(NOTE).toBe('笔记');
    // @ts-expect-error NOTE is missing
    const missing: LocaleMessages = withoutNote;
    // @ts-expect-error EXTRA is not a key
    const extra: LocaleMessages = { ...Bundle.zh, EXTRA: 'x' };
    expect([missing, extra]).toHaveLength(2);
  });
});
