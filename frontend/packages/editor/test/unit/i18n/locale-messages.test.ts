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

import fs from 'fs';
import path from 'path';

type Source = Record<string, { defaultMessage: string }>;
type Compiled = Record<string, unknown[]>;

const root = path.resolve(__dirname, '../../..');
const langDir = path.join(root, 'lang');
const compiledDir = path.join(root, 'src/compiled-lang');
const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;

// Common characters only Traditional Chinese uses: their Simplified forms differ.
const TRADITIONAL_ONLY =
  /[預設體開關點擊選擇編輯檔圖畫線顏網頁樣題節級層連適佈視縮鍵刪註認們為個這與對時後從進]/;

describe('editor Chinese-only locale bundles', () => {
  test('only keeps zh and zh-CN source and compiled files', () => {
    const sourceFiles = fs.readdirSync(langDir).sort();
    const compiledFiles = fs.readdirSync(compiledDir).sort();
    expect(sourceFiles).toEqual(['zh-CN.json', 'zh.json']);
    expect(compiledFiles).toEqual(['zh-CN.json', 'zh.json']);
  });

  test('zh and zh-CN have identical keys and match their compiled output', () => {
    const zh = readJson<Source>(path.join(langDir, 'zh.json'));
    const zhCn = readJson<Source>(path.join(langDir, 'zh-CN.json'));
    const compiledZh = readJson<Compiled>(path.join(compiledDir, 'zh.json'));
    const compiledZhCn = readJson<Compiled>(path.join(compiledDir, 'zh-CN.json'));

    expect(Object.keys(zhCn).sort()).toEqual(Object.keys(zh).sort());
    expect(Object.keys(compiledZh).sort()).toEqual(Object.keys(zh).sort());
    expect(Object.keys(compiledZhCn).sort()).toEqual(Object.keys(zhCn).sort());
  });

  test.each(['zh', 'zh-CN'])('%s messages are written in Simplified characters', (lang) => {
    const messages = readJson<Source>(path.join(langDir, `${lang}.json`));
    const traditional = Object.entries(messages)
      .filter(([, { defaultMessage }]) => TRADITIONAL_ONLY.test(defaultMessage))
      .map(([id, { defaultMessage }]) => `${id}: ${defaultMessage}`);
    expect(traditional).toEqual([]);
  });
});
