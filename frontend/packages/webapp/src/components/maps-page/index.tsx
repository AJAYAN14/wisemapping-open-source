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
import React, { ErrorInfo, ReactElement, use, useEffect, useMemo } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import {
  DRAWER_WIDTH_COLLAPSED,
  DRAWER_WIDTH_EXPANDED,
  DesktopDrawer,
  MobileDrawer,
  MobileDrawerToggle,
  PageContent,
  PageRoot,
  PrimaryToolbarButton,
  WorkspaceTopBar,
} from './styled';
import { MapsList } from './maps-list';
import { ImportProgressDialog, ImportStage } from './import-progress';
import { createIntl, FormattedMessage, IntlProvider } from 'react-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Folder, Label } from '../../classes/client';
import ActionDispatcher from './action-dispatcher';
import { ActionType } from './action-chooser';
import AccountMenu from './account-menu';
import AppI18n, { Locales } from '../../classes/app-i18n';
import { externalizeXmlInlineImages } from '../../utils/mapAssets';
import { useLocaleMessages } from '../../classes/app-i18n/messages';
import { useFetchAccount } from '../../classes/middleware';

import MenuRoundedIcon from '@mui/icons-material/MenuRounded';

import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import CreateNewFolderRoundedIcon from '@mui/icons-material/CreateNewFolderRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import LabelRoundedIcon from '@mui/icons-material/LabelRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import Tooltip from '@mui/material/Tooltip';

import LabelDeleteConfirm from './maps-list/label-delete-confirm';
import {
  FolderCreateDialog,
  FolderDeleteDialog,
  FolderMoveDialog,
  FolderRenameDialog,
} from './folder-dialogs';
import { MAP_IDS_DRAG_MIME, getFolderPathString } from './folderTree';
import DrawerNav, { ToolbarButtonInfo } from './drawer-nav';
import { APPLE_FONT_STACK, appleColors, glassMaterialMixin, isDarkTheme } from './appleDesign';
import { useSpringValue } from './useSpringValue';
import { ClientContext } from '../../classes/provider/client-context';
import { ScannedMapFile, scanFileList, scanDataTransferItems } from './directoryScanner';
import { readStorage, writeStorage, removeStorage } from '../../utils/storage';
import { buildMapEditPath } from '../../utils/mapPath';

export type Filter = GenericFilter | LabelFilter | FolderFilter;

export interface GenericFilter {
  type: 'all' | 'starred' | 'uncategorized' | 'label';
}

export interface LabelFilter {
  type: 'label';
  label: Label;
}

export interface FolderFilter {
  type: 'folder';
  folderId: number | null;
}

type FolderDialogState =
  | { mode: 'create'; parentId: number | null }
  | { mode: 'rename'; folder: Folder }
  | { mode: 'move'; folder: Folder }
  | { mode: 'delete'; folder: Folder }
  | undefined;

type ToastState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
};

const MAPS_MAIN_TAB_STORAGE_KEY = 'mapsMainTab';

