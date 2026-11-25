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
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Snackbar from '@mui/material/Snackbar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import {
  DesktopDrawer,
  DesktopDrawerToggle,
  DRAWER_WIDTH_COLLAPSED,
  DRAWER_WIDTH_EXPANDED,
  MobileDrawer,
  MobileDrawerToggle,
  PageAppBar,
  PageContent,
  PageRoot,
  PrimaryToolbarButton,
  RightButtonGroup,
  SecondaryToolbarButton,
  ToolbarSpacer,
} from './styled';
import { MapsList } from './maps-list';
import { ImportProgressDialog, ImportStage } from './import-progress';
import { createIntl, FormattedMessage, IntlProvider } from 'react-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Folder, Label, MapInfo } from '../../classes/client';
import ActionDispatcher from './action-dispatcher';
import { ActionType } from './action-chooser';
import AccountMenu from './account-menu';
import ThemeToggleButton from '../common/theme-toggle-button';
import AppI18n, { Locales } from '../../classes/app-i18n';
import { externalizeXmlInlineImages } from '../../utils/mapAssets';
import { useLocaleMessages } from '../../classes/app-i18n/messages';
import { useFetchAccount } from '../../classes/middleware';

import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import NavigateBeforeRoundedIcon from '@mui/icons-material/NavigateBeforeRounded';

import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import LabelRoundedIcon from '@mui/icons-material/LabelRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import StarRateRoundedIcon from '@mui/icons-material/StarRateRounded';
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
import { useSpringValue } from './useSpringValue';
import { ClientContext } from '../../classes/provider/client-context';
import { ScannedMapFile, scanFileList, scanDataTransferItems } from './directoryScanner';
import { readStorage, writeStorage, removeStorage } from '../../utils/storage';

export type Filter = GenericFilter | LabelFilter | FolderFilter;

export interface GenericFilter {
  type: 'public' | 'all' | 'starred' | 'uncategorized' | 'shared' | 'label' | 'owned';
}

export interface LabelFilter {
  type: 'label';
  label: Label;
}

