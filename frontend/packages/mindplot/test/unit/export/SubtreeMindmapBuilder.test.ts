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
import { unzipSync } from 'fflate';
import ContentType from '../../../src/components/ContentType';
import TextExporterFactory from '../../../src/components/export/TextExporterFactory';
import { extractSubtreeMindmap } from '../../../src/components/export/support/SubtreeMindmapBuilder';
import { decodeUtf8 } from '../../../src/components/import/support/Utf8Decoder';
import EmojiIconModel from '../../../src/components/model/EmojiIconModel';
import LinkModel from '../../../src/components/model/LinkModel';
import Mindmap from '../../../src/components/model/Mindmap';
import NoteModel from '../../../src/components/model/NoteModel';
import SvgIconModel from '../../../src/components/model/SvgIconModel';

const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const readBlobBytes = (blob: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
    reader.readAsArrayBuffer(blob);
  });

const buildSampleMindmap = () => {
  const mindmap = new Mindmap('sample-map');
  mindmap.setTheme('prism');
  mindmap.setDescription('Sample description');
  mindmap.setCanvasStyle({ backgroundColor: '#f8fafc' });

  const central = mindmap.createNode('CentralTopic', 0);
  central.setText('Root Map');
  mindmap.addBranch(central);

  const branchA = mindmap.createNode('MainTopic', 10);
  branchA.setText('Architecture');
  branchA.setOrder(0);
  branchA.setPosition(180, -40);
  branchA.setChildrenShrunken(true);
  branchA.setBackgroundColor('#0284c7');
  branchA.addFeature(new SvgIconModel({ id: 'task_100' }));
  branchA.addFeature(new EmojiIconModel({ id: '🚀' }));
  branchA.addFeature(new LinkModel({ url: 'https://example.com/arch' }));
  const branchNote = new NoteModel({ text: '<p>Core architecture overview</p>' });
  branchNote.setContentType(ContentType.HTML);
  branchA.addFeature(branchNote);
  central.append(branchA);

  const childA1 = mindmap.createNode('MainTopic', 11);
  childA1.setText('Frontend');
  childA1.setOrder(0);
  childA1.setImageUrl(TINY_PNG_DATA_URL);
  childA1.setImageSize(120, 80);
  branchA.append(childA1);

  const childA2 = mindmap.createNode('MainTopic', 12);
  childA2.setText('Backend');
  childA2.setOrder(1);
  branchA.append(childA2);

  const grandChildA2 = mindmap.createNode('MainTopic', 13);
  grandChildA2.setText('Database');
  childA2.append(grandChildA2);

  const branchB = mindmap.createNode('MainTopic', 20);
  branchB.setText('Marketing');
  branchB.setOrder(1);
  central.append(branchB);

  const floating = mindmap.createNode('MainTopic', 30);
  floating.setText('Floating Note');
  floating.setPosition(-200, 140);
  mindmap.addBranch(floating);

  // Internal relationship within branchA subtree
  const internalRel = mindmap.createRelationship(childA1.getId(), grandChildA2.getId());
  internalRel.setStrokeColor('#e11d48');
  internalRel.setStartArrow(true);
  internalRel.setSrcCtrlPoint({ x: 10, y: 20 });
  mindmap.addRelationship(internalRel);

  // Cross-branch relationship pointing outside branchA
  const crossRel = mindmap.createRelationship(childA1.getId(), branchB.getId());
  mindmap.addRelationship(crossRel);

  return { mindmap, branchA, childA1, branchB };
};

describe('extractSubtreeMindmap', () => {
  it('promotes the selected topic to central topic with all descendants and excludes sibling/floating branches', () => {
    const { mindmap, branchA } = buildSampleMindmap();

    const subtree = extractSubtreeMindmap(mindmap, branchA);

    expect(subtree.getTheme()).toBe('prism');
    expect(subtree.getDescription()).toBe('Sample description');
    expect(subtree.getCanvasStyle()).toEqual({ backgroundColor: '#f8fafc' });
    expect(subtree.getBranches()).toHaveLength(1);

    const root = subtree.getCentralTopic();
    expect(root).toBeDefined();
    expect(root!.getType()).toBe('CentralTopic');
    expect(root!.getText()).toBe('Architecture');
    expect(root!.getPosition()).toEqual({ x: 0, y: 0 });
    expect(root!.getOrder()).toBeUndefined();
    expect(root!.areChildrenShrunken()).toBe(false);
    expect(root!.getBackgroundColor()).toBe('#0284c7');
    expect(root!.getFeatures().map((f) => f.getType())).toEqual(['icon', 'eicon', 'link', 'note']);

    const children = root!.getChildren();
    expect(children.map((c) => c.getText())).toEqual(['Frontend', 'Backend']);
    expect(children[0]!.getImageUrl()).toBe(TINY_PNG_DATA_URL);
    expect(children[1]!.getChildren().map((c) => c.getText())).toEqual(['Database']);

    // Source mindmap remains untouched
    expect(branchA.getType()).toBe('MainTopic');
    expect(branchA.getOrder()).toBe(0);
    expect(branchA.areChildrenShrunken()).toBe(true);
    expect(branchA.getPosition()).toEqual({ x: 180, y: -40 });
    expect(mindmap.getBranches()).toHaveLength(2);
  });

  it('keeps only relationships whose endpoints are both inside the extracted subtree', () => {
    const { mindmap, branchA } = buildSampleMindmap();

    const subtree = extractSubtreeMindmap(mindmap, branchA);
    const rels = subtree.getRelationships();

    expect(rels).toHaveLength(1);
    expect(rels[0]!.getFromNode()).toBe(11);
    expect(rels[0]!.getToNode()).toBe(13);
    expect(rels[0]!.getStrokeColor()).toBe('#e11d48');
    expect(rels[0]!.getStartArrow()).toBe(true);
    expect(rels[0]!.getSrcCtrlPoint()).toEqual({ x: 10, y: 20 });
  });

  it('exports Markdown and XMind cleanly for the extracted subtree', async () => {
    const { mindmap, branchA } = buildSampleMindmap();
    const subtree = extractSubtreeMindmap(mindmap, branchA);

    const mdExporter = TextExporterFactory.create('md', subtree, 'Architecture');
    const mdText = await mdExporter.export();
    expect(mdText).toContain('# Architecture');
    expect(mdText).toContain('- Frontend');
    expect(mdText).toContain('- Backend');
    expect(mdText).toContain('\t- Database');
    expect(mdText).not.toContain('Root Map');
    expect(mdText).not.toContain('Marketing');
    expect(mdText).not.toContain('Floating Note');

    const xmindExporter = TextExporterFactory.create('xmind', subtree, 'Architecture');
    const xmindFile = await xmindExporter.exportFile();
    const entries = unzipSync(await readBlobBytes(xmindFile.blob));
    const sheets = JSON.parse(decodeUtf8(entries['content.json']!));
    expect(sheets).toHaveLength(1);
    expect(sheets[0].rootTopic.title).toContain('Architecture');
    expect(sheets[0].rootTopic.children.attached.map((t: { title: string }) => t.title)).toEqual([
      'Frontend',
      'Backend',
    ]);
    expect(sheets[0].rootTopic.children.detached).toBeUndefined();
    expect(sheets[0].relationships).toHaveLength(1);
  });
});
