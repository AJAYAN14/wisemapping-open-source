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

import { zipSync } from 'fflate';
import ContentType from '../ContentType';
import type INodeModel from '../model/INodeModel';
import type { TopicShapeType } from '../model/INodeModel';
import type Mindmap from '../model/Mindmap';
import type NoteModel from '../model/NoteModel';
import type RelationshipModel from '../model/RelationshipModel';
import { htmlToPlainText } from '../import/support/HtmlText';
import { encodeUtf8 } from '../import/support/Utf8Decoder';
import { XMIND_MARKER_EMOJIS, XMIND_MARKER_SVG_ICONS } from '../import/XMindImporter';
import Exporter, { type ExportFileResult } from './Exporter';
import { collectMindmapImages, type CollectedImageAsset } from './support/ImageAssetCollector';

interface XMindExportMarker {
  markerId: string;
}

interface XMindExportStyle {
  id: string;
  properties: Record<string, string>;
}

interface XMindExportTopic {
  id: string;
  class?: string;
  title: string;
  structureClass?: string;
  position?: { x: number; y: number };
  notes?: { plain: { content: string } };
  markers?: XMindExportMarker[];
  href?: string;
  image?: {
    src: string;
    width?: number;
    height?: number;
  };
  style?: XMindExportStyle;
  children?: {
    attached?: XMindExportTopic[];
    detached?: XMindExportTopic[];
  };
}

interface XMindExportRelationship {
  id: string;
  end1Id: string;
  end2Id: string;
}

interface XMindExportSheet {
  id: string;
  class: 'sheet';
  title: string;
  rootTopic: XMindExportTopic;
  relationships?: XMindExportRelationship[];
}

const XMIND_MIME_TYPE = 'application/vnd.xmind.workbook';

const SHAPE_CLASS_MAP: Readonly<Partial<Record<TopicShapeType, string>>> = {
  rectangle: 'org.xmind.topicShape.rect',
  'rounded rectangle': 'org.xmind.topicShape.roundedRect',
  elipse: 'org.xmind.topicShape.ellipse',
  line: 'org.xmind.topicShape.underline',
  none: 'org.xmind.topicShape.noBorder',
};

const WISE_TO_XMIND_FONT_SIZE: Readonly<Record<number, number>> = {
  6: 10,
  8: 12,
  10: 18,
  15: 24,
};

const withoutVariationSelector = (emoji: string): string => emoji.replace(/\uFE0F/g, '');

// Build reverse maps once from XMindImporter's marker tables so icons round-trip cleanly.
const svgIconToMarkerId = new Map<string, string>();
Object.entries(XMIND_MARKER_SVG_ICONS).forEach(([markerId, svgId]) => {
  if (!svgIconToMarkerId.has(svgId)) {
    svgIconToMarkerId.set(svgId, markerId);
  }
});
if (!svgIconToMarkerId.has('flag_red')) {
  svgIconToMarkerId.set('flag_red', 'flag-red');
}

const emojiToMarkerId = new Map<string, string>();
Object.entries(XMIND_MARKER_EMOJIS).forEach(([markerId, emoji]) => {
  const key = withoutVariationSelector(emoji);
  if (!emojiToMarkerId.has(key)) {
    emojiToMarkerId.set(key, markerId);
  }
});

const normalizeHexColor = (color: string | undefined): string | undefined => {
  if (!color) {
    return undefined;
  }
  const trimmed = color.trim();
  const rgbMatch = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(trimmed);
  if (rgbMatch) {
    const hex = rgbMatch
      .slice(1)
      .map((channel) => Math.min(255, parseInt(channel, 10)).toString(16).padStart(2, '0'));
    return `#${hex.join('').toUpperCase()}`;
  }
  return trimmed;
};

class XMindExporter extends Exporter {
  private mindmap: Mindmap;

  private mapName: string;

  constructor(mindmap: Mindmap, mapName?: string) {
    super('xmind', XMIND_MIME_TYPE);
    this.mindmap = mindmap;
    this.mapName = mapName?.trim() || mindmap.getId()?.trim() || 'Central Topic';
  }

  export(): Promise<string> {
    throw new Error('XMind export produces a binary ZIP archive; use exportFile() or exportBinary().');
  }

  override async exportFile(): Promise<ExportFileResult> {
    const bytes = await this.exportBinary();
    return {
      blob: new Blob([new Uint8Array(bytes)], { type: this.getContentType() }),
      extension: this.extension(),
      mimeType: this.getContentType(),
    };
  }

