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
import { unzipSync } from 'fflate';
import ContentType from '../../../src/components/ContentType';
import TextExporterFactory from '../../../src/components/export/TextExporterFactory';
import type XMindExporter from '../../../src/components/export/XMindExporter';
import XMindImporter from '../../../src/components/import/XMindImporter';
import { decodeUtf8, encodeUtf8 } from '../../../src/components/import/support/Utf8Decoder';
import EmojiIconModel from '../../../src/components/model/EmojiIconModel';
import LinkModel from '../../../src/components/model/LinkModel';
import Mindmap from '../../../src/components/model/Mindmap';
import type NodeModel from '../../../src/components/model/NodeModel';
import NoteModel from '../../../src/components/model/NoteModel';
import SvgIconModel from '../../../src/components/model/SvgIconModel';
import XMLSerializerFactory from '../../../src/components/persistence/XMLSerializerFactory';

// Minimal 1x1 PNG bytes encoded as Data URL.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const TINY_PNG_DATA_URL = `data:image/png;base64,${TINY_PNG_BASE64}`;
const TINY_PNG_BYTES = Uint8Array.from(atob(TINY_PNG_BASE64), (c) => c.charCodeAt(0));

const readBlobBytes = (blob: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
    reader.readAsArrayBuffer(blob);
  });

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

const buildRichMindmap = (): Mindmap => {
  const mindmap = new Mindmap('xmind-export-test');
  const central = mindmap.createNode('CentralTopic', 0);
  central.setText('Root Project');
  central.setBackgroundColor('#0284C7');
  mindmap.addBranch(central);

  const topicA = mindmap.createNode('MainTopic', 1);
  topicA.setText('Design Spec');
  topicA.setBackgroundColor('rgb(16, 185, 129)');
  topicA.setBorderColor('#059669');
  topicA.setFontColor('#111827');
  topicA.setFontWeight('bold');
  topicA.setFontStyle('italic');
  topicA.setFontSize(10);
  topicA.setShapeType('rounded rectangle');
  topicA.setImageUrl(TINY_PNG_DATA_URL);
  topicA.setImageSize(140, 95);
  topicA.addFeature(new SvgIconModel({ id: 'task_100' }));
  topicA.addFeature(new EmojiIconModel({ id: '🔴' }));
  topicA.addFeature(new EmojiIconModel({ id: '🎉' }));
  topicA.addFeature(new LinkModel({ url: 'https://example.com/spec' }));
  const noteA = new NoteModel({ text: '<p>Important <b>design</b> note</p>' });
  noteA.setContentType(ContentType.HTML);
  topicA.addFeature(noteA);
  central.append(topicA);

  const topicB = mindmap.createNode('MainTopic', 2);
  topicB.setText('Cloud Asset');
  topicB.setImageUrl('https://cdn.example.com/assets/diagram.webp');
  topicB.setImageSize(120, 80);
  central.append(topicB);

  const floating = mindmap.createNode('MainTopic', 3);
  floating.setText('Floating Idea');
  floating.setPosition(-240, 120);
  floating.setImageUrl(TINY_PNG_DATA_URL); // Same image as topicA -> deduplicated
  mindmap.addBranch(floating);

  mindmap.addRelationship(mindmap.createRelationship(topicA.getId(), floating.getId()));
  return mindmap;
};

