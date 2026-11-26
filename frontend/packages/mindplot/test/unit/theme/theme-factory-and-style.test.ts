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
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { LineType } from '../../../src/components/BaseConnectionLine';
import ColorUtil from '../../../src/components/theme/ColorUtil';
import DefaultTheme from '../../../src/components/theme/DefaultTheme';
import PrismTheme from '../../../src/components/theme/PrismTheme';
import ThemeFactory from '../../../src/components/theme/ThemeFactory';
import { ThemeStyle } from '../../../src/components/theme/ThemeStyle';
import type { TopicType, ThemeVariant } from '../../../src/components/theme/Theme';
import NodeModel from '../../../src/components/model/NodeModel';
import Mindmap from '../../../src/components/model/Mindmap';
import type ThemeType from '../../../src/components/model/ThemeType';
import { THEME_TYPES } from '../../../src/components/model/ThemeType';
import prismDefault from '../../../src/components/theme/styles/prism-default.json';
import prismDark from '../../../src/components/theme/styles/prism-dark.json';
import fakeTopic from './FakeTopic';

const variants: ThemeVariant[] = ['light', 'dark'];

describe('ThemeFactory', () => {
  afterEach(() => {
    ThemeFactory.clearCache();
  });

  it('creates the prism theme', () => {
    variants.forEach((variant) => {
      expect(ThemeFactory.createById('prism', variant)).toBeInstanceOf(PrismTheme);
    });
  });

  it('caches one instance per theme and variant', () => {
    ThemeFactory.clearCache();
    const light = ThemeFactory.createById('prism', 'light');
    expect(ThemeFactory.createById('prism', 'light')).toBe(light);
    const dark = ThemeFactory.createById('prism', 'dark');
    expect(dark).not.toBe(light);
    expect(ThemeFactory.getCacheSize()).toBe(2);

    ThemeFactory.clearCache();
    expect(ThemeFactory.getCacheSize()).toBe(0);
    expect(ThemeFactory.createById('prism', 'light')).not.toBe(light);
  });

  it.each(['dark-prism', 'classic', 'robot', 'sunrise', 'ocean', 'aurora', 'retro'])(
    'maps legacy or removed theme id %s to prism',
    (legacyId) => {
      expect(ThemeFactory.createById(legacyId, 'light')).toBe(
        ThemeFactory.createById('prism', 'light'),
      );
      expect(ThemeFactory.createById(legacyId, 'dark')).toBe(
        ThemeFactory.createById('prism', 'dark'),
      );
    },
  );

  it('creates the theme of the mindmap a node belongs to', () => {
    const mindmap = new Mindmap('test');
    mindmap.setTheme('prism');
    const model = new NodeModel('MainTopic', mindmap);
    expect(ThemeFactory.create(model, 'dark')).toBe(ThemeFactory.createById('prism', 'dark'));
  });
});

describe('ThemeStyle', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const topicTypes: TopicType[] = ['CentralTopic', 'MainTopic', 'SubTopic', 'IsolatedTopic'];

  describe.each(THEME_TYPES as unknown as ThemeType[])('%s', (id) => {
    it.each(variants)('has a complete style for every topic type in the %s variant', (variant) => {
      const style = new ThemeStyle(id, variant);
      topicTypes.forEach((type) => {
        const topicStyle = style.getStyles(type);
        expect(topicStyle.fontFamily).toEqual(expect.any(String));
        expect(topicStyle.fontSize).toEqual(expect.any(Number));
        expect(topicStyle.shapeType).toEqual(expect.any(String));
        expect(topicStyle.connectionStyle).toEqual(expect.any(Number));
        expect(topicStyle.msgKey).toEqual(expect.any(String));
      });

      const canvas = style.getCanvasStyle();
      expect(ColorUtil.parse(canvas.backgroundColor)).toBeDefined();
      expect(canvas.opacity).toBeGreaterThan(0);
    });
  });

  it('applies the variant over the light style, and the light style over the default', () => {
    const light = new ThemeStyle('prism', 'light');
    const dark = new ThemeStyle('prism', 'dark');
    // prism-light.json has no canvas: the default one applies.
    expect(light.getCanvasStyle()).toEqual({
      backgroundColor: prismDefault.Canvas.backgroundColor,
      opacity: 1,
    });
    // prism-dark.json overrides the colour, and keeps the rest.
    expect(dark.getCanvasStyle()).toEqual({
      backgroundColor: prismDark.Canvas.backgroundColor,
      opacity: 1,
    });
    // Keys the dark file does not set come from the light and default files.
    expect(dark.getStyles('MainTopic').fontFamily).toBe(light.getStyles('MainTopic').fontFamily);
  });

  it('fails on an unknown theme, after warning about its missing files', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => new ThemeStyle('no-such-theme', 'light')).toThrow(
      'Default styles not found for topic type: CentralTopic',
    );
    expect(String(warn.mock.calls[0]![0])).toContain('no-such-theme-default.json');
  });

  it('reads every connection style a theme can name', () => {
    const style = new ThemeStyle('prism', 'light') as unknown as {
      convertStringToLineType: (name: string) => LineType;
    };
    const names = Object.keys(LineType).filter((key) => Number.isNaN(Number(key)));
    names.forEach((name) => {
      expect(style.convertStringToLineType(name)).toBe(LineType[name as keyof typeof LineType]);
    });
    expect(() => style.convertStringToLineType('ZIGZAG')).toThrow('Unknown connection style');
  });

  it('fails on an unknown topic type', () => {
    const style = new ThemeStyle('prism', 'light');
    expect(() => style.getStyles('Bogus' as TopicType)).toThrow(
      'No styles found for topic type: Bogus',
    );
  });
});

/** The base theme behaviour, which the bundled themes partly override. */
class BaseTheme extends DefaultTheme {
  constructor(variant: ThemeVariant) {
    super(new ThemeStyle('prism', variant), variant);
  }
}

describe('DefaultTheme base colours', () => {
  const theme = new BaseTheme('light');
  const prism = new ThemeStyle('prism', 'light');
  const central = fakeTopic({}, undefined, { central: true });

  it('keeps a background colour set on the topic', () => {
    const main = fakeTopic({ backgroundColor: '#123456' }, central, { order: 0 });
    expect(theme.getBackgroundColor(main)).toBe('#123456');
  });

  it('derives the background of a topic from its border colour', () => {
    const main = fakeTopic({ borderColor: '#000080' }, central, { order: 0 });
    expect(theme.getBackgroundColor(main)).toBe(ColorUtil.lightenColor('#000080', 40));
  });

  it('does not derive the central topic background from its border colour', () => {
    const bordered = fakeTopic({ borderColor: '#000080' }, undefined, { central: true });
    const expected = ([] as string[]).concat(
      prism.getStyles('CentralTopic').backgroundColor as string | string[],
    )[0];
    expect(theme.getBackgroundColor(bordered)).toBe(expected);
  });

  it('picks the theme background by topic order', () => {
    const colors = ([] as string[]).concat(
      prism.getStyles('MainTopic').backgroundColor as string | string[],
    );
    const main = fakeTopic({}, central, { order: colors.length + 1 });
    expect(theme.getBackgroundColor(main)).toBe(colors[1 % colors.length]);
  });

  it('resolves the font colour from the topic, its ancestors, then the theme', () => {
    const main = fakeTopic({ fontColor: '#aa0000' }, central, { order: 0 });
    const sub = fakeTopic({}, main, { order: 0 });
    expect(theme.getFontColor(sub)).toBe('#aa0000');
  });
});
