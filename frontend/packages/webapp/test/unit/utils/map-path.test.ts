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
  buildMapEditPath,
  buildMapHistoryViewPath,
  normalizeFolderPath,
  parseMapRouteSplat,
  validateMapTitleInput,
} from '../../../src/utils/mapPath';

describe('mapPath utilities', () => {
  test('normalizes folder paths to canonical trailing-slash format', () => {
    expect(normalizeFolderPath('')).toBe('');
    expect(normalizeFolderPath(null)).toBe('');
    expect(normalizeFolderPath('/工作/项目A/')).toBe('工作/项目A/');
    expect(normalizeFolderPath(' 工作 / 项目A ')).toBe('工作/项目A/');
  });

  test('builds encoded edit and history view paths for root and nested folders', () => {
    expect(buildMapEditPath('', '项目计划')).toBe('/c/maps/%E9%A1%B9%E7%9B%AE%E8%AE%A1%E5%88%92/edit');
    expect(buildMapEditPath('工作/2026/', 'Q4 总结')).toBe(
      '/c/maps/%E5%B7%A5%E4%BD%9C/2026/Q4%20%E6%80%BB%E7%BB%93/edit',
    );
    expect(buildMapHistoryViewPath('工作/', 'Q4 总结', 42)).toBe(
      '/c/maps/%E5%B7%A5%E4%BD%9C/Q4%20%E6%80%BB%E7%BB%93/history/42/view',
    );
  });

  test('parses valid edit and history view splats', () => {
    expect(parseMapRouteSplat(`${encodeURIComponent('项目计划')}/edit`)).toEqual({
      pageMode: 'edit',
      folderPath: '',
      title: '项目计划',
    });

    expect(
      parseMapRouteSplat(`${encodeURIComponent('工作')}/2026/${encodeURIComponent('Q4 总结')}/edit`),
    ).toEqual({
      pageMode: 'edit',
      folderPath: '工作/2026/',
      title: 'Q4 总结',
    });

    expect(
      parseMapRouteSplat(`${encodeURIComponent('工作')}/${encodeURIComponent('Q4 总结')}/history/9/view`),
    ).toEqual({
      pageMode: 'view-private',
      folderPath: '工作/',
      title: 'Q4 总结',
      hid: 9,
    });
  });

  test.each([
    undefined,
    '',
    '/',
    '183',
    'edit',
    'history/5/view',
    'a//b/edit',
    '%E0%A4%A/edit',
    'a%2Fb/edit',
    'a%5Cb/edit',
    'map/history/0/view',
    'map/history/abc/view',
    'map/unknown',
  ])('rejects malformed or unmatched splat %s', (splat) => {
    expect(parseMapRouteSplat(splat)).toBeNull();
  });

  test('validates map title input against blank strings and slashes', () => {
    expect(validateMapTitleInput('   ')).toBe('blank');
    expect(validateMapTitleInput('2026/Q4')).toBe('slash');
    expect(validateMapTitleInput('2026\\Q4')).toBe('slash');
    expect(validateMapTitleInput(' 2026 Q4 ')).toBeNull();
  });
});
