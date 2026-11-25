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
import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
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
import { Label } from '../../classes/client';
import ActionDispatcher from './action-dispatcher';
import { ActionType } from './action-chooser';
import AccountMenu from './account-menu';
import ThemeToggleButton from '../common/theme-toggle-button';
import AppI18n, { Locales } from '../../classes/app-i18n';
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
import StarRateRoundedIcon from '@mui/icons-material/StarRateRounded';
import Tooltip from '@mui/material/Tooltip';

import LabelDeleteConfirm from './maps-list/label-delete-confirm';
import DrawerNav, { ToolbarButtonInfo } from './drawer-nav';
import { useSpringValue } from './useSpringValue';
import { ClientContext } from '../../classes/provider/client-context';
import { ScannedMapFile, scanFileList, scanDataTransferItems } from './directoryScanner';
import { readStorage, writeStorage, removeStorage } from '../../utils/storage';

export type Filter = GenericFilter | LabelFilter;

export interface GenericFilter {
  type: 'public' | 'all' | 'starred' | 'shared' | 'label' | 'owned';
}

export interface LabelFilter {
  type: 'label';
  label: Label;
}

const MapsPage = (): ReactElement => {
  const [filter, setFilter] = React.useState<Filter>({ type: 'all' });
  const client = use(ClientContext);
  const queryClient = useQueryClient();
  const [activeDialog, setActiveDialog] = React.useState<ActionType | undefined>(undefined);
  const [labelToDelete, setLabelToDelete] = React.useState<number>();
  const [mobileDrawerOpen, setMobileDrawerOpen] = React.useState(false);
  const [desktopDrawerOpen, setDesktopDrawerOpen] = React.useState(
    () => readStorage('desktopDrawerOpen') === 'true',
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const folderInputRef = React.useRef<HTMLInputElement>(null);
  const [importMenuAnchor, setImportMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);
  const dragCounter = React.useRef(0);

  const [importState, setImportState] = React.useState<{
    open: boolean;
    fileName: string;
    stage: ImportStage;
    error?: string | null;
    progress?: number;
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
        progress: 25,
        isBatch: false,
        error: null,
      });

      try {
        const fileContent = await readFileContent(single.file, single.extension);
        setImportState((prev) => ({
          ...prev,
          stage: 'parsing',
          progress: 55,
        }));

        const { default: TextImporterFactory } = await import(
          '@wisemapping/mindplot/components/import/TextImporterFactory'
        );
        const importer = TextImporterFactory.create(single.extension, fileContent);
        const content = await importer.import(single.title, '');

        setImportState((prev) => ({
          ...prev,
          stage: 'saving',
          progress: 85,
        }));

        const contentType =
          single.extension === 'xmind' ? 'application/vnd.xmind.workbook' : 'application/xml';
        const mapId = await client.importMap({
          title: single.title,
          description: '',
          contentType,
          content,
          folderPath: '',
        });

        setImportState((prev) => ({
          ...prev,
          stage: 'success',
          progress: 100,
        }));

        setTimeout(() => {
          window.location.href = `/c/maps/${mapId}/edit`;
        }, 500);
      } catch (err) {
        console.error('Import failed', err);
        setImportState((prev) => ({
          ...prev,
          stage: 'error',
          error:
            err instanceof Error
              ? err.message
              : '导入思维导图失败，请检查文件内容是否正确或网络是否畅通。',
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
      isBatch: true,
      totalCount: total,
      currentCount: 0,
      currentPath: scannedFiles[0].relativePath,
      successCount: 0,
      skippedCount: 0,
      error: null,
    });

    const { default: TextImporterFactory } = await import(
      '@wisemapping/mindplot/components/import/TextImporterFactory'
    );

    let successCount = 0;
    let skippedCount = 0;
    let processed = 0;

    // Process files with bounded concurrency pool (up to 3 parallel workers)
    const concurrency = 3;
    let currentIndex = 0;

    const processNext = async (): Promise<void> => {
      while (currentIndex < scannedFiles.length) {
        const idx = currentIndex++;
        const item = scannedFiles[idx];
        setImportState((prev) => ({
          ...prev,
          currentCount: processed + 1,
          currentPath: item.relativePath,
          stage: 'parsing',
          progress: Math.min(95, Math.round(((processed + 1) / total) * 90)),
        }));

        try {
          const fileContent = await readFileContent(item.file, item.extension);
          const importer = TextImporterFactory.create(item.extension, fileContent);
          const content = await importer.import(item.title, '');
          const contentType =
            item.extension === 'xmind' ? 'application/vnd.xmind.workbook' : 'application/xml';

          await client.importMap({
            title: item.title,
            description: '',
            contentType,
            content,
            folderPath: item.folderPath,
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
            progress: Math.min(95, Math.round((processed / total) * 90)),
          }));
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, total) }, () => processNext());
    await Promise.all(workers);

    // Invalidate maps cache so the fresh maps immediately appear in the list
    queryClient.invalidateQueries({ queryKey: ['maps'] });

    setImportState((prev) => ({
      ...prev,
      stage: 'success',
      progress: 100,
      successCount,
      skippedCount,
      currentPath: '',
    }));
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    event.target.value = '';
    const scanned = scanFileList(files);
    executeBatchImport(scanned);
  };

  const handleFolderInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    event.target.value = '';
    const scanned = scanFileList(files);
    executeBatchImport(scanned);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDraggingOver(false);

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const scanned = await scanDataTransferItems(e.dataTransfer.items);
      executeBatchImport(scanned);
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const scanned = scanFileList(e.dataTransfer.files);
      executeBatchImport(scanned);
    }
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
      activeFilter={filter}
      onFilterClick={handleMenuClick}
      onLabelDelete={setLabelToDelete}
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
              PaperProps={{
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
              onChange={handleFileInputChange}
            />
            <input
              type="file"
              ref={folderInputRef}
              {...({ webkitdirectory: '', directory: '' } as any)}
              multiple
              style={{ display: 'none' }}
              onChange={handleFolderInputChange}
            />
            <ActionDispatcher
              action={activeDialog}
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
            <MapsList filter={filter} />
          </section>
        </PageContent>
      </PageRoot>
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
        isBatch={importState.isBatch}
        totalCount={importState.totalCount}
        currentCount={importState.currentCount}
        currentPath={importState.currentPath}
        successCount={importState.successCount}
        skippedCount={importState.skippedCount}
        onClose={() => setImportState((prev) => ({ ...prev, open: false }))}
        onRetry={() => {
          setImportState((prev) => ({ ...prev, open: false }));
          fileInputRef.current?.click();
        }}
      />
    </IntlProvider>
  );
};

export default MapsPage;
