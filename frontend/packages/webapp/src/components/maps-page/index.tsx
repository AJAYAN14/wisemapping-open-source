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
import Toolbar from '@mui/material/Toolbar';
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
import LabelRoundedIcon from '@mui/icons-material/LabelRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import StarRateRoundedIcon from '@mui/icons-material/StarRateRounded';
import Tooltip from '@mui/material/Tooltip';

import LabelDeleteConfirm from './maps-list/label-delete-confirm';
import DrawerNav, { ToolbarButtonInfo } from './drawer-nav';
import { ClientContext } from '../../classes/provider/client-context';
import { readStorage, writeStorage, removeStorage } from '../../utils/storage';
import { useSpringValue } from './useSpringValue';

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

  const handleImportButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleDirectFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input so re-selecting the same file fires change event
    event.target.value = '';

    const extensionFile = file.name.split('.').pop()?.toLowerCase();
    const extensionAccept = ['wxml', 'mm', 'mmx', 'xmind', 'mmap', 'opml'];
    if (!extensionFile || !extensionAccept.includes(extensionFile)) {
      alert(
        '不支持的文件格式。支持导入 WiseMapping (.wxml)、FreeMind (.mm)、Freeplane (.mmx)、XMind (.xmind)、MindManager (.mmap) 和 OPML (.opml) 文件。',
      );
      return;
    }

    // Name is automatically the file name without extension
    const title = file.name.replace(/\.[^.]*$/, '');
    const contentType =
      extensionFile === 'xmind' ? 'application/vnd.xmind.workbook' : 'application/xml';

    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      try {
        const fileContent = loadEvent.target?.result ?? '';
        const { default: TextImporterFactory } = await import(
          '@wisemapping/mindplot/components/import/TextImporterFactory'
        );
        const importer = TextImporterFactory.create(extensionFile, fileContent);
        const content = await importer.import(title, '');
        const mapId = await client.importMap({ title, description: '', contentType, content });
        window.location.href = `/c/maps/${mapId}/edit`;
      } catch (err) {
        console.error('Import failed', err);
        alert(err instanceof Error ? err.message : '导入思维导图失败，请检查文件内容是否正确。');
      }
    };

    if (extensionFile === 'xmind' || extensionFile === 'mmap') {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
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
      >
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
                onClick={handleImportButtonClick}
              >
                <span className="message">
                  <FormattedMessage id="action.import" defaultMessage="Import" />
                </span>
              </SecondaryToolbarButton>
            </Tooltip>
            <input
              type="file"
              ref={fileInputRef}
              accept=".wxml,.mm,.mmx,.xmind,.mmap,.opml"
              style={{ display: 'none' }}
              onChange={handleDirectFileImport}
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
    </IntlProvider>
  );
};

export default MapsPage;
