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
import Text from '../../src/components/Text';
import { wrapTextLines } from '../../src/components/peer/svg/wrapTextLines';

describe('wrapTextLines and Text.setMaxWidth', () => {
  const fixedWidthMeasure = (line: string) =>
    Array.from(line).reduce((sum, ch) => sum + (/[\u4e00-\u9fff，。]/.test(ch) ? 14 : 8), 0);

  it('wraps long Chinese sentences while keeping trailing punctuation off line start', () => {
    const input = '垂直度，即通常所说的两要素之间保持正交的程度，表示零件上被测要素相对于基准要素。';
    const lines = wrapTextLines(input, 120, fixedWidthMeasure);

    expect(lines.length).toBeGreaterThan(2);
    expect(lines.join('')).toBe(input);
    lines.forEach((line) => {
      expect(/^[，。、；：！？]/.test(line)).toBe(false);
    });
  });

  it('keeps English words intact and breaks ultra-long tokens at char boundary', () => {
    const words = wrapTextLines('tolerance specification overview', 120, fixedWidthMeasure);
    expect(words).toEqual(['tolerance', 'specification', 'overview']);

    const url = 'abcdefghijklmnopqrstuvwxyz';
    const broken = wrapTextLines(url, 80, fixedWidthMeasure);
    expect(broken.length).toBeGreaterThan(2);
    expect(broken.join('')).toBe(url);
  });

  it('preserves original getText() while updating TextPeer tspans and line count', () => {
    const text = new Text();
    text.setFont('Arial', 10, 'normal', 'normal');
    const longText = '垂直度公差是被测要素的实际方向对于基准相垂直的理想方向之间所允许的最大变动量';
    text.setText(longText);
    expect(text.getLineCount()).toBe(1);

    text.setMaxWidth(160);
    expect(text.getText()).toBe(longText);
    expect(text.getLineCount()).toBeGreaterThan(1);
    expect(text.peer._native.querySelectorAll('tspan').length).toBe(text.getLineCount());
  });
});
