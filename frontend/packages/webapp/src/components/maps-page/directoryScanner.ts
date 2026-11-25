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

export const SUPPORTED_EXTENSIONS = ['wxml', 'mm', 'mmx', 'xmind', 'mmap', 'opml'];

const extractExtension = (fileName: string): string | undefined => {
  const trimmed = fileName.trim();
  const dotIdx = trimmed.lastIndexOf('.');
  if (dotIdx <= 0 || dotIdx === trimmed.length - 1) {
    return undefined;
  }
  return trimmed.slice(dotIdx + 1).toLowerCase();
};

export interface ScannedMapFile {
  file: File;
  title: string;
  extension: string;
  folderPath: string; // e.g. "Work/2026/" or ""
  relativePath: string; // e.g. "Work/2026/Architecture.xmind"
}

export const isSupportedMindmapFile = (fileName: string): boolean => {
  const ext = extractExtension(fileName);
  return Boolean(ext && SUPPORTED_EXTENSIONS.includes(ext));
};

/**
 * Extracts supported mindmap files from a FileList or array of File objects
 * (e.g. from an <input type="file"> or <input type="file" webkitdirectory>).
 */
export const scanFileList = (files: FileList | File[]): ScannedMapFile[] => {
  const results: ScannedMapFile[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;
    const ext = extractExtension(file.name);
    if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) continue;

    const relativePath = file.webkitRelativePath || file.name;
    const lastSlash = relativePath.lastIndexOf('/');
    const folderPath = lastSlash !== -1 ? relativePath.substring(0, lastSlash + 1) : '';
    const title = file.name.trim().replace(/\.[^/.]+$/, '');

    results.push({
      file,
      title,
      extension: ext,
      folderPath,
      relativePath,
    });
  }
  return results;
};

/**
 * Recursively scans files and directories from DataTransferItemList during a drag-and-drop event.
 */
export const scanDataTransferItems = async (
  items: DataTransferItemList | DataTransferItem[],
): Promise<ScannedMapFile[]> => {
  const scanned: ScannedMapFile[] = [];

  const traverseFileEntry = (entry: any, parentPath: string): Promise<void> => {
    return new Promise((resolve) => {
      entry.file(
        (file: File) => {
          const ext = extractExtension(file.name);
          if (ext && SUPPORTED_EXTENSIONS.includes(ext)) {
            const title = file.name.trim().replace(/\.[^/.]+$/, '');
            const folderPath = parentPath
              ? parentPath.endsWith('/')
                ? parentPath
                : `${parentPath}/`
              : '';
            scanned.push({
              file,
              title,
              extension: ext,
              folderPath,
              relativePath: `${folderPath}${file.name}`,
            });
          }
          resolve();
        },
        () => resolve(),
      );
    });
  };

  const traverseDirectoryEntry = (dirEntry: any, currentPath: string): Promise<void> => {
    return new Promise((resolve) => {
      const dirReader = dirEntry.createReader();
      const readNextBatch = () => {
        dirReader.readEntries(
          async (entries: any[]) => {
            if (!entries || entries.length === 0) {
              resolve();
              return;
            }
            for (const entry of entries) {
              if (entry.isFile) {
                await traverseFileEntry(entry, currentPath);
              } else if (entry.isDirectory) {
                const subPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
                await traverseDirectoryEntry(entry, subPath);
              }
            }
            readNextBatch();
          },
          () => resolve(),
        );
      };
      readNextBatch();
    });
  };

  const promises: Promise<void>[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== 'file') continue;
    const entry = (item as any).webkitGetAsEntry
      ? (item as any).webkitGetAsEntry()
      : (item as any).getAsEntry
        ? (item as any).getAsEntry()
        : null;
    if (entry) {
      if (entry.isFile) {
        promises.push(traverseFileEntry(entry, ''));
      } else if (entry.isDirectory) {
        promises.push(traverseDirectoryEntry(entry, entry.name));
      }
    } else {
      const file = item.getAsFile();
      if (file) {
        const ext = extractExtension(file.name);
        if (ext && SUPPORTED_EXTENSIONS.includes(ext)) {
          scanned.push({
            file,
            title: file.name.trim().replace(/\.[^/.]+$/, ''),
            extension: ext,
            folderPath: '',
            relativePath: file.name,
          });
        }
      }
    }
  }

  await Promise.all(promises);
  return scanned;
};
