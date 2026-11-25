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
import React, { useCallback, use, useEffect, useMemo, useState, Suspense, useRef } from 'react';
import Editor, { useEditor, EditorLoadingSkeleton } from '@wisemapping/editor';
import type { EditorOptions } from '@wisemapping/editor';

import {
  PersistenceManager,
  RESTPersistenceManager,
  LocalStorageManager,
  MockPersistenceManager,
} from '@wisemapping/editor';
import type { PersistenceError, MapInfo } from '@wisemapping/editor';
import type { EditorRenderMode } from '@wisemapping/mindplot';
import { IntlProvider } from 'react-intl';
import AppI18n, { Locales } from '../../classes/app-i18n';
import { useLocaleMessages } from '../../classes/app-i18n/messages';
import { useFetchAccount } from '../../classes/middleware';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import MapInfoImpl from '../../classes/editor-map-info';
import AppConfig from '../../classes/app-config';
import exampleMap from '../../classes/client/mock-client/example-map.wxml';
import JwtTokenConfig from '../../classes/jwt-token-config';
import { useLoaderData, useNavigation, useSearchParams } from 'react-router';
import { EditorMetadata, PageModeType } from './loader';
import { ClientContext } from '../../classes/provider/client-context';
import { KeyboardContext } from '../../classes/provider/keyboard-context';
import SessionExpiredDialog from '../common-page/session-expired-dialog';
import VersionConflictDialog from './version-conflict-dialog';
import queryClient from '../../queryClient';
import type { EditorConfiguration } from '@wisemapping/editor';
import { createThemeVariantStorage } from '../../services/createThemeVariantStorage';
import type { ActionType } from '../maps-page/action-chooser';

const buildPersistenceManagerForEditor = (
  mode: EditorRenderMode,
  setSessionExpired: (value: boolean) => void,
  onConflict: () => void,
  hid?: number,
  initialVersion?: number,
): PersistenceManager => {
  let result: PersistenceManager;
  if (AppConfig.isRestClient()) {
    const baseUrl = AppConfig.getApiBaseUrl();

    // Fetch Token ...
    const token = JwtTokenConfig.retreiveToken();
    if (mode === 'edition-owner' || mode === 'edition-editor') {
      // Fetch JWT token ...

      result = new RESTPersistenceManager({
        documentUrl: `${baseUrl}/api/restful/maps/{id}/document`,
        revertUrl: `${baseUrl}/api/restful/maps/{id}/history/latest`,
        lockUrl: `${baseUrl}/api/restful/maps/{id}/lock`,
        jwt: token,
        version: initialVersion,
      });
    } else {
      result = new LocalStorageManager(
        `${baseUrl}/api/restful/maps/{id}/${
          hid ? `${hid}/` : ''
        }document/xml${mode === 'showcase' || mode === 'viewonly-public' ? '-pub' : ''}`,
        true,
        token,
      );
    }

    // Add session expiration & conflict handlers ....
    result.addErrorHandler((error: PersistenceError) => {
      if (error.errorType === 'auth') {
        setSessionExpired(true);
      } else if (error.errorType === 'conflict') {
        onConflict();
      }
    });
  } else {
    result = new MockPersistenceManager(exampleMap);
  }
  return result;
};

export type EditorPropsType = {
  mapId: number;
  hid?: number | undefined;
  pageMode: PageModeType;
  zoom?: number | undefined;
};

const ActionDispatcher = React.lazy(() => import('../maps-page/action-dispatcher'));
const AccountMenu = React.lazy(() => import('../maps-page/account-menu'));

// While the router loads another page (leaving the editor, or another map), only the skeleton is
// shown. Deciding it here, before the editor's own hooks, keeps their order the same on every render.
const EditorPage = (props: EditorPropsType): React.ReactElement => {
  const navigation = useNavigation();
  const editorMetadata = useLoaderData() as EditorMetadata | undefined;
  if (navigation.state === 'loading' || !editorMetadata) {
    return <EditorLoadingSkeleton />;
  }
  return <LoadedEditorPage {...props} editorMetadata={editorMetadata} />;
};

