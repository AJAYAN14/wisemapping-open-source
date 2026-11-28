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
import { fireEvent, render, screen } from '@testing-library/react';
import type { ContextMenuEvent, Designer } from '@wisemapping/mindplot';
import MindmapContextMenu, {
  buildContextMenuEntries,
} from '../../src/components/mindmap-context-menu';
import {
  buildImageDownloadFilename,
  copyImageToClipboard,
  copyTextToClipboard,
} from '../../src/utils/topicImageClipboard';

describe('buildContextMenuEntries', () => {
  const baseTopic: Extract<ContextMenuEvent, { target: 'topic' }> = {
    target: 'topic',
    clientX: 120,
    clientY: 160,
    topicId: 7,
    text: '重点主题',
    isCentral: false,
    hasImage: true,
    imageUrl: 'https://cdn.example.com/demo.avif',
    imageWidth: 120,
    imageHeight: 90,
    hasChildren: true,
    isCollapsed: false,
    readOnly: false,
    selectedCount: 1,
  };

  it('includes edit, preview, all three copy modes, download, paste-as-child, collapse, and delete for editable topic with image', () => {
    const ids = buildContextMenuEntries(baseTopic)
      .filter((entry) => entry.kind === 'item')
      .map((entry) => (entry.kind === 'item' ? entry.id : ''));

    expect(ids).toEqual([
      'edit',
      'previewImage',
      'copyTopic',
      'copyImage',
      'copyText',
      'downloadImage',
      'exportBranch',
      'pasteAsChild',
      'toggleBranch',
      'delete',
    ]);
  });

  it('omits image-only and branch items when topic has no image or children', () => {
    const noImageTopic: Extract<ContextMenuEvent, { target: 'topic' }> = {
      target: 'topic',
      clientX: 120,
      clientY: 160,
      topicId: 7,
      text: '重点主题',
      isCentral: false,
      hasImage: false,
      hasChildren: false,
      isCollapsed: false,
      readOnly: false,
      selectedCount: 1,
    };
    const ids = buildContextMenuEntries(noImageTopic)
      .filter((entry) => entry.kind === 'item')
      .map((entry) => (entry.kind === 'item' ? entry.id : ''));

    expect(ids).toEqual(['edit', 'copyTopic', 'copyText', 'exportBranch', 'pasteAsChild', 'delete']);
  });

  it('hides copyTopic, exportBranch, and delete for a single central topic while keeping image/text copy', () => {
    const ids = buildContextMenuEntries({
      ...baseTopic,
      isCentral: true,
      selectedCount: 1,
    })
      .filter((entry) => entry.kind === 'item')
      .map((entry) => (entry.kind === 'item' ? entry.id : ''));

    expect(ids).not.toContain('copyTopic');
    expect(ids).not.toContain('exportBranch');
    expect(ids).not.toContain('delete');
    expect(ids).toContain('copyImage');
    expect(ids).toContain('copyText');
    expect(ids).toContain('downloadImage');
  });

  it('hides exportBranch when multiple topics are selected or canExport is false', () => {
    const multiIds = buildContextMenuEntries({
      ...baseTopic,
      selectedCount: 2,
    })
      .filter((entry) => entry.kind === 'item')
      .map((entry) => (entry.kind === 'item' ? entry.id : ''));
    expect(multiIds).not.toContain('exportBranch');

    const disabledExportIds = buildContextMenuEntries(baseTopic, { canExport: false })
      .filter((entry) => entry.kind === 'item')
      .map((entry) => (entry.kind === 'item' ? entry.id : ''));
    expect(disabledExportIds).not.toContain('exportBranch');
  });

  it('shows only non-mutating actions in read-only mode', () => {
    const ids = buildContextMenuEntries({
      ...baseTopic,
      readOnly: true,
    })
      .filter((entry) => entry.kind === 'item')
      .map((entry) => (entry.kind === 'item' ? entry.id : ''));

    expect(ids).toEqual([
      'previewImage',
      'copyTopic',
      'copyImage',
      'copyText',
      'downloadImage',
      'exportBranch',
    ]);
  });

  it('disables copyText when topic text is blank', () => {
    const copyTextItem = buildContextMenuEntries({
      ...baseTopic,
      text: '   ',
    }).find((entry) => entry.kind === 'item' && entry.id === 'copyText');

    expect(copyTextItem).toMatchObject({ kind: 'item', id: 'copyText', disabled: true });
  });

  it('builds canvas menu for editable and read-only modes', () => {
    const editableIds = buildContextMenuEntries({
      target: 'canvas',
      clientX: 10,
      clientY: 20,
      readOnly: false,
    })
      .filter((entry) => entry.kind === 'item')
      .map((entry) => (entry.kind === 'item' ? entry.id : ''));
    expect(editableIds).toEqual(['paste', 'zoomToFit', 'zoomIn', 'zoomOut']);

    const readOnlyIds = buildContextMenuEntries({
      target: 'canvas',
      clientX: 10,
      clientY: 20,
      readOnly: true,
    })
      .filter((entry) => entry.kind === 'item')
      .map((entry) => (entry.kind === 'item' ? entry.id : ''));
    expect(readOnlyIds).toEqual(['zoomToFit', 'zoomIn', 'zoomOut']);
  });
});

