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
import { buildMediumMap, useTextSizedBoxes } from './medium-map';
import SVGExporter from '../../../src/components/export/SVGExporter';

jest.mock('../../../src/components/export/PDFExporter', () => ({
  __esModule: true,
  default: class MockPDFExporter {},
}));

describe('Designer viewport culling', () => {
  beforeEach(() => {
    useTextSizedBoxes();
  });

  it('culls offscreen topics (>120 topics), updates on pan, and strips attribute on SVG export', async () => {
    const { designer } = await buildDesigner(buildMediumMap({ topics: 500 }));
    try {
      const topics = designer.getModel().getTopics();
      const culledTopics = topics.filter(
        (t) => t.get2DElement().getNode().getAttribute('data-viewport-culled') === 'true',
      );
      const visibleTopics = topics.filter(
        (t) => t.get2DElement().getNode().getAttribute('data-viewport-culled') === null,
      );
      expect(culledTopics.length).toBeGreaterThan(0);
      expect(visibleTopics.length).toBeGreaterThan(0);

      // Panning directly to a culled topic's position un-culls it.
      const targetTopic = culledTopics[0]!;
      designer.getWorkSpace().centerOnPosition(targetTopic.getPosition());
      expect(targetTopic.get2DElement().getNode().getAttribute('data-viewport-culled')).toBeNull();

      // SVGExporter strips data-viewport-culled from exported SVG markup.
      const exporter = new SVGExporter(designer.getWorkSpace().getSVGElement(), false, 'white');
      const exported = await exporter.export();
      expect(exported).not.toContain('data-viewport-culled');
    } finally {
      designer.dispose();
    }
  });
});