const LoadedEditorPage = ({
  mapId,
  pageMode,
  zoom,
  hid,
  editorMetadata,
}: EditorPropsType & { editorMetadata: EditorMetadata }): React.ReactElement => {
  const [activeDialog, setActiveDialog] = useState<ActionType>();
  const [sessionExpired, setSessionExpired] = useState<boolean>(false);
  const [versionConflict, setVersionConflict] = useState<boolean>(false);
  const mapInfoRef = useRef<MapInfoImpl | undefined>(undefined);

  const account = useFetchAccount();
  const userLocale = AppI18n.getUserLocale(account?.locale);
  const intlLocale = useLocaleMessages(userLocale.code);
  const theme = useMuiTheme(); // Get MUI theme object
  const client = use(ClientContext);
  const { hotkeyEnabled } = use(KeyboardContext);

  // Parse query parameters for hideCreatorInfo and theme
  const [searchParams] = useSearchParams();
  const hideCreatorInfoParam = searchParams.get('hideCreatorInfo');
  const themeParam = searchParams.get('theme');

  // If zoom has been define, overwrite the stored value.
  if (zoom) {
    editorMetadata.zoom = zoom;
  }

  // Prevent pinch-to-zoom on the editor page (Safari/iOS)
  // Using CSS touch-action is the modern standard approach for SPAs
  useEffect(() => {
    // Store original styles to restore on unmount
    const originalBodyTouchAction = document.body.style.touchAction;
    const originalHtmlTouchAction = document.documentElement.style.touchAction;

    // Apply touch-action to prevent pinch zoom
    document.body.style.touchAction = 'none';
    document.documentElement.style.touchAction = 'none';

    // Cleanup: restore original styles when component unmounts
    return () => {
      document.body.style.touchAction = originalBodyTouchAction;
      document.documentElement.style.touchAction = originalHtmlTouchAction;
    };
  }, []);

  // Account loads asynchronously and should NOT block editor rendering.
  // AppI18n.getUserLocale() handles undefined account gracefully by falling back to default locale.
  const enableAppBar = pageMode !== 'view-private';
  const editorOptions: EditorOptions = {
    enableKeyboardEvents: hotkeyEnabled,
    locale: userLocale.code,
    mode: editorMetadata.editorMode,
    enableAppBar: enableAppBar,
    zoom: editorMetadata.zoom,
    hideCreatorInfo: hideCreatorInfoParam === 'true',
    ...((themeParam === 'dark' || themeParam === 'light') && { initialThemeVariant: themeParam }),
    ...(editorMetadata.bootstrapXML !== undefined && { bootstrapXML: editorMetadata.bootstrapXML }),
  };

  const handleVersionConflict = useCallback(() => {
    setVersionConflict(true);
    queryClient.invalidateQueries({ queryKey: ['maps', 'metadata', mapId] });
  }, [mapId]);

  useEffect(() => {
    return () => {
      queryClient.invalidateQueries({ queryKey: ['maps', 'metadata', mapId] });
    };
  }, [mapId]);

  const persistence: PersistenceManager = useMemo(
    () =>
      buildPersistenceManagerForEditor(
        editorMetadata.editorMode,
        setSessionExpired,
        handleVersionConflict,
        hid,
        editorMetadata.mapMetadata.version,
      ),
    [
      editorMetadata.editorMode,
      handleVersionConflict,
      hid,
      editorMetadata.mapMetadata.version,
    ],
  );

  const existingMapInfo = mapInfoRef.current;
  if (!existingMapInfo || existingMapInfo.getId() !== mapId.toString()) {
    mapInfoRef.current = new MapInfoImpl(
      mapId,
      client,
      editorMetadata.mapMetadata.title,
      editorMetadata.mapMetadata.creatorFullName,
      editorMetadata.mapMetadata.isLocked,
      editorMetadata.mapMetadata.isLockedBy,
      editorMetadata.zoom,
      editorMetadata.mapMetadata.starred,
    );
  } else {
    existingMapInfo.updateMetadata({
      locked: editorMetadata.mapMetadata.isLocked,
      lockedMsg: editorMetadata.mapMetadata.isLockedBy,
      zoom: editorMetadata.zoom,
      starred: editorMetadata.mapMetadata.starred,
      creatorFullName: editorMetadata.mapMetadata.creatorFullName,
    });
  }
  const mapInfo: MapInfo = mapInfoRef.current!;

  const editorConfig: EditorConfiguration = useEditor({
    mapInfo,
    options: editorOptions,
    persistenceManager: persistence,
  });

  const mapTitle = mapInfo.getTitle();
  useEffect(() => {
    if (mapTitle) {
      document.title = `${mapTitle} | WiseMapping `;
    }
  }, [mapTitle]);

  return (
    <IntlProvider
      locale={intlLocale.locale}
      defaultLocale={Locales.ZH.code}
      messages={intlLocale.messages}
    >
      <SessionExpiredDialog open={sessionExpired} />
      <VersionConflictDialog open={versionConflict} />
      <Editor
        config={editorConfig}
        onAction={setActiveDialog}
        theme={theme}
        themeVariantStorage={createThemeVariantStorage()}
        initialSearchParams={searchParams}
        accountConfiguration={
          // Prevent load on non-authenticated.
          editorOptions.mode !== 'showcase' ? (
            <Suspense fallback={<></>}>
              <IntlProvider locale={intlLocale.locale} messages={intlLocale.messages}>
                <AccountMenu />
              </IntlProvider>
            </Suspense>
          ) : (
            <></>
          )
        }
      />
      {activeDialog && (
        <Suspense fallback={<></>}>
          <ActionDispatcher
            action={activeDialog}
            onClose={() => setActiveDialog(undefined)}
            mapsId={[mapId]}
            fromEditor
            pageMode={pageMode}
            designer={
              editorConfig.model?.isMapLoadded() ? editorConfig.model.getDesigner() : undefined
            }
            beforeRevert={async () => editorConfig.model?.stopSaving()}
          />
        </Suspense>
      )}
    </IntlProvider>
  );
};

export default EditorPage;