describe('XMindExporter', () => {
  it('throws when export() text method is called directly', () => {
    const mindmap = Mindmap.buildEmpty('empty');
    const exporter = TextExporterFactory.create('xmind', mindmap, 'Empty');
    expect(() => exporter.export()).toThrow(/binary/i);
  });

  it('creates a valid XMind Zen ZIP archive with deduplicated resources and round-trips via XMindImporter', async () => {
    const fakeWebp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/webp' }),
      arrayBuffer: async () => fakeWebp.buffer,
    })) as unknown as typeof fetch;

    const mindmap = buildRichMindmap();
    const exporter = TextExporterFactory.create('xmind', mindmap, 'Root Project') as XMindExporter;
    const result = await exporter.exportFile();

    expect(result.extension).toBe('xmind');
    expect(result.mimeType).toBe('application/vnd.xmind.workbook');

    const zipBytes = await readBlobBytes(result.blob);
    const entries = unzipSync(zipBytes);
    expect(Object.keys(entries).sort()).toEqual([
      'content.json',
      'manifest.json',
      'metadata.json',
      'resources/image-1.png',
      'resources/image-2.webp',
    ]);

    const manifest = JSON.parse(decodeUtf8(entries['manifest.json']!)) as {
      'file-entries': Record<string, unknown>;
    };
    expect(Object.keys(manifest['file-entries']).sort()).toEqual([
      'content.json',
      'metadata.json',
      'resources/image-1.png',
      'resources/image-2.webp',
    ]);

    const sheets = JSON.parse(decodeUtf8(entries['content.json']!)) as Array<{
      id: string;
      class: string;
      rootTopic: {
        title: string;
        children: {
          attached: Array<{
            title: string;
            href?: string;
            notes?: { plain?: { content?: string } };
            markers?: Array<{ markerId: string }>;
            image?: { src: string; width?: number; height?: number };
            style?: { properties?: Record<string, string> };
          }>;
          detached: Array<{
            title: string;
            position?: { x: number; y: number };
            image?: { src: string };
          }>;
        };
      };
      relationships?: Array<{ end1Id: string; end2Id: string }>;
    }>;

    expect(sheets).toHaveLength(1);
    const [sheet] = sheets;
    expect(sheet!.rootTopic.title).toBe('Root Project');
    expect(sheet!.rootTopic.children.attached).toHaveLength(2);
    expect(sheet!.rootTopic.children.detached).toHaveLength(1);
    expect(sheet!.relationships).toHaveLength(1);

    const [spec, cloud] = sheet!.rootTopic.children.attached;
    expect(spec!.title).toBe('🎉 Design Spec');
    expect(spec!.href).toBe('https://example.com/spec');
    expect(spec!.notes?.plain?.content).toBe('Important design note');
    expect(spec!.markers?.map((m) => m.markerId)).toEqual(['task-done', 'priority-1']);
    expect(spec!.image).toEqual({ src: 'xap:resources/image-1.png', width: 140, height: 95 });
    expect(spec!.style?.properties).toMatchObject({
      'svg:fill': '#10B981',
      'border-line-color': '#059669',
      'fo:color': '#111827',
      'fo:font-weight': 'bold',
      'fo:font-style': 'italic',
      'fo:font-size': '18pt',
      'shape-class': 'org.xmind.topicShape.roundedRect',
    });

    expect(cloud!.image?.src).toBe('xap:resources/image-2.webp');
    expect(sheet!.rootTopic.children.detached[0]!.image?.src).toBe('xap:resources/image-1.png');
    expect(sheet!.rootTopic.children.detached[0]!.position).toEqual({ x: -240, y: 120 });

    // Round-trip through XMindImporter
    const importedXml = await new XMindImporter(zipBytes).import('Root Project');
    const doc = new DOMParser().parseFromString(importedXml, 'text/xml');
    const importedMap = XMLSerializerFactory.createFromDocument(doc).loadFromDom(
      doc,
      'Root Project',
    );
    expect(importedMap.getBranches()).toHaveLength(2); // Central + 1 floating
    expect(importedMap.getRelationships()).toHaveLength(1);
    const importedSpec = importedMap.getCentralTopic()!.getChildren()[0] as NodeModel;
    expect(importedSpec.getImageUrl()).toMatch(/^data:image\//);
    expect(importedSpec.findFeatureByType('link')[0]?.getUrl()).toBe('https://example.com/spec');
    expect(importedSpec.findFeatureByType('note')[0]?.getText()).toBe('Important design note');
  });

  it('aborts strictly when any remote image fails to download', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      status: 404,
      headers: new Headers(),
      arrayBuffer: async () => new ArrayBuffer(0),
    })) as unknown as typeof fetch;

    const mindmap = Mindmap.buildEmpty('fail-map');
    const topic = mindmap.createNode('MainTopic', 1);
    topic.setText('Broken Image');
    topic.setImageUrl('https://cdn.example.com/missing.png');
    mindmap.getCentralTopic()!.append(topic);

    const exporter = TextExporterFactory.create('xmind', mindmap, 'fail-map');
    await expect(exporter.exportFile()).rejects.toThrow(/404|图片下载失败/);
  });

  it('aborts strictly when a remote URL returns HTML instead of an image', async () => {
    const htmlBytes = encodeUtf8('<html><body>Not Found</body></html>');
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      arrayBuffer: async () => htmlBytes.buffer,
    })) as unknown as typeof fetch;

    const mindmap = Mindmap.buildEmpty('html-map');
    const topic = mindmap.createNode('MainTopic', 1);
    topic.setText('Bad Content');
    topic.setImageUrl('https://cdn.example.com/login');
    mindmap.getCentralTopic()!.append(topic);

    const exporter = TextExporterFactory.create('xmind', mindmap, 'html-map');
    await expect(exporter.exportFile()).rejects.toThrow(/非图片内容/);
  });

  it('keeps PNG bytes intact inside resources', async () => {
    const mindmap = Mindmap.buildEmpty('png-map');
    const topic = mindmap.createNode('MainTopic', 1);
    topic.setText('PNG');
    topic.setImageUrl(TINY_PNG_DATA_URL);
    mindmap.getCentralTopic()!.append(topic);

    const result = await TextExporterFactory.create('xmind', mindmap, 'png-map').exportFile();
    const entries = unzipSync(await readBlobBytes(result.blob));
    expect(entries['resources/image-1.png']).toEqual(TINY_PNG_BYTES);
  });

  it('detects and preserves AVIF image bytes inside exported XMind resources', async () => {
    const avifBytes = new Uint8Array([
      0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66, 0x00, 0x00, 0x00,
      0x00,
    ]);
    const base64 = btoa(String.fromCharCode(...avifBytes));
    const mindmap = Mindmap.buildEmpty('avif-map');
    const topic = mindmap.createNode('MainTopic', 1);
    topic.setText('AVIF');
    topic.setImageUrl(`data:image/avif;base64,${base64}`);
    mindmap.getCentralTopic()!.append(topic);

    const result = await TextExporterFactory.create('xmind', mindmap, 'avif-map').exportFile();
    const entries = unzipSync(await readBlobBytes(result.blob));
    expect(entries['resources/image-1.avif']).toEqual(avifBytes);
  });
});
