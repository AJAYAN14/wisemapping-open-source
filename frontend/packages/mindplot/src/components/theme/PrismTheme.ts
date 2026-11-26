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
import type Topic from '../Topic';
import DefaultTheme from './DefaultTheme';
import type { ThemeVariant } from './Theme';
import { ThemeStyle } from './ThemeStyle';
import pickByOrder from './pickByOrder';
import ColorUtil from './ColorUtil';

class PrismTheme extends DefaultTheme {
  constructor(variant: ThemeVariant) {
    const themeStyle = new ThemeStyle('prism', variant);
    super(themeStyle, variant);
  }

  override getConnectionColor(topic: Topic): string {
    // A colour picked by the user on the topic or an ancestor is used as is ...
    const picked = this.resolve('connectionColor', topic, false);
    if (picked) {
      return picked;
    }

    const parent = topic.getParent();
    // SubTopics inherit their parent branch's connection colour so branches remain scannable.
    if (parent && !parent.isCentralTopic()) {
      return this.getConnectionColor(parent);
    }

    const colors = this.getStyles(topic).connectionColor;
    let result = pickByOrder(colors, topic.getOrder());

    if (result && this._variant === 'dark' && !topic.isCentralTopic()) {
      // Lighten the theme connection colour for better visibility on pure black canvas
      result = ColorUtil.lightenColor(result, 20);
    }

    return result;
  }

  override getBorderColor(topic: Topic): string {
    // A colour picked by the user on the topic or an ancestor is used as is ...
    const picked = this.resolve('borderColor', topic, false);
    if (picked) {
      return picked;
    }

    const parent = topic.getParent();
    // SubTopics derive a subtle, branch-harmonized card border from their parent branch colour.
    if (parent && !parent.isCentralTopic()) {
      const branchColor = this.getConnectionColor(parent);
      const parsed = ColorUtil.parse(branchColor);
      if (parsed) {
        const backdrop = this._variant === 'dark' ? '#000000' : '#FFFFFF';
        const alpha = this._variant === 'dark' ? 0.45 : 0.42;
        const tinted = ColorUtil.over(`rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${alpha})`, backdrop);
        if (tinted) {
          return tinted;
        }
      }
    }

    const colors = this.getStyles(topic).borderColor;
    let result = pickByOrder(colors, topic.getOrder());

    if (result && this._variant === 'dark' && !topic.isCentralTopic()) {
      // Lighten the theme border colour for better visibility on pure black canvas
      result = ColorUtil.lightenColor(result, 15);
    }

    return result;
  }
}

export default PrismTheme;
