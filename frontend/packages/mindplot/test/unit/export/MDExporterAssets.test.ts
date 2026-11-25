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
import { strFromU8, unzipSync } from 'fflate';
import TextExporterFactory from '../../../src/components/export/TextExporterFactory';
import EmojiIconModel from '../../../src/components/model/EmojiIconModel';
import Mindmap from '../../../src/components/model/Mindmap';
import NoteModel from '../../../src/components/model/NoteModel';
import SvgIconModel from '../../../src/components/model/SvgIconModel';

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

const readBlobText = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
    reader.readAsText(blob);
  });

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('MDExporter exportFile() with and without images', () => {
  it('exports a plain .md file when topics only have text, emojis, and SVG icons', async () => {
    const mindmap = new Mindmap('text-only');
    const central = mindmap.createNode('CentralTopic', 0);
    central.setText('项目大纲');
    mindmap.addBranch(central);

    const child = mindmap.createNode('MainTopic', 1);
    child.setText('里程碑');
    child.addFeature(new EmojiIconModel({ id: '💡' }));
    child.addFeature(new SvgIconModel({ id: 'flag_red' }));
    central.append(child);

    const result = await TextExporterFactory.create('md', mindmap, '项目大纲').exportFile();
    expect(result.extension).toBe('md');
    expect(result.mimeType).toBe('text/markdown');
    expect(await readBlobText(result.blob)).toBe('# 项目大纲\n\n- 💡 里程碑\n\n');
  });

  it('bundles a .zip with root .md and assets/ folder when topic images exist', async () => {
    const remoteJpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      arrayBuffer: async () => remoteJpgBytes.buffer,
    })) as unknown as typeof fetch;

    const mindmap = new Mindmap('with-images');
    const central = mindmap.createNode('CentralTopic', 0);
    central.setText('架构设计');
    central.setImageUrl(TINY_PNG_DATA_URL);
    mindmap.addBranch(central);

    const nodeA = mindmap.createNode('MainTopic', 1);
    nodeA.setText('前端模块');
    nodeA.setImageUrl('https://cdn.example.com/frontend.jpg');
    nodeA.addFeature(new NoteModel({ text: 'React 页面' }));
    central.append(nodeA);

    const subA = mindmap.createNode('MainTopic', 2);
    subA.setText(undefined); // Image-only node without text should still export
    subA.setImageUrl('https://cdn.example.com/frontend.jpg'); // Reuses image-2.jpg
    nodeA.append(subA);

    const result = await TextExporterFactory.create('md', mindmap, '架构/设计:文档').exportFile();
    expect(result.extension).toBe('zip');
    expect(result.mimeType).toBe('application/zip');

    const entries = unzipSync(await readBlobBytes(result.blob));
    expect(Object.keys(entries).sort()).toEqual([
      'assets/image-1.png',
      'assets/image-2.jpg',
      '架构_设计_文档.md',
    ]);
    expect(entries['assets/image-1.png']).toEqual(TINY_PNG_BYTES);
    expect(entries['assets/image-2.jpg']).toEqual(remoteJpgBytes);

    const mdContent = strFromU8(entries['架构_设计_文档.md']!);
    expect(mdContent).toBe(
      [
        '# 架构设计',
        '',
        '![架构设计](assets/image-1.png)',
        '',
        '- 前端模块[^1] ',
        '\t![前端模块](assets/image-2.jpg)',
        '\t- ',
        '\t\t![图片](assets/image-2.jpg)',
        '',
        '',
        '',
        '[^1]: React 页面',
        '',
      ].join('\n'),
    );
  });

  it('aborts strictly if any image fetch fails during MD ZIP export', async () => {
    globalThis.fetch = jest.fn(() => Promise.reject(new Error('Network unreachable')));

    const mindmap = new Mindmap('broken-md');
    const central = mindmap.createNode('CentralTopic', 0);
    central.setText('Root');
    mindmap.addBranch(central);

    const child = mindmap.createNode('MainTopic', 1);
    child.setText('Node');
    child.setImageUrl('https://cdn.example.com/broken.png');
    central.append(child);

    await expect(
      TextExporterFactory.create('md', mindmap, 'Root').exportFile(),
    ).rejects.toThrow(/图片下载失败/);
  });
});
