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
import ColorUtil from '../../../src/components/theme/ColorUtil';
import PrismTheme from '../../../src/components/theme/PrismTheme';
import type { ThemeVariant } from '../../../src/components/theme/Theme';
import type Topic from '../../../src/components/Topic';
import type { FakeModelProps } from './FakeTopic';
import fakeTopic from './FakeTopic';

const WHITE = '#FFFFFF';

const central = fakeTopic({}, undefined, { central: true });
const main = (props: FakeModelProps = {}, order = 0): Topic => fakeTopic(props, central, { order });
const sub = (props: FakeModelProps = {}): Topic => fakeTopic(props, main());

const prism = (variant: ThemeVariant) => new PrismTheme(variant);

describe('ColorUtil contrast', () => {
  it('computes the WCAG contrast ratio', () => {
    expect(ColorUtil.contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(ColorUtil.contrastRatio('#fff', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(ColorUtil.contrastRatio('#FFFFFF', '#EAB308')).toBeCloseTo(1.92, 2);
    expect(ColorUtil.contrastRatio('#FFFFFF', '#696969')).toBeCloseTo(5.49, 2);
  });

  it('cannot compare a colour it does not parse', () => {
    expect(ColorUtil.contrastRatio('red', '#ffffff')).toBeUndefined();
    expect(ColorUtil.parse('red')).toBeUndefined();
    expect(ColorUtil.parse('rgb(1,2)')).toBeUndefined();
  });

  // The colour picker saves rgb(...) colours, so they must be compared too.
  it('parses rgb() and rgba() colours', () => {
    expect(ColorUtil.parse('rgb(224,229,239)')).toEqual({ r: 224, g: 229, b: 239, a: 1 });
    expect(ColorUtil.parse('rgba(0, 0, 0, 0.5)')).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
    expect(ColorUtil.parse('rgb(10 20 30 / 50%)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(ColorUtil.contrastRatio('rgb(0,0,0)', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('paints a see-through colour over its backdrop', () => {
    expect(ColorUtil.over('#123456', '#ffffff')).toBe('#123456');
    expect(ColorUtil.over('transparent', '#f2f2f2')).toBe('#f2f2f2');
    expect(ColorUtil.over('#00000080', '#ffffff')).toBe('#7f7f7f');
    expect(ColorUtil.over('rgba(0,0,0,0.5)', '#ffffff')).toBe('#808080');
    expect(ColorUtil.over('red', '#ffffff')).toBeUndefined();
  });
});

// Theme text must stay readable on what is actually behind it: the fill, or the canvas when the
// shape draws no fill (line, none) or the fill is transparent.
describe('theme text colour contrast', () => {
  describe('prism', () => {
    it('keeps high-contrast text on all main topic fills (dark slate in light, crisp white in dark)', () => {
      for (let order = 0; order <= 9; order++) {
        expect(prism('light').getFontColor(main({}, order))).toBe('#0F172A');
        expect(prism('dark').getFontColor(main({}, order))).toBe('#F5F5F7');
      }
    });

    it('draws a line or unfilled main topic in dark slate on the light canvas', () => {
      expect(prism('light').getFontColor(main({ shapeType: 'line' }))).toBe('#0F172A');
      expect(prism('light').getFontColor(main({ shapeType: 'none' }))).toBe('#0F172A');
      expect(prism('light').getFontColor(main({ backgroundColor: 'transparent' }))).toBe('#0F172A');
    });

    it('keeps crisp #F5F5F7 text on the pure black #000000 dark canvas', () => {
      expect(prism('dark').getFontColor(main({ shapeType: 'line' }))).toBe('#F5F5F7');
      expect(prism('dark').getFontColor(main({ shapeType: 'none' }))).toBe('#F5F5F7');
    });

    // welcome-prism: "5 min tutorial video ?" has a light fill picked by the user, saved as rgb().
    it('keeps dark text on a light rgb() fill the user picked', () => {
      expect(prism('light').getFontColor(main({ backgroundColor: 'rgb(224,229,239)' }))).toBe(
        '#0F172A',
      );
    });

    it('measures against the canvas colour the map sets', () => {
      const onDarkCanvas = main({ shapeType: 'line', canvasColor: '#1a1a1a' });
      expect(prism('light').getFontColor(onDarkCanvas)).toBe(WHITE);
    });

    it('keeps high-contrast text on central and sub topics in both light and dark modes', () => {
      expect(prism('light').getFontColor(central)).toBe(WHITE);
      expect(prism('dark').getFontColor(central)).toBe(WHITE);
      expect(prism('light').getFontColor(sub())).toBe('#1D1D1F');
      expect(prism('dark').getFontColor(sub())).toBe('#F5F5F7');
    });

    it('propagates branch connection colour and derives harmonized borders for sub topics', () => {
      const branchMain = main({}, 0);
      const branchSub = fakeTopic({}, branchMain);
      expect(prism('light').getConnectionColor(branchSub)).toBe(
        prism('light').getConnectionColor(branchMain),
      );
      expect(prism('dark').getConnectionColor(branchSub)).toBe(
        prism('dark').getConnectionColor(branchMain),
      );
      expect(prism('light').getBorderColor(branchSub)).not.toBe('#C6C6C8');
      expect(prism('dark').getBorderColor(branchSub)).not.toBe('#38383A');
    });
  });

  it('never changes a colour picked by the user, on the topic or an ancestor', () => {
    expect(prism('light').getFontColor(main({ shapeType: 'line', fontColor: '#FFFFFF' }))).toBe(
      '#FFFFFF',
    );
    const parent = main({ fontColor: '#fefefe' });
    const child = fakeTopic({ shapeType: 'line' }, parent);
    expect(prism('light').getFontColor(child)).toBe('#fefefe');
  });
});
