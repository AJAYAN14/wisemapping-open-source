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

import Designer, { type ContextMenuEvent } from '../../../src/components/Designer';
import XMLSerializerFactory from '../../../src/components/persistence/XMLSerializerFactory';
import {
  buildDesigner,
  SAMPLE_MAP,
  StubWidgetManager,
  type Harness,
} from '../commands/designer-harness';

jest.mock('../../../src/components/export/PDFExporter', () => ({
  __esModule: true,
  default: class MockPDFExporter {},
}));

const cleanups: Array<() => void> = [];

const openEditable = async (): Promise<Harness> => {
  const container = document.body.appendChild(document.createElement('div'));
  const harness = await buildDesigner(SAMPLE_MAP, container);
  cleanups.push(() => {
    harness.designer.dispose();
    container.remove();
  });
  harness.designer.deselectAll();
  return harness;
};

const openReadOnly = async (): Promise<Designer> => {
  const container = document.body.appendChild(document.createElement('div'));
  const designer = new Designer({
    zoom: 1,
    mode: 'viewonly-public',
    divContainer: container,
    widgetManager: new StubWidgetManager(),
  });
  const doc = new DOMParser().parseFromString(SAMPLE_MAP, 'text/xml');
  const serializer = XMLSerializerFactory.createFromDocument(doc);
  const mindmap = serializer.loadFromDom(doc, 'sample');
  await designer.loadMap(mindmap);
  cleanups.push(() => {
    designer.dispose();
    container.remove();
  });
  return designer;
};

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()!();
  }
});

describe('Designer custom contextMenu support', () => {
  it('fires contextMenu for a topic, selects it if unfocused, and keeps multi-selection intact', async () => {
    const harness = await openEditable();
    const { designer } = harness;
    const topic1 = harness.topic(1);
    const topic3 = harness.topic(3);
    topic1.getModel().setImageUrl('https://cdn.example.com/a.avif');
    topic1.getModel().setImageSize(120, 80);

    const events: ContextMenuEvent[] = [];
    designer.addEvent('contextMenu', (payload) => {
      if (payload) {
        events.push(payload);
      }
    });

    // Right-clicking an unselected topic focuses it before emitting contextMenu.
    designer.openTopicContextMenu(topic1, 140, 220);
    expect(topic1.isOnFocus()).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      target: 'topic',
      clientX: 140,
      clientY: 220,
      topicId: 1,
      text: 'A',
      isCentral: false,
      hasImage: true,
      imageUrl: 'https://cdn.example.com/a.avif',
      imageWidth: 120,
      imageHeight: 80,
      hasChildren: true,
      readOnly: false,
      selectedCount: 1,
    });

    // Multi-selection is preserved when opening context menu on an already-selected topic.
    topic3.setOnFocus(true);
    expect(designer.getModel().countSelectedTopics()).toBe(2);
    designer.openTopicContextMenu(topic1, 180, 240);
    expect(designer.getModel().countSelectedTopics()).toBe(2);
    expect(events[1]).toMatchObject({
      target: 'topic',
      selectedCount: 2,
    });
  });

  it('prevents native browser contextmenu on canvas container and emits canvas contextMenu event', async () => {
    const harness = await openEditable();
    const { designer } = harness;
    const events: ContextMenuEvent[] = [];
    designer.addEvent('contextMenu', (payload) => {
      if (payload) {
        events.push(payload);
      }
    });

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 300,
      clientY: 400,
    });
    const notCanceled = designer.getContainer().dispatchEvent(event);
    expect(notCanceled).toBe(false);
    expect(events).toEqual([
      {
        target: 'canvas',
        clientX: 300,
        clientY: 400,
        readOnly: false,
      },
    ]);
  });

  it('allows native contextmenu inside textarea during inline text editing', async () => {
    const harness = await openEditable();
    const { designer } = harness;
    const events: ContextMenuEvent[] = [];
    designer.addEvent('contextMenu', (payload) => {
      if (payload) {
        events.push(payload);
      }
    });

    const textarea = document.createElement('textarea');
    designer.getContainer().appendChild(textarea);

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 50,
      clientY: 60,
    });
    const notCanceled = textarea.dispatchEvent(event);
    expect(notCanceled).toBe(true);
    expect(events).toHaveLength(0);
    textarea.remove();
  });

  it('opens inline text editor for editTopicById only when editable', async () => {
    const editable = await openEditable();
    const topic = editable.topic(1);
    expect(editable.designer.editTopicById(1)).toBe(true);
    expect(topic.isOnFocus()).toBe(true);

    const readonly = await openReadOnly();
    expect(readonly.editTopicById(1)).toBe(false);
  });
});
