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
import { describe, expect, it } from '@jest/globals';
import { LineType } from '../../../src/components/ConnectionLine';
import { THEME_TYPES } from '../../../src/components/model/ThemeType';
import ThemeFactory from '../../../src/components/theme/ThemeFactory';
import type { ThemeVariant } from '../../../src/components/theme/Theme';
import { themedFakeTopic } from './FakeTopic';

describe('All themes use rounded orthogonal connections (POLYLINE_CURVED) and rounded cards', () => {
  const variants: ThemeVariant[] = ['light', 'dark'];

  it.each(THEME_TYPES.flatMap((id) => variants.map((v) => [id, v] as const)))(
    '%s (%s) resolves POLYLINE_CURVED and rounded rectangle for central, main, sub, and isolated topics',
    (themeId, variant) => {
      const theme = ThemeFactory.createById(themeId, variant);
      const central = themedFakeTopic(theme, {}, undefined, { central: true });
      const main = themedFakeTopic(theme, {}, central, { order: 0 });
      const sub = themedFakeTopic(theme, {}, main, { order: 0 });
      const isolated = themedFakeTopic(theme, {});

      expect(theme.getConnectionType(central)).toBe(LineType.POLYLINE_CURVED);
      expect(theme.getConnectionType(main)).toBe(LineType.POLYLINE_CURVED);
      expect(theme.getConnectionType(sub)).toBe(LineType.POLYLINE_CURVED);
      expect(theme.getConnectionType(isolated)).toBe(LineType.POLYLINE_CURVED);

      expect(theme.getShapeType(central)).toBe('rounded rectangle');
      expect(theme.getShapeType(main)).toBe('rounded rectangle');
      expect(theme.getShapeType(sub)).toBe('rounded rectangle');
      expect(theme.getShapeType(isolated)).toBe('rounded rectangle');
    },
  );
});