const MapsPage = (): ReactElement => {
  const [filter, setFilter] = React.useState<Filter>(() =>
    readStorage(MAPS_MAIN_TAB_STORAGE_KEY) === 'folders'
      ? { type: 'folder', folderId: null }
      : { type: 'all' },
  );
  const client = use(ClientContext);
  const queryClient = useQueryClient();
  const [activeDialog, setActiveDialog] = React.useState<ActionType | undefined>(undefined);
  const [labelToDelete, setLabelToDelete] = React.useState<number>();
  const [folderDialog, setFolderDialog] = React.useState<FolderDialogState>(undefined);
  const [toast, setToast] = React.useState<ToastState>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [mobileDrawerOpen, setMobileDrawerOpen] = React.useState(false);
  const [desktopDrawerOpen, setDesktopDrawerOpen] = React.useState(
    () => readStorage('desktopDrawerOpen') === 'true',
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const folderInputRef = React.useRef<HTMLInputElement>(null);
  const [createMenuAnchor, setCreateMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);
  const dragCounter = React.useRef(0);
  const duplicateResolverRef = React.useRef<
    ((decision: 'overwrite' | 'skip' | 'cancel') => void) | null
  >(null);

  const resolveDuplicateDecision = (decision: 'overwrite' | 'skip' | 'cancel') => {
    const resolver = duplicateResolverRef.current;
    duplicateResolverRef.current = null;
    resolver?.(decision);
  };

  const askDuplicateDecision = (): Promise<'overwrite' | 'skip' | 'cancel'> => {
    return new Promise((resolve) => {
      duplicateResolverRef.current?.('cancel');
      duplicateResolverRef.current = resolve;
    });
  };

  const isDuplicateTitleError = (err: unknown): boolean => {
    if (!err || typeof err !== 'object') {
      return false;
    }
    const e = err as { errorCode?: unknown; msg?: unknown; fields?: Record<string, unknown> };
    return (
      e.errorCode === 'DUPLICATE_MAP_TITLE' ||
      (typeof e.fields?.['title'] === 'string' &&
        e.fields['title'].toLowerCase().includes('same name')) ||
      (typeof e.msg === 'string' && e.msg.toLowerCase().includes('same name'))
    );
  };

  const extractImportErrorMessage = (err: unknown): string => {
    if (err instanceof Error && err.message) {
      return err.message;
    }
    if (err && typeof err === 'object' && 'msg' in err && typeof err.msg === 'string' && err.msg) {
      return err.msg;
    }
    return '导入思维导图失败，请检查文件内容是否正确或网络是否畅通。';
  };

  const [importState, setImportState] = React.useState<{
    open: boolean;
    fileName: string;
    stage: ImportStage;
    error?: string | null | undefined;
    progress?: number | undefined;
    detailText?: string | undefined;
    createdMapId?: number | undefined;
    createdMapEditUrl?: string | undefined;
    isBatch?: boolean | undefined;
    totalCount?: number | undefined;
    currentCount?: number | undefined;
    currentPath?: string | undefined;
    successCount?: number | undefined;
    skippedCount?: number | undefined;
  }>({
    open: false,
    fileName: '',
    stage: 'reading',
  });

  // Interruptible critically-damped spring driving sidebar + header layout together.
  const springDrawerWidth = useSpringValue(
    desktopDrawerOpen ? DRAWER_WIDTH_EXPANDED : DRAWER_WIDTH_COLLAPSED,
    { response: 0.32, dampingRatio: 1.0 },
  );

  const handleMobileDrawerToggle = () => {
    setMobileDrawerOpen(!mobileDrawerOpen);
  };

  const handleDesktopDrawerToggle = () => {
    if (!desktopDrawerOpen) writeStorage('desktopDrawerOpen', 'true');
    else removeStorage('desktopDrawerOpen');
    setDesktopDrawerOpen(!desktopDrawerOpen);
  };

  const readFileContent = (file: File, extension: string): Promise<string | ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result ?? '');
      reader.onerror = () => reject(new Error(`读取本地文件失败: ${file.name}`));
      if (extension === 'xmind' || extension === 'mmap') {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  const executeBatchImport = async (scannedFiles: ScannedMapFile[]) => {
    if (scannedFiles.length === 0) {
      setImportState({
        open: true,
        fileName: '',
        stage: 'error',
        isBatch: false,
        error:
          '未在选定的文件或文件夹中发现支持的思维导图格式文件（支持 .wxml, .mm, .mmx, .xmind, .mmap, .opml）。',
      });
      return;
    }

    // Single flat file without folder path -> fast direct edit flow
    const single = scannedFiles[0];
    if (scannedFiles.length === 1 && single && !single.folderPath) {
      setImportState({
        open: true,
        fileName: single.file.name,
        stage: 'reading',
        progress: 15,
        detailText: '正在读取本地文件内容...',
        createdMapId: undefined,
        isBatch: false,
        error: null,
      });

      try {
        const fileContent = await readFileContent(single.file, single.extension);
        setImportState((prev) => ({
          ...prev,
          stage: 'parsing',
          progress: 40,
          detailText: '正在解析思维导图结构与图文素材...',
        }));

        const { default: TextImporterFactory } =
          await import('@wisemapping/mindplot/components/import/TextImporterFactory');
        const importer = TextImporterFactory.create(single.extension, fileContent);
        const importedXml = await importer.import(single.title, '');

        let shouldOverwrite = false;
        const existingMaps = await client.fetchAllMaps().catch(() => []);
        const hasDuplicate = existingMaps.some(
          (m) => (m.folderId ?? null) === activeFolderId && m.title === single.title,
        );
        if (hasDuplicate) {
          setImportState((prev) => ({
            ...prev,
            stage: 'duplicate',
            detailText: `当前列表中已存在同名导图《${single.title}》，要覆盖原导图还是跳过本次导入？`,
          }));
          const decision = await askDuplicateDecision();
          if (decision !== 'overwrite') {
            setImportState((prev) => ({ ...prev, open: false }));
            return;
          }
          shouldOverwrite = true;
        }

        setImportState((prev) => ({
          ...prev,
          stage: 'saving',
          progress: 55,
          detailText: '正在检测并准备外置图片...',
        }));

        const content = await externalizeXmlInlineImages(importedXml, client, (p) => {
          if (p.phase === 'converting') {
            const total = p.convertTotal ?? p.totalImages;
            const done = p.convertedCount ?? 0;
            const ratio = total > 0 ? done / total : 1;
            const progress = 55 + Math.round(ratio * 10);
            setImportState((prev) => ({
              ...prev,
              progress,
              detailText: `正在将大图无损感转码为 AVIF (${done}/${total} 张)...`,
            }));
          } else if (p.phase === 'signing') {
            setImportState((prev) => ({
              ...prev,
              progress: 66,
              detailText: `发现 ${p.totalImages} 张图片，正在向云端申请上传凭证...`,
            }));
          } else if (p.phase === 'uploading') {
            const ratio = p.uploadTotal > 0 ? p.uploadedCount / p.uploadTotal : 1;
            const progress = 68 + Math.round(ratio * 24);
            const detailText =
              p.reusedCount > 0
                ? `已秒传复用 ${p.reusedCount} 张，正在上传图片 (${p.uploadedCount}/${p.uploadTotal} 张)...`
                : `正在并发上传图片到图床 (${p.uploadedCount}/${p.uploadTotal} 张)...`;
            setImportState((prev) => ({
              ...prev,
              progress,
              detailText,
            }));
          } else if (p.phase === 'done') {
            setImportState((prev) => ({
              ...prev,
              progress: 93,
              detailText: '图片外置完成，正在保存导图到云端...',
            }));
          }
        });

        setImportState((prev) => ({
          ...prev,
          stage: 'saving',
          progress: 95,
          detailText: shouldOverwrite ? '正在覆盖原导图数据...' : '正在写入导图到云端数据库...',
        }));

        const contentType =
          single.extension === 'xmind' ? 'application/vnd.xmind.workbook' : 'application/xml';

        let mapId: number;
        try {
          mapId = await client.importMap({
            title: single.title,
            description: '',
            contentType,
            content,
            folderId: activeFolderId,
            folderPath: '',
            overwrite: shouldOverwrite,
          });
        } catch (err) {
          if (!shouldOverwrite && isDuplicateTitleError(err)) {
            setImportState((prev) => ({
              ...prev,
              stage: 'duplicate',
              detailText: `当前列表中已存在同名导图《${single.title}》，要覆盖原导图还是跳过本次导入？`,
            }));
            const decision = await askDuplicateDecision();
            if (decision !== 'overwrite') {
              setImportState((prev) => ({ ...prev, open: false }));
              void client.cleanupOrphanedAssets?.().catch(() => undefined);
              return;
            }
            setImportState((prev) => ({
              ...prev,
              stage: 'saving',
              progress: 97,
              detailText: '正在覆盖原导图数据...',
            }));
            mapId = await client.importMap({
              title: single.title,
              description: '',
              contentType,
              content,
              folderId: activeFolderId,
              folderPath: '',
              overwrite: true,
            });
          } else {
            throw err;
          }
        }

        void queryClient.invalidateQueries({ queryKey: ['maps'] });
        void queryClient.invalidateQueries({ queryKey: ['folders'] });
        const createdMeta = await client.fetchMapMetadata(mapId);

        setImportState((prev) => ({
          ...prev,
          stage: 'success',
          progress: 100,
          createdMapId: mapId,
          createdMapEditUrl: buildMapEditPath(createdMeta.folderPath, createdMeta.title),
          detailText: '导图已存入云端，你可以立即打开编辑或留在列表继续其他操作。',
        }));
      } catch (err) {
        console.error('Import failed', err);
        setImportState((prev) => ({
          ...prev,
          stage: 'error',
          error: extractImportErrorMessage(err),
        }));
      }
      return;
    }

    // Batch / Folder Import Flow
    const total = scannedFiles.length;
    const firstFile = scannedFiles[0]!;
    setImportState({
      open: true,
      fileName: firstFile.relativePath,
      stage: 'reading',
      progress: 5,
      detailText: '正在检查是否存在同名导图...',
      isBatch: true,
      totalCount: total,
      currentCount: 0,
      currentPath: firstFile.relativePath,
      successCount: 0,
      skippedCount: 0,
      error: null,
    });

    const baseFolderPath =
      activeFolderId !== null ? getFolderPathString(folders, activeFolderId) : '';
    const existingMaps = await client.fetchAllMaps().catch(() => []);
    const existingKeys = new Set(
      existingMaps.map((m) => `${(m.folderPath ?? '').trim()}::${m.title}`),
    );
    const targetFolderPathOf = (item: ScannedMapFile) =>
      `${baseFolderPath}${item.folderPath.trim()}`;
    const keyOf = (item: ScannedMapFile) => `${targetFolderPathOf(item)}::${item.title}`;
    const duplicateItems = scannedFiles.filter((item) => existingKeys.has(keyOf(item)));

    let overwriteDuplicates = false;
    let filesToImport = scannedFiles;
    let preSkippedCount = 0;

    if (duplicateItems.length > 0) {
      setImportState((prev) => ({
        ...prev,
        stage: 'duplicate',
        detailText: `发现 ${duplicateItems.length} 份同名导图（如《${duplicateItems[0]!.title}》），批量导入时要覆盖还是跳过？`,
      }));
      const decision = await askDuplicateDecision();
      if (decision === 'cancel') {
        setImportState((prev) => ({ ...prev, open: false }));
        return;
      }
      if (decision === 'overwrite') {
        overwriteDuplicates = true;
      } else {
        filesToImport = scannedFiles.filter((item) => !existingKeys.has(keyOf(item)));
        preSkippedCount = duplicateItems.length;
      }
    }

    if (filesToImport.length === 0) {
      setImportState((prev) => ({
        ...prev,
        stage: 'success',
        progress: 100,
        successCount: 0,
        skippedCount: preSkippedCount,
        currentPath: '',
      }));
      return;
    }

    const { default: TextImporterFactory } =
      await import('@wisemapping/mindplot/components/import/TextImporterFactory');

    let successCount = 0;
    let skippedCount = preSkippedCount;
    let processed = 0;
    const activeTotal = filesToImport.length;

    // Process files with bounded concurrency pool (up to 3 parallel workers)
    const concurrency = 3;
    let currentIndex = 0;

    const processNext = async (): Promise<void> => {
      while (currentIndex < filesToImport.length) {
        const idx = currentIndex++;
        const item = filesToImport[idx];
        if (!item) continue;
        setImportState((prev) => ({
          ...prev,
          totalCount: activeTotal,
          currentCount: processed + 1,
          currentPath: item.relativePath,
          stage: 'parsing',
          detailText: undefined,
          progress: Math.min(95, Math.round(((processed + 1) / activeTotal) * 90)),
        }));

        try {
          const fileContent = await readFileContent(item.file, item.extension);
          const importer = TextImporterFactory.create(item.extension, fileContent);
          const importedXml = await importer.import(item.title, '');
          const content = await externalizeXmlInlineImages(importedXml, client);
          const contentType =
            item.extension === 'xmind' ? 'application/vnd.xmind.workbook' : 'application/xml';

          const targetFolderPath = targetFolderPathOf(item);
          await client.importMap({
            title: item.title,
            description: '',
            contentType,
            content,
            ...(targetFolderPath === '' && activeFolderId !== null
              ? { folderId: activeFolderId }
              : {}),
            folderPath: targetFolderPath,
            overwrite: overwriteDuplicates && existingKeys.has(keyOf(item)),
          });
          successCount++;
        } catch (err) {
          console.warn(`Failed to import map "${item.relativePath}":`, err);
          skippedCount++;
        } finally {
          processed++;
          setImportState((prev) => ({
            ...prev,
            currentCount: processed,
            successCount,
            skippedCount,
            progress: Math.min(95, Math.round((processed / activeTotal) * 90)),
          }));
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, activeTotal) }, () => processNext());
    await Promise.all(workers);

    // Invalidate maps and folders cache so the fresh maps & folders immediately appear in the list
    queryClient.invalidateQueries({ queryKey: ['maps'] });
    queryClient.invalidateQueries({ queryKey: ['folders'] });

    setImportState((prev) => ({
      ...prev,
      stage: 'success',
      progress: 100,
      successCount,
      skippedCount,
      currentPath: '',
      detailText: undefined,
    }));
  };

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    // Snapshot the live FileList before clearing input.value, otherwise Chromium empties files in place.
    const snapshot = Array.from(files);
    event.target.value = '';
    const scanned = scanFileList(snapshot);
    executeBatchImport(scanned);
  };

  const isExternalFileDrag = (e: React.DragEvent): boolean => {
    const types = Array.from(e.dataTransfer?.types ?? []);
    return types.includes('Files') && !types.includes(MAP_IDS_DRAG_MIME);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (!isExternalFileDrag(e)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!isDraggingOver) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isExternalFileDrag(e)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (!isExternalFileDrag(e)) {
      dragCounter.current = 0;
      setIsDraggingOver(false);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDraggingOver(false);

    const fallbackFiles = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    let scanned: ScannedMapFile[] = [];
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      scanned = await scanDataTransferItems(e.dataTransfer.items);
    }
    if (scanned.length === 0 && fallbackFiles.length > 0) {
      scanned = scanFileList(fallbackFiles);
    }
    executeBatchImport(scanned);
  };
  const account = useFetchAccount();
  // Reload based on user preference ...
  const userLocale = AppI18n.getUserLocale(account?.locale);

  const intlLocale = useLocaleMessages(userLocale.code);
  // One per locale: a new one on every render re-ran the effects that depend on it.
  const intl = useMemo(
    () =>
      createIntl({
        locale: intlLocale.locale,
        defaultLocale: Locales.ZH.code,
        messages: intlLocale.messages,
      }),
    [intlLocale],
  );

  useEffect(() => {
    document.title = intl.formatMessage({
      id: 'maps.page-title',
      defaultMessage: 'My Maps | WiseMapping',
    });
  }, [intl]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const mutation = useMutation({
    mutationFn: (id: number) => client.deleteLabel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] });
      queryClient.invalidateQueries({ queryKey: ['maps'] });
    },
    onError: (error) => {
      console.error(`Unexpected error ${error}`);
    },
  });

  const handleMenuClick = (nextFilter: Filter) => {
    if (!(nextFilter.type === 'folder' && filter.type === 'folder')) {
      queryClient.invalidateQueries({ queryKey: ['maps'] });
    }
    if (nextFilter.type === 'all') {
      writeStorage(MAPS_MAIN_TAB_STORAGE_KEY, 'all');
    } else if (nextFilter.type === 'folder') {
      writeStorage(MAPS_MAIN_TAB_STORAGE_KEY, 'folders');
    }
    setFilter(nextFilter);
    if (mobileDrawerOpen) {
      setMobileDrawerOpen(false);
    }
  };

  const handleLabelDelete = (id: number) => {
    mutation.mutate(id);
  };

  const { data: foldersData } = useQuery<unknown, ErrorInfo, Folder[]>({
    queryKey: ['folders'],
    queryFn: () => (client.fetchFolders ? client.fetchFolders() : Promise.resolve([])),
  });
  const folders: Folder[] = foldersData ?? [];
  const activeFolderId = filter.type === 'folder' ? filter.folderId : null;

  const moveMapsDropMutation = useMutation<
    void,
    unknown,
    { mapIds: number[]; folderId: number | null }
  >({
    mutationFn: ({ mapIds, folderId }) => {
      if (!client.moveMapsToFolder) {
        return Promise.reject(new Error('不支持移动文件夹'));
      }
      return client.moveMapsToFolder(mapIds, folderId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['maps'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      const targetName =
        variables.folderId === null
          ? '根目录（未分类）'
          : (folders.find((f) => f.id === variables.folderId)?.name ?? '文件夹');
      setToast({
        open: true,
        severity: 'success',
        message: `已将 ${variables.mapIds.length} 份导图移动到“${targetName}”`,
      });
    },
    onError: (err) => {
      const msg =
        err && typeof err === 'object' && 'msg' in err && typeof err.msg === 'string' && err.msg
          ? err.msg
          : '移动导图失败，请稍后重试。';
      setToast({ open: true, severity: 'error', message: msg });
    },
  });

  const { data } = useQuery<unknown, ErrorInfo, Label[]>({
    queryKey: ['labels'],
    queryFn: () => client.fetchLabels(),
  });

  const labels: Label[] = data ? data : [];
  const filterButtons: ToolbarButtonInfo[] = [
    {
      filter: { type: 'all' },
      label: intl.formatMessage({ id: 'maps.nav-all', defaultMessage: 'All' }),
      icon: <GridViewRoundedIcon />,
    },
    {
      filter: { type: 'starred' },
      label: intl.formatMessage({ id: 'maps.nav-starred', defaultMessage: 'Starred' }),
      icon: <StarRoundedIcon />,
    },
  ];

  labels.forEach((l) =>
    filterButtons.push({
      filter: { type: 'label', label: l },
      label: l.title,
      icon: <LabelRoundedIcon sx={{ color: l.color ? l.color : 'inherit' }} />,
    }),
  );

  const renderDrawerItems = (includeDesktopToggle: boolean) => (
    <DrawerNav
      account={account}
      drawerOpen={includeDesktopToggle ? desktopDrawerOpen : true}
      filterButtons={filterButtons}
      activeFilter={filter}
      onFilterClick={handleMenuClick}
      onLabelDelete={setLabelToDelete}
      onToggleDesktopDrawer={includeDesktopToggle ? handleDesktopDrawerToggle : undefined}
      userMenu={
        <AccountMenu
          variant="sidebar"
          drawerOpen={includeDesktopToggle ? desktopDrawerOpen : true}
        />
      }
    />
  );

  const toolbarActions = (
    <Tooltip
      arrow={true}
      title={intl.formatMessage({
        id: 'maps.create-tooltip',
        defaultMessage: '新建导图、文件夹或导入',
      })}
    >
      <PrimaryToolbarButton
        color="primary"
        data-testid="create"
        size="medium"
        variant="contained"
        type="button"
        disableElevation={true}
        aria-haspopup="menu"
        aria-expanded={Boolean(createMenuAnchor)}
        startIcon={<AddCircleRoundedIcon />}
        endIcon={
          <KeyboardArrowDownRoundedIcon
            sx={{
              fontSize: 18,
              ml: -0.5,
              opacity: 0.85,
              transition: 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)',
              transform: createMenuAnchor ? 'rotate(180deg)' : 'none',
              '@media (prefers-reduced-motion: reduce)': {
                transition: 'none',
              },
            }}
          />
        }
        onClick={(e) => setCreateMenuAnchor(e.currentTarget)}
      >
        <span className="message">
          <FormattedMessage id="action.create-unified" defaultMessage="新建" />
        </span>
      </PrimaryToolbarButton>
    </Tooltip>
  );

  const container = document !== undefined ? () => document.body : undefined;
  const label: Label | undefined = labels.find((l) => l.id === labelToDelete);
  return (
    <IntlProvider
      locale={intlLocale.locale}
      defaultLocale={Locales.ZH.code}
      messages={intlLocale.messages}
    >
      <PageRoot
        style={{ '--drawer-width': `${springDrawerWidth.toFixed(1)}px` } as React.CSSProperties}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDraggingOver && (
          <Box
            sx={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(16px)',
              background: 'rgba(0, 0, 0, 0.28)',
              pointerEvents: 'none',
            }}
          >
            <Box
              sx={(theme) => {
                const c = appleColors(isDarkTheme(theme));
                return {
                  p: 4,
                  borderRadius: '24px',
                  textAlign: 'center',
                  border: `1px solid ${c.hairline}`,
                  boxShadow: c.shadowFloat,
                  ...glassMaterialMixin(c.sidebarGlass, c.surfaceElevated, 24),
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1.5,
                };
              }}
            >
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: '18px',
                  background: 'linear-gradient(135deg, #FFB340 0%, #F59E0B 100%)',
                  color: '#FFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FolderRoundedIcon sx={{ fontSize: 36 }} />
              </Box>
              <Typography
                variant="h6"
                sx={(theme) => ({
                  fontWeight: 700,
                  color: appleColors(isDarkTheme(theme)).textPrimary,
                })}
              >
                松开鼠标即可导入文件夹或文件
              </Typography>
              <Typography
                variant="body2"
                sx={(theme) => ({
                  color: appleColors(isDarkTheme(theme)).textSecondary,
                  maxWidth: 360,
                })}
              >
                自动递归读取子目录，保留文件夹层级并在列表中归类展示
              </Typography>
            </Box>
          </Box>
        )}
        <Menu
          id="create-action-menu"
          anchorEl={createMenuAnchor}
          open={Boolean(createMenuAnchor)}
          onClose={() => setCreateMenuAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{
            paper: {
              elevation: 0,
              sx: (theme) => {
                const c = appleColors(isDarkTheme(theme));
                return {
                  mt: 0.75,
                  borderRadius: '14px',
                  minWidth: 204,
                  p: 0.6,
                  color: c.textPrimary,
                  boxShadow: c.shadowFloat,
                  border: `1px solid ${c.hairline}`,
                  fontFamily: APPLE_FONT_STACK,
                  ...glassMaterialMixin(c.sidebarGlass, c.surfaceElevated, 24),
                  '@media (forced-colors: active)': {
                    backgroundColor: 'Canvas',
                    color: 'CanvasText',
                    borderColor: 'ButtonBorder',
                  },
                  '& .MuiMenuItem-root': {
                    borderRadius: '8px',
                    py: 1,
                    px: 1.25,
                    gap: 1.25,
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    transition: 'background-color 120ms ease',
                    '&:hover': {
                      backgroundColor: c.hoverFill,
                    },
                  },
                };
              },
            },
          }}
        >
          <MenuItem
            data-testid="menu-create-map"
            onClick={() => {
              setCreateMenuAnchor(null);
              setActiveDialog('create');
            }}
          >
            <ListItemIcon sx={{ minWidth: 26, color: (theme) => appleColors(isDarkTheme(theme)).amber }}>
              <AddCircleRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={<FormattedMessage id="action.new" defaultMessage="新建思维导图" />}
              slotProps={{
                primary: {
                  sx: { fontSize: '0.86rem', fontWeight: 600, fontFamily: APPLE_FONT_STACK },
                },
              }}
            />
          </MenuItem>

          <MenuItem
            data-testid="menu-create-folder"
            onClick={() => {
              setCreateMenuAnchor(null);
              setFolderDialog({ mode: 'create', parentId: activeFolderId });
            }}
          >
            <ListItemIcon sx={{ minWidth: 26, color: 'text.secondary' }}>
              <CreateNewFolderRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={<FormattedMessage id="folder.new" defaultMessage="新建文件夹" />}
              slotProps={{
                primary: {
                  sx: { fontSize: '0.86rem', fontWeight: 600, fontFamily: APPLE_FONT_STACK },
                },
              }}
            />
          </MenuItem>

          <Divider sx={{ my: 0.6, borderColor: (theme) => appleColors(isDarkTheme(theme)).hairline }} />

          <MenuItem
            data-testid="menu-import-file"
            onClick={() => {
              setCreateMenuAnchor(null);
              fileInputRef.current?.click();
            }}
          >
            <ListItemIcon sx={{ minWidth: 26, color: 'text.secondary' }}>
              <InsertDriveFileRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="导入文件"
              slotProps={{
                primary: {
                  sx: { fontSize: '0.86rem', fontWeight: 500, fontFamily: APPLE_FONT_STACK },
                },
              }}
            />
          </MenuItem>

          <MenuItem
            data-testid="menu-import-folder"
            onClick={() => {
              setCreateMenuAnchor(null);
              folderInputRef.current?.click();
            }}
          >
            <ListItemIcon sx={{ minWidth: 26, color: 'text.secondary' }}>
              <FolderRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="导入文件夹"
              slotProps={{
                primary: {
                  sx: { fontSize: '0.86rem', fontWeight: 500, fontFamily: APPLE_FONT_STACK },
                },
              }}
            />
          </MenuItem>
        </Menu>
        <input
          type="file"
          ref={fileInputRef}
          accept=".wxml,.mm,.mmx,.xmind,.mmap,.opml"
          multiple
          style={{ display: 'none' }}
          onChange={handleFilesSelected}
        />
        <input
          type="file"
          ref={folderInputRef}
          {...({
            webkitdirectory: '',
            directory: '',
          } as React.InputHTMLAttributes<HTMLInputElement> & {
            webkitdirectory?: string;
            directory?: string;
          })}
          multiple
          style={{ display: 'none' }}
          onChange={handleFilesSelected}
        />
        <ActionDispatcher
          action={activeDialog}
          folderId={activeFolderId}
          onClose={() => setActiveDialog(undefined)}
          mapsId={[]}
        />
        <MobileDrawer
          expanded={desktopDrawerOpen}
          container={container}
          variant={'temporary'}
          open={mobileDrawerOpen}
          onClose={handleMobileDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
        >
          {renderDrawerItems(false)}
        </MobileDrawer>
        <DesktopDrawer variant="permanent" expanded={desktopDrawerOpen}>
          {renderDrawerItems(true)}
        </DesktopDrawer>
        <PageContent role="main">
          <WorkspaceTopBar>
            <MobileDrawerToggle
              aria-label={intl.formatMessage({
                id: 'common.open-drawer',
                defaultMessage: 'Open drawer',
              })}
              edge="start"
              onClick={handleMobileDrawerToggle}
              id="open-main-drawer"
            >
              <MenuRoundedIcon />
            </MobileDrawerToggle>
          </WorkspaceTopBar>
          <section
            aria-label={intl.formatMessage({ id: 'common.maps-list', defaultMessage: 'Maps list' })}
          >
            <MapsList
              filter={filter}
              folders={folders}
              onFilterChange={handleMenuClick}
              onCreateFolder={(parentId) => setFolderDialog({ mode: 'create', parentId })}
              onRenameFolder={(folder) => setFolderDialog({ mode: 'rename', folder })}
              onMoveFolder={(folder) => setFolderDialog({ mode: 'move', folder })}
              onDeleteFolder={(folder) => setFolderDialog({ mode: 'delete', folder })}
              onDropMapsToFolder={(mapIds, folderId) =>
                moveMapsDropMutation.mutate({ mapIds, folderId })
              }
              toolbarActions={toolbarActions}
            />
          </section>
        </PageContent>
      </PageRoot>
      {folderDialog?.mode === 'create' && (
        <FolderCreateDialog
          parentId={folderDialog.parentId}
          parentName={
            folderDialog.parentId !== null
              ? folders.find((f) => f.id === folderDialog.parentId)?.name
              : undefined
          }
          onClose={() => setFolderDialog(undefined)}
          onCreated={(created) => {
            if (filter.type !== 'folder') {
              handleMenuClick({ type: 'folder', folderId: created.parentId ?? null });
            }
          }}
        />
      )}
      {folderDialog?.mode === 'rename' && (
        <FolderRenameDialog
          folder={folderDialog.folder}
          onClose={() => setFolderDialog(undefined)}
        />
      )}
      {folderDialog?.mode === 'move' && (
        <FolderMoveDialog
          folder={folderDialog.folder}
          folders={folders}
          onClose={() => setFolderDialog(undefined)}
          onMoved={(moved) => {
            setToast({
              open: true,
              severity: 'success',
              message: `已调整文件夹“${moved.name}”的位置`,
            });
          }}
        />
      )}
      {folderDialog?.mode === 'delete' && (
        <FolderDeleteDialog
          folder={folderDialog.folder}
          onClose={() => setFolderDialog(undefined)}
          onDeleted={(deletedId) => {
            if (filter.type === 'folder' && filter.folderId === deletedId) {
              const deletedFolder = folders.find((f) => f.id === deletedId);
              setFilter({ type: 'folder', folderId: deletedFolder?.parentId ?? null });
            }
          }}
        />
      )}
      <Snackbar
        open={toast.open}
        autoHideDuration={3200}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          sx={{ borderRadius: '12px', fontWeight: 600 }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
      {label && labelToDelete !== undefined && (
        <LabelDeleteConfirm
          onClose={() => setLabelToDelete(undefined)}
          onConfirm={() => {
            handleLabelDelete(labelToDelete);
            setLabelToDelete(undefined);
          }}
          label={label}
        />
      )}
      <ImportProgressDialog
        open={importState.open}
        fileName={importState.fileName}
        stage={importState.stage}
        error={importState.error}
        progressPercent={importState.progress}
        detailText={importState.detailText}
        isBatch={importState.isBatch}
        totalCount={importState.totalCount}
        currentCount={importState.currentCount}
        currentPath={importState.currentPath}
        successCount={importState.successCount}
        skippedCount={importState.skippedCount}
        onClose={() => {
          resolveDuplicateDecision('cancel');
          setImportState((prev) => ({ ...prev, open: false }));
        }}
        onOverwrite={() => resolveDuplicateDecision('overwrite')}
        onSkipDuplicate={() => resolveDuplicateDecision('skip')}
        onOpenMap={
          importState.createdMapEditUrl
            ? () => {
                window.location.href = importState.createdMapEditUrl!;
              }
            : undefined
        }
        onImportMore={() => {
          setImportState((prev) => ({ ...prev, open: false }));
          fileInputRef.current?.click();
        }}
        onRetry={() => {
          setImportState((prev) => ({ ...prev, open: false }));
          fileInputRef.current?.click();
        }}
      />
    </IntlProvider>
  );
};

export default MapsPage;
