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
import { webcrypto } from 'node:crypto';
import * as imageAssetUtils from '@wisemapping/editor/utils/imageAssetUtils';
import type Client from '../../../src/classes/client';
import type { AssetUploadUrlRequest } from '../../../src/classes/client';
import {
  externalizeXmlInlineImages,
  uploadBlobToMapAssets,
  type ExternalizeImageProgress,
} from '../../../src/utils/mapAssets';

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

describe('mapAssets AVIF conversion & externalization', () => {
  const originalFetch = globalThis.fetch;
  const originalCrypto = globalThis.crypto;

  beforeAll(() => {
    if (!globalThis.crypto?.subtle) {
      Object.defineProperty(globalThis, 'crypto', {
        value: webcrypto,
        configurable: true,
      });
    }
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      configurable: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  test('converts >= 150 KB inline images and small GIFs to static AVIF, abandons SVG, and uploads deduplicated assets', async () => {
    const smallBytes = new Uint8Array(1024).fill(1);
    const smallGifBytes = new Uint8Array(2048).fill(4);
    const largeBytes = new Uint8Array(180 * 1024).fill(2);
    const avifBytes = new Uint8Array(25 * 1024).fill(9);

    const convertSpy = jest
      .spyOn(imageAssetUtils, 'convertBlobToAvifIfEligible')
      .mockResolvedValue({
        blob: new Blob([avifBytes], { type: 'image/avif' }),
        mimeType: 'image/avif',
        converted: true,
      });

    const requestedItems: Array<{ sha256: string; mimeType: string; size?: number }> = [];
    const uploadedPayloads: Array<{ url: string }> = [];

    globalThis.fetch = jest.fn(async (url: RequestInfo | URL) => {
      uploadedPayloads.push({ url: String(url) });
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    const client = {
      requestAssetUploadUrls: jest.fn(async (items: AssetUploadUrlRequest[]) => {
        requestedItems.push(...items);
        return items.map((item) => ({
          sha256: item.sha256,
          objectPath: `uid/${item.sha256}.${item.mimeType === 'image/avif' ? 'avif' : 'png'}`,
          publicUrl: `https://cdn.example.com/${item.sha256}.${item.mimeType === 'image/avif' ? 'avif' : 'png'}`,
          exists: false,
          signedUrl: `https://upload.example.com/${item.sha256}`,
        }));
      }),
    } as unknown as Client;

    const smallUri = `data:image/png;base64,${toBase64(smallBytes)}`;
    const smallGifUri = `data:image/gif;base64,${toBase64(smallGifBytes)}`;
    const svgUri = `data:image/svg+xml;base64,${toBase64(new Uint8Array([60, 115, 118, 103, 62]))}`;
    const largeUri = `data:image/png;base64,${toBase64(largeBytes)}`;
    const xml = `<map><topic id="1" image="120,80:${smallUri}"/><topic id="2" image="150,100:${largeUri}"/><topic id="3" image="150,100:${largeUri}"/><topic id="4" image="90,60:${smallGifUri}"/><topic id="5" image="80,80:${svgUri}"/></map>`;

    const phases: ExternalizeImageProgress['phase'][] = [];
    const nextXml = await externalizeXmlInlineImages(xml, client, (p) => phases.push(p.phase));

    // Unique >= 150 KB PNG + small GIF converted; SVG abandoned without uploading
    expect(convertSpy).toHaveBeenCalledTimes(2);
    expect(requestedItems).toHaveLength(2);
    expect(requestedItems.map((i) => i.mimeType)).toEqual(['image/png', 'image/avif']);
    expect(requestedItems[1]?.size).toBe(avifBytes.length);
    expect(uploadedPayloads).toHaveLength(2);
    expect(phases).toContain('converting');
    expect(phases).toContain('signing');
    expect(phases).toContain('uploading');
    expect(phases[phases.length - 1]).toBe('done');
    expect(nextXml).not.toContain('data:image/');
    expect(nextXml).not.toContain('id="5" image=');
    expect(nextXml).toContain('.avif');
  });

  test('strips inline SVG images even when no uploadable images remain', async () => {
    const client = {
      requestAssetUploadUrls: jest.fn(),
    } as unknown as Client;

    const svgUri = `data:image/svg+xml;base64,${toBase64(new Uint8Array([60, 115, 118, 103, 62]))}`;
    const xml = `<map><topic id="1" image="80,80:${svgUri}"/></map>`;

    const nextXml = await externalizeXmlInlineImages(xml, client);
    expect(client.requestAssetUploadUrls).not.toHaveBeenCalled();
    expect(nextXml).toBe('<map><topic id="1" /></map>');
  });

  test('rejects image/svg+xml in uploadBlobToMapAssets', async () => {
    const client = {
      requestAssetUploadUrls: jest.fn(),
    } as unknown as Client;

    const svgBlob = new Blob([new Uint8Array([60, 115, 118, 103, 62])], {
      type: 'image/svg+xml',
    });
    await expect(uploadBlobToMapAssets(client, svgBlob)).rejects.toThrow(/SVG/);
    expect(client.requestAssetUploadUrls).not.toHaveBeenCalled();
  });

  test('aborts import strictly when AVIF conversion fails for a >= 150 KB inline image', async () => {
    const largeBytes = new Uint8Array(180 * 1024).fill(3);
    jest
      .spyOn(imageAssetUtils, 'convertBlobToAvifIfEligible')
      .mockRejectedValue(new Error('AVIF 图片转码失败: decode error'));

    const client = {
      requestAssetUploadUrls: jest.fn(),
    } as unknown as Client;

    const largeUri = `data:image/png;base64,${toBase64(largeBytes)}`;
    const xml = `<map><topic id="1" image="150,100:${largeUri}"/></map>`;

    await expect(externalizeXmlInlineImages(xml, client)).rejects.toThrow(/AVIF 图片转码失败/);
    expect(client.requestAssetUploadUrls).not.toHaveBeenCalled();
  });

  test('uploads image/avif blobs via uploadBlobToMapAssets', async () => {
    globalThis.fetch = jest.fn(async () => new Response(null, { status: 200 })) as typeof fetch;

    const client = {
      requestAssetUploadUrls: jest.fn(async (items: AssetUploadUrlRequest[]) => [
        {
          sha256: items[0]!.sha256,
          objectPath: `uid/${items[0]!.sha256}.avif`,
          publicUrl: `https://cdn.example.com/${items[0]!.sha256}.avif`,
          exists: false,
          signedUrl: 'https://upload.example.com/signed',
        },
      ]),
    } as unknown as Client;

    const avifBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/avif' });
    const url = await uploadBlobToMapAssets(client, avifBlob);
    expect(url).toMatch(/\.avif$/);
  });
});
