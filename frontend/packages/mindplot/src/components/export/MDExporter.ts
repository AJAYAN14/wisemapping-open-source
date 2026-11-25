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
import type Mindmap from '../model/Mindmap';
import type INodeModel from '../model/INodeModel';
import type NoteModel from '../model/NoteModel';
import Exporter, { type ExportFileResult } from './Exporter';
import ContentType from '../ContentType';
import { BLOCK_TAGS, htmlToPlainText } from '../import/support/HtmlText';
import { encodeUtf8 } from '../import/support/Utf8Decoder';
import { collectMindmapImages, sanitizeExportFileName } from './support/ImageAssetCollector';

class MDExporter extends Exporter {
  private mindmap: Mindmap;

  private mapName: string | undefined;

  // The footnotes, as Markdown: one line, or several when the note has lists.
  private footNotes: string[] = [];

  // The footnotes with lists, which a blank line must end.
  private listFootNotes = new Set<number>();

  constructor(mindmap: Mindmap, mapName?: string) {
    super('md', 'text/markdown');
    this.mindmap = mindmap;
    this.mapName = mapName;
  }

  private normalizeText(value: string): string {
    // Markdown headings and footnote definitions must stay on a single line ...
    return value.replace(/\s*\r?\n\s*/g, ' ').trim();
  }

  // Title of a central topic without text, so its branches are still exported.
  static readonly UNTITLED = 'Untitled';