export interface FolderFilter {
  type: 'folder';
  folderId: number;
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

const MapsPage = (): ReactElement => {
  const [filter, setFilter] = React.useState<Filter>({ type: 'all' });
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
  const [importMenuAnchor, setImportMenuAnchor] = React.useState<null | HTMLElement>(null);
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
      (typeof e.fields?.title === 'string' && e.fields.title.toLowerCase().includes('same name')) ||
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
    error?: string | null;
    progress?: number;
    detailText?: string;
    createdMapId?: number;
    isBatch?: boolean;
    totalCount?: number;
    currentCount?: number;
    currentPath?: string;
    successCount?: number;
    skippedCount?: number;
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
    if (scannedFiles.length === 1 && !scannedFiles[0].folderPath) {
      const single = scannedFiles[0];
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

        const { default: TextImporterFactory } = await import(
          '@wisemapping/mindplot/components/import/TextImporterFactory'
        );
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
          if (p.phase === 'signing') {
            setImportState((prev) => ({
              ...prev,
              progress: 58,
              detailText: `发现 ${p.totalImages} 张图片，正在向云端申请上传凭证...`,
            }));
          } else if (p.phase === 'uploading') {
            const ratio = p.uploadTotal > 0 ? p.uploadedCount / p.uploadTotal : 1;
            const progress = 62 + Math.round(ratio * 30);
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

        setImportState((prev) => ({
          ...prev,
          stage: 'success',
          progress: 100,
          createdMapId: mapId,
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
    setImportState({
      open: true,
      fileName: scannedFiles[0].relativePath,
      stage: 'reading',
      progress: 5,
      detailText: '正在检查是否存在同名导图...',
      isBatch: true,
      totalCount: total,
      currentCount: 0,
      currentPath: scannedFiles[0].relativePath,
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

    const { default: TextImporterFactory } = await import(
      '@wisemapping/mindplot/components/import/TextImporterFactory'
    );

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
    queryClient.invalidateQueries({ queryKey: ['maps'] });
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

  const { data: mapsData } = useQuery<unknown, ErrorInfo, MapInfo[]>({
    queryKey: ['maps'],
    queryFn: () => client.fetchAllMaps(),
  });
  const { folderCounts, uncategorizedCount } = useMemo(() => {
    const counts = new Map<number, number>();
    let uncat = 0;
    for (const m of mapsData ?? []) {
      const fid = m.folderId ?? null;
      if (fid === null) {
        uncat += 1;
      } else {
        counts.set(fid, (counts.get(fid) ?? 0) + 1);
      }
    }
    return { folderCounts: counts, uncategorizedCount: uncat };
  }, [mapsData]);

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
      icon: <StarRateRoundedIcon />,
    },
    {
      filter: { type: 'uncategorized' },
      label: intl.formatMessage({ id: 'maps.nav-uncategorized', defaultMessage: '未分类' }),
      icon: <InboxRoundedIcon />,
      count: uncategorizedCount,
      acceptDropToRoot: true,
    },
  ];

  labels.forEach((l) =>
    filterButtons.push({
      filter: { type: 'label', label: l },
      label: l.title,
      icon: <LabelRoundedIcon sx={{ color: l.color ? l.color : 'inherit' }} />,
    }),
  );

  const drawerItemsList = (
    <DrawerNav
      account={account}
      drawerOpen={desktopDrawerOpen || mobileDrawerOpen}
      filterButtons={filterButtons}
      folders={folders}
      folderCounts={folderCounts}
      activeFilter={filter}
      onFilterClick={handleMenuClick}
      onLabelDelete={setLabelToDelete}
      onCreateFolder={(parentId) => setFolderDialog({ mode: 'create', parentId })}
      onRenameFolder={(folder) => setFolderDialog({ mode: 'rename', folder })}
      onMoveFolder={(folder) => setFolderDialog({ mode: 'move', folder })}
      onDeleteFolder={(folder) => setFolderDialog({ mode: 'delete', folder })}
      onDropMapsToFolder={(mapIds, folderId) => moveMapsDropMutation.mutate({ mapIds, folderId })}
    />
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
              sx={{
                p: 4,
                borderRadius: '24px',
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.92)',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1.5,
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
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1D1D1F' }}>
                松开鼠标即可导入文件夹或文件
              </Typography>
              <Typography variant="body2" sx={{ color: '#86868B', maxWidth: 360 }}>
                自动递归读取子目录，保留文件夹层级并在列表中归类展示
              </Typography>
            </Box>
          </Box>
        )}
        <PageAppBar position="fixed" expanded={desktopDrawerOpen} variant="outlined" elevation={0}>
          <Toolbar role="banner">
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
            <DesktopDrawerToggle
              aria-label={intl.formatMessage({
                id: 'common.open-drawer',
                defaultMessage: 'Open drawer',
              })}
              edge="start"
              onClick={handleDesktopDrawerToggle}
              id="open-desktop-drawer"
            >
              {!desktopDrawerOpen && <NavigateNextRoundedIcon />}
              {desktopDrawerOpen && <NavigateBeforeRoundedIcon />}
            </DesktopDrawerToggle>
            <Tooltip
              arrow={true}
              title={intl.formatMessage({
                id: 'maps.create-tooltip',
                defaultMessage: 'Create a new mindmap',
              })}
            >
              <PrimaryToolbarButton
                color="primary"
                data-testid="create"
                size="medium"
                variant="contained"
                type="button"
                disableElevation={true}
                startIcon={<AddCircleRoundedIcon />}
                onClick={() => setActiveDialog('create')}
              >
                <span className="message">
                  <FormattedMessage id="action.new" defaultMessage="New map" />
                </span>
              </PrimaryToolbarButton>
            </Tooltip>

            <Tooltip
              arrow={true}
              title={intl.formatMessage({
                id: 'maps.import-desc',
                defaultMessage: 'Import from other tools',
              })}
            >
              <SecondaryToolbarButton
                size="medium"
                variant="text"
                type="button"
                disableElevation={true}
                startIcon={<CloudUploadRoundedIcon />}
                endIcon={<KeyboardArrowDownRoundedIcon sx={{ fontSize: 18, ml: -0.5, opacity: 0.7 }} />}
                onClick={(e) => setImportMenuAnchor(e.currentTarget)}
              >
                <span className="message">
                  <FormattedMessage id="action.import" defaultMessage="Import" />
                </span>
              </SecondaryToolbarButton>
            </Tooltip>
            <Menu
              anchorEl={importMenuAnchor}
              open={Boolean(importMenuAnchor)}
              onClose={() => setImportMenuAnchor(null)}
              slotProps={{
                paper: {
                  elevation: 0,
                  sx: {
                    borderRadius: '14px',
                    minWidth: 190,
                    p: 0.6,
                    background: 'rgba(255, 255, 255, 0.88)',
                    backdropFilter: 'blur(24px)',
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.15)',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                  },
                },
              }}
            >
              <MenuItem
                onClick={() => {
                  setImportMenuAnchor(null);
                  fileInputRef.current?.click();
                }}
                sx={{ borderRadius: '8px', py: 1, gap: 1.2 }}
              >
                <ListItemIcon sx={{ minWidth: 26, color: 'text.primary' }}>
                  <InsertDriveFileRoundedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="导入文件"
                  primaryTypographyProps={{ fontSize: '13.5px', fontWeight: 500 }}
                />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setImportMenuAnchor(null);
                  folderInputRef.current?.click();
                }}
                sx={{ borderRadius: '8px', py: 1, gap: 1.2 }}
              >
                <ListItemIcon sx={{ minWidth: 26, color: 'text.primary' }}>
                  <FolderRoundedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="导入文件夹 (含子目录)"
                  primaryTypographyProps={{ fontSize: '13.5px', fontWeight: 500 }}
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
              {...({ webkitdirectory: '', directory: '' } as any)}
              multiple
              style={{ display: 'none' }}
              onChange={handleFilesSelected}
            />
            <ActionDispatcher
              action={activeDialog}
              folderId={activeFolderId}
              onClose={() => setActiveDialog(undefined)}
              mapsId={[]}
              fromEditor
            />

            <RightButtonGroup>
              <ThemeToggleButton />
              <AccountMenu />
            </RightButtonGroup>
          </Toolbar>
        </PageAppBar>
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
          {drawerItemsList}
        </MobileDrawer>
        <DesktopDrawer variant="permanent" expanded={desktopDrawerOpen}>
          {drawerItemsList}
        </DesktopDrawer>
        <PageContent role="main">
          <ToolbarSpacer />
          <section
            aria-label={intl.formatMessage({ id: 'common.maps-list', defaultMessage: 'Maps list' })}
          >
            <MapsList filter={filter} folders={folders} onFilterChange={handleMenuClick} />
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
            if (folderDialog.parentId === null) {
              setFilter({ type: 'folder', folderId: created.id });
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
              setFilter({ type: 'all' });
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
          importState.createdMapId
            ? () => {
                window.location.href = `/c/maps/${importState.createdMapId}/edit`;
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