  async exportBinary(): Promise<Uint8Array> {
    const centralTopic = Exporter.centralTopicOf(this.mindmap);
    const { assets, bySourceUrl } = await collectMindmapImages(this.mindmap);

    const nodeToXMindId = new Map<INodeModel, string>();
    const idToXMindId = new Map<number, string>();
    let topicSeq = 0;
    const assignTopicId = (node: INodeModel): string => {
      const existing = nodeToXMindId.get(node);
      if (existing) {
        return existing;
      }
      topicSeq += 1;
      const numericId = node.getId();
      const xmindId = Number.isFinite(numericId)
        ? `wm-topic-${numericId}-${topicSeq}`
        : `wm-topic-${topicSeq}`;
      nodeToXMindId.set(node, xmindId);
      if (Number.isFinite(numericId) && !idToXMindId.has(numericId)) {
        idToXMindId.set(numericId, xmindId);
      }
      return xmindId;
    };

    const rootTopic = this.buildTopic(centralTopic, true, assignTopicId, bySourceUrl);
    rootTopic.structureClass = 'org.xmind.ui.map.clockwise';

    const detachedBranches = this.mindmap
      .getBranches()
      .slice(1)
      .map((branch) => {
        const detachedTopic = this.buildTopic(branch, false, assignTopicId, bySourceUrl);
        const pos = branch.getPosition();
        detachedTopic.position = pos ? { x: Math.round(pos.x), y: Math.round(pos.y) } : { x: 0, y: 0 };
        return detachedTopic;
      });

    if (detachedBranches.length > 0) {
      rootTopic.children = {
        ...rootTopic.children,
        detached: detachedBranches,
      };
    }

    const relationships = this.buildRelationships(idToXMindId);
    const sheetId = 'wm-sheet-1';
    const sheetTitle = this.extractNodeTitle(centralTopic) || this.mapName;

    const sheet: XMindExportSheet = {
      id: sheetId,
      class: 'sheet',
      title: sheetTitle,
      rootTopic,
      ...(relationships.length > 0 ? { relationships } : {}),
    };

    const archiveEntries: Record<string, Uint8Array> = {
      'content.json': encodeUtf8(JSON.stringify([sheet])),
      'metadata.json': encodeUtf8(
        JSON.stringify({
          creator: { name: 'WiseMapping', version: '6.0.1' },
          activeSheetId: sheetId,
        }),
      ),
    };

    const manifestEntries: Record<string, Record<string, never>> = {
      'content.json': {},
      'metadata.json': {},
    };

    assets.forEach((asset) => {
      const entryPath = `resources/${asset.filename}`;
      archiveEntries[entryPath] = asset.bytes;
      manifestEntries[entryPath] = {};
    });

    archiveEntries['manifest.json'] = encodeUtf8(
      JSON.stringify({
        'file-entries': manifestEntries,
      }),
    );

    return zipSync(archiveEntries, { level: 6 });
  }

  private extractNodeTitle(node: INodeModel): string {
    const raw = node.getText() ?? '';
    const text = node.getContentType() === ContentType.HTML ? htmlToPlainText(raw) : raw;
    return text.trim();
  }

  private extractNoteContent(note: NoteModel): string {
    const raw = note.getText();
    const text = note.getContentType() === ContentType.HTML ? htmlToPlainText(raw) : raw;
    return text.trim();
  }