  // Escapes the Markdown syntax of a single line of text, so it renders literally.
  static escape(value: string): string {
    return (
      value
        // Inline syntax: emphasis, code, links, footnote references, html, strikethrough, tables.
        .replace(/[\\`*_[\]<>~|]/g, '\\$&')
        // Entity and numeric character references.
        .replace(/&(?=#?\w+;)/g, '\\&')
        // Headings and closing hash sequences.
        .replace(/(^|\s)#/g, '$1\\#')
        // Block syntax at the start of the line: block quotes, bullet and ordered lists.
        .replace(/^[>+-]/, '\\$&')
        .replace(/^(\d+)([.)])/, '$1\\$2')
    );
  }

  export(): Promise<string> {
    return Promise.resolve(this.renderMarkdown());
  }

  override async exportFile(): Promise<ExportFileResult> {
    const centralTopic = Exporter.centralTopicOf(this.mindmap);
    const { assets } = await collectMindmapImages(this.mindmap, false);

    if (assets.length === 0) {
      const markdown = this.renderMarkdown();
      return {
        blob: new Blob([markdown], { type: 'text/markdown' }),
        extension: 'md',
        mimeType: 'text/markdown',
      };
    }

    const assetPathByUrl = new Map<string, string>(
      assets.map((asset) => [asset.sourceUrl, `assets/${asset.filename}`]),
    );
    const markdown = this.renderMarkdown(assetPathByUrl);
    const mdBaseName = sanitizeExportFileName(
      this.mapName ?? (this.nodeText(centralTopic) || this.mindmap.getId()),
      'mindmap',
    );

    const archiveEntries: Record<string, Uint8Array> = {
      [`${mdBaseName}.md`]: encodeUtf8(markdown),
    };
    assets.forEach((asset) => {
      archiveEntries[`assets/${asset.filename}`] = asset.bytes;
    });

    const zipBytes = zipSync(archiveEntries, { level: 6 });
    return {
      blob: new Blob([new Uint8Array(zipBytes)], { type: 'application/zip' }),
      extension: 'zip',
      mimeType: 'application/zip',
    };
  }

  private renderMarkdown(assetPathByUrl?: Map<string, string>): string {
    this.footNotes = [];
    this.listFootNotes = new Set();

    // Add central node as heading. Without text, a placeholder keeps the branches as a list ...
    const centralTopic = Exporter.centralTopicOf(this.mindmap);
    const centralText = this.nodeText(centralTopic) || MDExporter.UNTITLED;

    // Traverse all the branches ...
    let result = `# ${MDExporter.escape(centralText)}\n\n`;
    const centralImageRef = this.resolveNodeImageRef(centralTopic, assetPathByUrl);
    if (centralImageRef) {
      result += `![${MDExporter.escape(centralText)}](${MDExporter.encodeUrl(centralImageRef)})\n\n`;
    }

    result += this.traverseBranch('', centralTopic.getChildren(), assetPathByUrl);

    // Write footnotes:
    if (this.footNotes.length > 0) {
      result += '\n\n\n';
      result += this.footNotes
        .map((note, index) => {
          // A blank line ends a footnote with lists, so the next one does not continue them.
          const separator = this.listFootNotes.has(index - 1) ? '\n\n' : '\n';
          return `${index > 0 ? separator : ''}[^${index + 1}]: ${note}`;
        })
        .join('');
    }
    result += '\n';
    return result;
  }

  private resolveNodeImageRef(
    node: INodeModel,
    assetPathByUrl?: Map<string, string>,
  ): string | undefined {
    const rawUrl = node.getImageUrl()?.trim();
    if (!rawUrl) {
      return undefined;
    }
    return assetPathByUrl?.get(rawUrl) ?? rawUrl;
  }

  // The text of a topic on a single line. The paragraphs and the lines of an html text are
  // separated by a space.
  private nodeText(node: INodeModel): string {
    const text = node.getText() || '';
    return this.normalizeText(
      node.getContentType() === ContentType.HTML ? htmlToPlainText(text) : text,
    );
  }

  // The text of a note on a single line, empty if it has no visible text. The paragraphs and the
  // lines of an html note are separated by a space.
  private noteText(note: NoteModel): string {
    return this.normalizeText(
      note.getContentType() === ContentType.HTML ? htmlToPlainText(note.getText()) : note.getText(),
    );
  }

  // Continuation lines of a footnote, and each nesting level of a list in it, are indented.
  private static readonly INDENT = '    ';

  /**
   * The Markdown of an html note with lists: its lists, nested by indentation, and the text
   * around them as paragraphs. Undefined for other notes, which are written on a single line.
   */
  private noteMarkdown(note: NoteModel): string | undefined {
    if (note.getContentType() !== ContentType.HTML) {
      return undefined;
    }
    const { body } = new DOMParser().parseFromString(note.getText(), 'text/html');
    if (!body.querySelector('li')) {
      return undefined;
    }

    const blocks: string[] = [];
    let paragraph = '';
    const flush = () => {
      // Html whitespace, which the blocks around the text add to, collapses.
      const text = paragraph.replace(/[ \t\r\n\f]+/g, ' ').trim();
      if (text) {
        blocks.push(MDExporter.escape(text));
      }
      paragraph = '';
    };
    const walk = (node: Node) => {
      if (MDExporter.isList(node)) {
        flush();
        const lines = MDExporter.listLines(node as Element, '');
        if (lines.length > 0) {
          blocks.push(lines.join('\n'));
        }
      } else if (node.nodeType === Node.ELEMENT_NODE && (node as Element).querySelector('li')) {
        node.childNodes.forEach(walk);
      } else {
        // Blocks and line breaks separate words.
        paragraph += ` ${MDExporter.inlineText(node)} `;
      }
    };
    body.childNodes.forEach(walk);
    flush();

    // The first block follows the footnote label, the others are indented to stay in the note.
    return blocks
      .join('\n\n')
      .split('\n')
      .map((line, index) => (index === 0 || line === '' ? line : `${MDExporter.INDENT}${line}`))
      .join('\n');
  }

  private static isList(node: Node): boolean {
    return node.nodeType === Node.ELEMENT_NODE && ['UL', 'OL'].includes((node as Element).tagName);
  }

  // The text of a node, with its line breaks and blocks separated by spaces.
  private static inlineText(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }
    const { tagName } = node as Element;
    if (tagName === 'BR') {
      return ' ';
    }
    const text = Array.from(node.childNodes)
      .map((child) => MDExporter.inlineText(child))
      .join('');
    return BLOCK_TAGS.has(tagName) ? ` ${text} ` : text;
  }

  // The lines of a list, its sub-lists indented one level more.
  private static listLines(list: Element, indent: string): string[] {
    const ordered = list.tagName === 'OL';
    const lines: string[] = [];
    let number = 0;
    Array.from(list.children).forEach((child) => {
      // A sub-list written next to the items belongs to the item above it.
      if (MDExporter.isList(child)) {
        lines.push(...MDExporter.listLines(child, `${indent}${MDExporter.INDENT}`));
        return;
      }
      if (child.tagName !== 'LI') {
        return;
      }
      const text = Array.from(child.childNodes)
        .filter((n) => !MDExporter.isList(n))
        .map((n) => MDExporter.inlineText(n))
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      const sublists = Array.from(child.children).filter((n) => MDExporter.isList(n));
      if (!text && sublists.length === 0) {
        return;
      }
      number += 1;
      const marker = ordered ? `${number}.` : '-';
      lines.push(`${indent}${marker}${text ? ` ${MDExporter.escape(text)}` : ''}`);
      sublists.forEach((sublist) => {
        lines.push(...MDExporter.listLines(sublist, `${indent}${MDExporter.INDENT}`));
      });
    });
    return lines;
  }

  // Markdown link destinations end at a space or an unbalanced ')' ...
  private static encodeUrl(url: string): string {
    return url.replace(/[\s()<>]/g, (c) => {
      if (c === '(') return '%28';
      if (c === ')') return '%29';
      return encodeURIComponent(c);
    });
  }

  // Topics without text are skipped, unless they hold something to export (children, icons, images, links or notes) ...
  private isExportable(node: INodeModel): boolean {
    return (
      this.nodeText(node) !== '' ||
      Boolean(node.getImageUrl()?.trim()) ||
      node
        .getFeatures()
        .some(
          (f) =>
            ['eicon', 'link'].includes(f.getType()) ||
            (f.isOfType('note') && this.noteText(f) !== ''),
        ) ||
      node.getChildren().some((n) => this.isExportable(n))
    );
  }

  private traverseBranch(
    prefix: string,
    branches: Array<INodeModel>,
    assetPathByUrl?: Map<string, string>,
  ) {
    let result = '';
    branches
      .filter((n) => this.isExportable(n))
      .forEach((node) => {
        // Convert icons to list ...
        const icons = node.getFeatures().filter((f) => f.isOfType('eicon'));
        let iconStr = ' ';
        if (icons.length > 0) {
          iconStr = ` ${icons.map((icon) => icon.getIconType()).toString()} `;
        }

        const nodeText = this.nodeText(node);
        result = `${result}${prefix}-${iconStr}${MDExporter.escape(nodeText)}`;
        node.getFeatures().forEach((f) => {
          // Dump all features ...
          if (f.isOfType('link')) {
            result = `${result} ( [link](${MDExporter.encodeUrl(f.getUrl())}) )`;
          }

          if (f.isOfType('note')) {
            // Empty notes would leave an empty footnote definition ...
            const noteText = this.noteText(f);
            if (noteText) {
              const markdown = this.noteMarkdown(f);
              if (markdown) {
                this.listFootNotes.add(this.footNotes.length);
              }
              this.footNotes.push(markdown ?? MDExporter.escape(noteText));
              result = `${result}[^${this.footNotes.length}] `;
            }
          }
        });
        result = `${result}\n`;

        const imageRef = this.resolveNodeImageRef(node, assetPathByUrl);
        if (imageRef) {
          const alt = nodeText ? MDExporter.escape(nodeText) : '图片';
          result = `${result}${prefix}\t![${alt}](${MDExporter.encodeUrl(imageRef)})\n`;
        }

        result += this.traverseBranch(`${prefix}\t`, node.getChildren(), assetPathByUrl);
      });
    return result;
  }
}
export default MDExporter;
