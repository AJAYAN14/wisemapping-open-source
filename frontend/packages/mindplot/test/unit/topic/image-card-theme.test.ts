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
import { buildDesigner } from '../commands/designer-harness';
import ColorUtil from '../../../src/components/theme/ColorUtil';
import { stubTextMeasurement } from './RenderFixture';

jest.mock('../../../src/components/export/PDFExporter', () => ({
  __esModule: true,
  default: class MockPDFExporter {},
}));

beforeAll(() => {
  stubTextMeasurement();
});

const buildImageCardMap = () => `
<map name="image-card-theme" version="tango" theme="prism">
  <topic central="true" text="Root" id="0">
    <topic position="200,0" order="0" text="Material" id="1">
      <topic position="400,0" order="0" text="Silicone Roller" id="2" image="130,90:https://example.com/roller.avif"/>
    </topic>
    <topic position="200,120" order="1" text="Plain Sub" id="3">
      <topic position="400,120" order="0" text="Sibling" id="4"/>
    </topic>
  </topic>
</map>`;

describe('image content card theme rendering', () => {
  it('uses theme dark card fill, branch border, and readable text contrast in dark mode', async () => {
    const harness = await buildDesigner(buildImageCardMap());
    harness.designer.initializeThemeVariant('dark');
    const imageTopic = harness.topic(2);
    const parentTopic = harness.topic(1);

    const innerNode = imageTopic.getInnerShape().getNativeNode?.() as SVGRectElement;
    const textFill = imageTopic.getOrBuildTextShape().getColor();
    const cardFill = innerNode.getAttribute('fill');
    const cardStroke = innerNode.getAttribute('stroke');

    expect(cardFill).toBe(imageTopic.getBackgroundColor('dark'));
    expect(cardFill).not.toBe('#FFFFFF');
    expect(cardStroke).toBe(imageTopic.getBorderColor('dark'));
    expect(cardStroke).toBe(parentTopic.getConnectionColor('dark'));
    expect(textFill).toBe('#F5F5F7');
    expect(ColorUtil.contrastRatio(textFill!, cardFill!)).toBeGreaterThanOrEqual(3);
  });

  it('updates image card fill, border, and text contrast cleanly when toggling light and dark modes', async () => {
    const harness = await buildDesigner(buildImageCardMap());
    const imageTopic = harness.topic(2);
    const innerNode = imageTopic.getInnerShape().getNativeNode?.() as SVGRectElement;

    const lightFill = innerNode.getAttribute('fill')!;
    const lightStroke = innerNode.getAttribute('stroke')!;
    const lightText = imageTopic.getOrBuildTextShape().getColor()!;
    expect(lightFill).toBe(imageTopic.getBackgroundColor('light'));
    expect(lightStroke).toBe(imageTopic.getBorderColor('light'));
    expect(ColorUtil.contrastRatio(lightText, lightFill)).toBeGreaterThanOrEqual(3);

    harness.designer.setThemeVariant('dark');
    const darkFill = innerNode.getAttribute('fill')!;
    const darkStroke = innerNode.getAttribute('stroke')!;
    const darkText = imageTopic.getOrBuildTextShape().getColor()!;
    expect(darkFill).toBe(imageTopic.getBackgroundColor('dark'));
    expect(darkStroke).toBe(imageTopic.getBorderColor('dark'));
    expect(darkFill).not.toBe(lightFill);
    expect(ColorUtil.contrastRatio(darkText, darkFill)).toBeGreaterThanOrEqual(3);
  });
});