describe('MindmapContextMenu component', () => {
  it('invokes callbacks and designer commands when clicking menu items', () => {
    const designer = {
      editTopicById: jest.fn(),
      pasteClipboardAsChild: jest.fn().mockResolvedValue(undefined),
      shrinkSelectedBranch: jest.fn(),
      deleteSelectedEntities: jest.fn(),
    } as unknown as Designer;

    const onClose = jest.fn();
    const onCopyTopic = jest.fn();
    const onCopyImage = jest.fn();
    const onCopyText = jest.fn();
    const onDownloadImage = jest.fn();
    const onExportBranch = jest.fn();
    const onPreviewImage = jest.fn();

    const event: ContextMenuEvent = {
      target: 'topic',
      clientX: 200,
      clientY: 240,
      topicId: 42,
      text: '重点主题',
      isCentral: false,
      hasImage: true,
      imageUrl: 'https://cdn.example.com/topic.avif',
      imageWidth: 150,
      imageHeight: 100,
      hasChildren: true,
      isCollapsed: true,
      readOnly: false,
      selectedCount: 1,
    };

    const { rerender } = render(
      <MindmapContextMenu
        contextMenu={event}
        designer={designer}
        onClose={onClose}
        onCopyTopic={onCopyTopic}
        onCopyImage={onCopyImage}
        onCopyText={onCopyText}
        onDownloadImage={onDownloadImage}
        onExportBranch={onExportBranch}
        onPreviewImage={onPreviewImage}
      />,
    );

    fireEvent.click(screen.getByText('只复制图片'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCopyImage).toHaveBeenCalledWith('https://cdn.example.com/topic.avif');

    rerender(
      <MindmapContextMenu
        contextMenu={event}
        designer={designer}
        onClose={onClose}
        onCopyTopic={onCopyTopic}
        onCopyImage={onCopyImage}
        onCopyText={onCopyText}
        onDownloadImage={onDownloadImage}
        onExportBranch={onExportBranch}
        onPreviewImage={onPreviewImage}
      />,
    );

    fireEvent.click(screen.getByText('导出该主题及分支'));
    expect(onExportBranch).toHaveBeenCalledWith(42);

    fireEvent.click(screen.getByText('复制主题'));
    expect(onCopyTopic).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('只复制内容'));
    expect(onCopyText).toHaveBeenCalledWith('重点主题');

    fireEvent.click(screen.getByText('编辑'));
    expect(designer.editTopicById).toHaveBeenCalledWith(42);

    fireEvent.click(screen.getByText('下载图片'));
    expect(onDownloadImage).toHaveBeenCalledWith('https://cdn.example.com/topic.avif', '重点主题');

    fireEvent.click(screen.getByText('展开分支'));
    expect(designer.shrinkSelectedBranch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('查看大图'));
    expect(onPreviewImage).toHaveBeenCalledWith({
      url: 'https://cdn.example.com/topic.avif',
      title: '重点主题',
      width: 150,
      height: 100,
    });
  });
});

describe('topicImageClipboard helpers', () => {
  const originalFetch = global.fetch;
  const originalClipboard = navigator.clipboard;
  const originalClipboardItem = (globalThis as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      writable: true,
      value: originalClipboardItem,
    });
    jest.restoreAllMocks();
  });

  it('builds safe download filenames from title, mime type, and URL extension', () => {
    expect(buildImageDownloadFilename('重点主题 / 选型', 'image/avif', 'https://a/b')).toBe(
      '重点主题 选型.avif',
    );
    expect(
      buildImageDownloadFilename(undefined, '', 'https://cdn.example.com/x/photo.jpeg?v=1'),
    ).toBe('topic-image.jpg');
  });

  it('writes text via navigator.clipboard.writeText', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await copyTextToClipboard('hello');
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('writes PNG image blob to ClipboardItem without awaiting before clipboard.write', async () => {
    const pngBlob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => pngBlob,
    } as Response);

    const write = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write },
    });

    class MockClipboardItem {
      items: Record<string, Blob | Promise<Blob>>;
      constructor(items: Record<string, Blob | Promise<Blob>>) {
        this.items = items;
      }
    }
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      writable: true,
      value: MockClipboardItem,
    });

    await copyImageToClipboard('https://cdn.example.com/a.png');
    expect(write).toHaveBeenCalledTimes(1);
    const passedItem = write.mock.calls[0]?.[0]?.[0] as MockClipboardItem;
    expect(passedItem.items['image/png']).toBeInstanceOf(Promise);
    await expect(passedItem.items['image/png']).resolves.toBe(pngBlob);
  });
});