  private buildTopic(
    node: INodeModel,
    isRoot: boolean,
    assignTopicId: (n: INodeModel) => string,
    assetsByUrl: Map<string, CollectedImageAsset>,
  ): XMindExportTopic {
    const id = assignTopicId(node);
    const markers: XMindExportMarker[] = [];
    const seenMarkerIds = new Set<string>();
    const unmappedEmojis: string[] = [];

    const pushMarker = (markerId: string | undefined): void => {
      if (markerId && !seenMarkerIds.has(markerId)) {
        seenMarkerIds.add(markerId);
        markers.push({ markerId });
      }
    };

    let noteContent: string | undefined;
    let href: string | undefined;

    node.getFeatures().forEach((feature) => {
      if (feature.isOfType('icon')) {
        const markerId = svgIconToMarkerId.get(feature.getIconType());
        pushMarker(markerId);
      } else if (feature.isOfType('eicon')) {
        const emoji = feature.getIconType();
        const markerId = emojiToMarkerId.get(withoutVariationSelector(emoji));
        if (markerId) {
          pushMarker(markerId);
        } else if (emoji) {
          unmappedEmojis.push(emoji);
        }
      } else if (feature.isOfType('note') && !noteContent) {
        const extracted = this.extractNoteContent(feature);
        if (extracted) {
          noteContent = extracted;
        }
      } else if (feature.isOfType('link') && !href) {
        const url = feature.getUrl()?.trim();
        if (url) {
          href = url;
        }
      }
    });

    const imageEmoji = node.getImageEmojiChar()?.trim();
    if (imageEmoji) {
      const markerId = emojiToMarkerId.get(withoutVariationSelector(imageEmoji));
      if (markerId) {
        pushMarker(markerId);
      } else {
        unmappedEmojis.push(imageEmoji);
      }
    }

    let title = this.extractNodeTitle(node);
    if (!title && isRoot) {
      title = this.mapName;
    }
    if (unmappedEmojis.length > 0) {
      const prefix = unmappedEmojis.join(' ');
      title = title ? `${prefix} ${title}` : prefix;
    }

    const topic: XMindExportTopic = {
      id,
      class: 'topic',
      title,
    };

    if (markers.length > 0) {
      topic.markers = markers;
    }
    if (noteContent) {
      topic.notes = { plain: { content: noteContent } };
    }
    if (href) {
      topic.href = href;
    }

    const imageUrl = node.getImageUrl()?.trim();
    if (imageUrl) {
      const asset = assetsByUrl.get(imageUrl);
      if (asset) {
        const size = node.getImageSize();
        topic.image = {
          src: `xap:resources/${asset.filename}`,
          ...(size ? { width: Math.round(size.width), height: Math.round(size.height) } : {}),
        };
      }
    }

    const style = this.buildTopicStyle(node, id);
    if (style) {
      topic.style = style;
    }

    const attached = node
      .getChildren()
      .map((child) => this.buildTopic(child, false, assignTopicId, assetsByUrl));
    if (attached.length > 0) {
      topic.children = { attached };
    }

    return topic;
  }

  private buildTopicStyle(node: INodeModel, topicId: string): XMindExportStyle | undefined {
    const properties: Record<string, string> = {};

    const shape = node.getShapeType();
    const shapeClass = shape ? SHAPE_CLASS_MAP[shape] : undefined;
    if (shapeClass) {
      properties['shape-class'] = shapeClass;
    }

    const bgColor = normalizeHexColor(node.getBackgroundColor());
    if (bgColor) {
      properties['svg:fill'] = bgColor;
    }

    const borderColor = normalizeHexColor(node.getBorderColor());
    if (borderColor) {
      properties['border-line-color'] = borderColor;
    }

    const fontColor = normalizeHexColor(node.getFontColor());
    if (fontColor) {
      properties['fo:color'] = fontColor;
    }

    const fontFamily = node.getFontFamily()?.trim();
    if (fontFamily) {
      properties['fo:font-family'] = fontFamily;
    }

    const fontSize = node.getFontSize();
    if (fontSize && Number.isFinite(fontSize)) {
      const pt = WISE_TO_XMIND_FONT_SIZE[fontSize] ?? fontSize;
      properties['fo:font-size'] = `${pt}pt`;
    }

    const fontWeight = node.getFontWeight();
    if (fontWeight === 'bold') {
      properties['fo:font-weight'] = 'bold';
    }

    const fontStyle = node.getFontStyle();
    if (fontStyle === 'italic') {
      properties['fo:font-style'] = 'italic';
    }

    const connectionColor = normalizeHexColor(node.getConnectionColor());
    if (connectionColor) {
      properties['line-color'] = connectionColor;
    }

    if (Object.keys(properties).length === 0) {
      return undefined;
    }

    return {
      id: `${topicId}-style`,
      properties,
    };
  }

  private buildRelationships(idToXMindId: Map<number, string>): XMindExportRelationship[] {
    const result: XMindExportRelationship[] = [];
    this.mindmap.getRelationships().forEach((rel: RelationshipModel, index: number) => {
      const end1Id = idToXMindId.get(rel.getFromNode());
      const end2Id = idToXMindId.get(rel.getToNode());
      if (end1Id && end2Id) {
        result.push({
          id: `wm-rel-${rel.getId()}-${index + 1}`,
          end1Id,
          end2Id,
        });
      }
    });
    return result;
  }
}

export default XMindExporter;
