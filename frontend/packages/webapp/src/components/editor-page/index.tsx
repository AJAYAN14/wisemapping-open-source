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
import { useTheme as useMuiTheme } from '@mui/material/styles';
import AppI18n, { Locales } from '../../classes/app-i18n';
import { useLocaleMessages } from '../../classes/app-i18n/messages';
import { useFetchAccount } from '../../classes/middleware';
import MapInfoImpl from '../../classes/editor-map-info';
import AppConfig from '../../classes/app-config';
import JwtTokenConfig from '../../classes/jwt-token-config';
import { useLoaderData, useNavigation, useSearchParams } from 'react-router';
import {
  DeferredEditorLoaderData,
  DeferredEditorLoadResult,
  EditorMetadata,
  PageModeType,
} from './loader';
import { leaveTo } from '../../utils/redirect';
import { ClientContext } from '../../classes/provider/client-context';
import { KeyboardContext } from '../../classes/provider/keyboard-context';
import SessionExpiredDialog from '../common-page/session-expired-dialog';
import VersionConflictDialog from './version-conflict-dialog';
import queryClient from '../../queryClient';
import type { EditorConfiguration, UploadTopicImageFn } from '@wisemapping/editor';
import { createThemeVariantStorage } from '../../services/createThemeVariantStorage';
import type { ActionType } from '../maps-page/action-chooser';
import { uploadBlobToMapAssets } from '../../utils/mapAssets';
import { buildMapEditPath, buildMapHistoryViewPath } from '../../utils/mapPath';
import { scheduleIdleMapsPreload } from '../../utils/editorPreload';
import { finishMapOpenTrace, type MapOpenTimingRecord } from '../../utils/mapOpenTiming';

const escapeXmlAttr = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const buildFallbackMapXml = (mapId: number, title?: string): string => {
  const safeTitle = escapeXmlAttr((title || '新建导图').trim() || '新建导图');
  return `<map name="${mapId}" version="tango"><topic central="true" text="${safeTitle}" id="1" fontStyle=";;#ffffff;;;"></topic></map>`;
};

const buildPersistenceManagerForEditor = (
  mapId: number,
  mode: EditorRenderMode,
  setSessionExpired: (value: boolean) => void,
  onConflict: () => void,
  hid?: number,
  initialVersion?: number,
  fallbackTitle?: string,
  editorName?: string,
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
        `${baseUrl}/api/restful/maps/{id}/${hid ? `${hid}/` : ''}document/xml`,
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
    result = new MockPersistenceManager(buildFallbackMapXml(mapId, fallbackTitle), {
      ...(hid !== undefined ? { hid } : {}),
      ...(editorName ? { editorName } : {}),
    });
  }
  return result;
};

export type EditorPropsType = {
  hid?: number | undefined;
  pageMode: PageModeType;
  zoom?: number | undefined;
};

const ActionDispatcher = React.lazy(() => import('../maps-page/action-dispatcher'));

const isDeferredLoaderData = (
  data: EditorMetadata | DeferredEditorLoaderData | undefined,
): data is DeferredEditorLoaderData =>
  Boolean(
    data && typeof data === 'object' && ('metadataPromise' in data || 'editorMetadata' in data),
  );

const DeferredEditorGate = ({
  metadataPromise,
  ...props
}: EditorPropsType & {
  metadataPromise: Promise<DeferredEditorLoadResult>;
}): React.ReactElement => {
  const result = use(metadataPromise);

  useEffect(() => {
    if (result.redirectTo) {
      leaveTo(result.redirectTo);
    }
  }, [result.redirectTo]);

  if (!result.editorMetadata) {
    return <EditorLoadingSkeleton />;
  }

  return (
    <LoadedEditorPage
      {...props}
      mapId={result.editorMetadata.mapMetadata.id}
      editorMetadata={result.editorMetadata}
    />
  );
};

// While the router loads another page (leaving the editor, or another map), only the skeleton is
// shown. Deciding it here, before the editor's own hooks, keeps their order the same on every render.
const EditorPage = (props: EditorPropsType): React.ReactElement => {
  const navigation = useNavigation();
  const loaderData = useLoaderData() as EditorMetadata | DeferredEditorLoaderData | undefined;
  if (navigation.state === 'loading' || !loaderData) {
    return <EditorLoadingSkeleton />;
  }

  if (isDeferredLoaderData(loaderData)) {
    if (loaderData.editorMetadata) {
      return (
        <LoadedEditorPage
          {...props}
          mapId={loaderData.editorMetadata.mapMetadata.id}
          editorMetadata={loaderData.editorMetadata}
        />
      );
    }
    if (loaderData.metadataPromise) {
      return (
        <Suspense fallback={<EditorLoadingSkeleton />}>
          <DeferredEditorGate metadataPromise={loaderData.metadataPromise} {...props} />
        </Suspense>
      );
    }
    return <EditorLoadingSkeleton />;
  }

  return (
    <LoadedEditorPage
      {...props}
      mapId={loaderData.mapMetadata.id}
      editorMetadata={loaderData}
    />
  );
};

const LoadedEditorPage = ({
  mapId,
  pageMode,
  zoom,
  hid,
  editorMetadata,
}: EditorPropsType & { mapId: number; editorMetadata: EditorMetadata }): React.ReactElement => {
  const [activeDialog, setActiveDialog] = useState<ActionType>();
  const [exportTopicId, setExportTopicId] = useState<number | undefined>(undefined);
  const [sessionExpired, setSessionExpired] = useState<boolean>(false);
  const [versionConflict, setVersionConflict] = useState<boolean>(false);
  const mapInfoRef = useRef<MapInfoImpl | undefined>(undefined);

  const account = useFetchAccount();
  const userLocale = AppI18n.getUserLocale(account?.locale);
  const intlLocale = useLocaleMessages(userLocale.code);
  const client = use(ClientContext);
  const { hotkeyEnabled } = use(KeyboardContext);
  const muiTheme = useMuiTheme();
  const isDark = muiTheme.palette.mode === 'dark';

  // Parse query parameter for theme
  const [searchParams] = useSearchParams();
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

  const uploadTopicImage: UploadTopicImageFn | undefined = useMemo(() => {
    if (!AppConfig.isRestClient()) {
      return undefined;
    }
    return async (blob, _filename, size) => {
      const publicUrl = await uploadBlobToMapAssets(client, blob);
      if (publicUrl) {
        return {
          url: publicUrl,
          width: size?.width ?? 130,
          height: size?.height ?? 90,
        };
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === 'string'
            ? resolve(reader.result)
            : reject(new Error('读取图片失败'));
        reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'));
        reader.readAsDataURL(blob);
      });
      return {
        url: dataUrl,
        width: size?.width ?? 130,
        height: size?.height ?? 90,
      };
    };
  }, [client]);

  // Account loads asynchronously and should NOT block editor rendering.
  // AppI18n.getUserLocale() handles undefined account gracefully by falling back to default locale.
  const enableAppBar = pageMode !== 'view-private';
  const editorOptions: EditorOptions = {
    enableKeyboardEvents: hotkeyEnabled,
    locale: userLocale.code,
    mode: editorMetadata.editorMode,
    enableAppBar: enableAppBar,
    zoom: editorMetadata.zoom,
    ...(uploadTopicImage ? { uploadTopicImage } : {}),
    ...((themeParam === 'dark' || themeParam === 'light') && { initialThemeVariant: themeParam }),
    ...(editorMetadata.bootstrapXML !== undefined && { bootstrapXML: editorMetadata.bootstrapXML }),
  };

  const handleVersionConflict = useCallback(() => {
    setVersionConflict(true);
    queryClient.invalidateQueries({ queryKey: ['maps', 'metadata', mapId] });
    queryClient.invalidateQueries({ queryKey: ['maps', 'metadata-by-path'] });
  }, [mapId]);

  useEffect(() => {
    const folderPath = editorMetadata.mapMetadata.folderPath ?? '';
    const title = editorMetadata.mapMetadata.title;
    return () => {
      queryClient.invalidateQueries({ queryKey: ['maps', 'metadata', mapId] });
      queryClient.invalidateQueries({
        queryKey: ['maps', 'metadata-by-path', folderPath, title],
      });
      queryClient.invalidateQueries({ queryKey: ['maps'] });
    };
  }, [mapId, editorMetadata.mapMetadata.folderPath, editorMetadata.mapMetadata.title]);

  useEffect(() => scheduleIdleMapsPreload(), []);

  const editorName =
    account?.fullName?.trim() ||
    [account?.firstname, account?.lastname].filter(Boolean).join(' ') ||
    account?.firstname ||
    account?.email ||
    editorMetadata.mapMetadata.lastModificationBy ||
    editorMetadata.mapMetadata.creatorFullName;

  const persistence: PersistenceManager = useMemo(
    () =>
      buildPersistenceManagerForEditor(
        mapId,
        editorMetadata.editorMode,
        setSessionExpired,
        handleVersionConflict,
        hid,
        editorMetadata.mapMetadata.version,
        editorMetadata.mapMetadata.title,
        editorName,
      ),
    [
      mapId,
      editorMetadata.editorMode,
      handleVersionConflict,
      hid,
      editorMetadata.mapMetadata.version,
      editorMetadata.mapMetadata.title,
      editorName,
    ],
  );

  const handleTitleUpdated = useCallback(
    (newTitle: string) => {
      const folderPath = editorMetadata.mapMetadata.folderPath ?? '';
      editorMetadata.mapMetadata.title = newTitle;
      if (pageMode === 'edit') {
        const nextPath = buildMapEditPath(folderPath, newTitle);
        const nextUrl = `${nextPath}${window.location.search}${window.location.hash}`;
        window.history.replaceState(window.history.state, '', nextUrl);
      }
      queryClient.invalidateQueries({ queryKey: ['maps'] });
    },
    [editorMetadata, pageMode],
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
      handleTitleUpdated,
    );
  } else {
    existingMapInfo.setOnTitleUpdated(handleTitleUpdated);
    existingMapInfo.updateMetadata({
      locked: editorMetadata.mapMetadata.isLocked,
      starred: editorMetadata.mapMetadata.starred,
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

  const isMapLoaded = Boolean(editorConfig.model?.isMapLoadded());
  const recordedPerfMapIdRef = useRef<number | undefined>(undefined);
  const [openPerfRecord, setOpenPerfRecord] = useState<MapOpenTimingRecord | undefined>(undefined);

  useEffect(() => {
    if (!isMapLoaded || recordedPerfMapIdRef.current === mapId) {
      return;
    }
    recordedPerfMapIdRef.current = mapId;
    let topicCount: number;
    try {
      topicCount = editorConfig.model?.getDesigner().getModel().getTopics().length ?? 0;
    } catch {
      topicCount = 0;
    }
    const targetPath =
      pageMode === 'edit'
        ? buildMapEditPath(
            editorMetadata.mapMetadata.folderPath,
            editorMetadata.mapMetadata.title,
          )
        : buildMapHistoryViewPath(
            editorMetadata.mapMetadata.folderPath,
            editorMetadata.mapMetadata.title,
            hid ?? 0,
          );
    const record = finishMapOpenTrace(targetPath, mapTitle || editorMetadata.mapMetadata.title, topicCount);
    if (record) {
      setOpenPerfRecord(record);
    }
  }, [
    isMapLoaded,
    mapId,
    pageMode,
    hid,
    mapTitle,
    editorConfig.model,
    editorMetadata.mapMetadata.folderPath,
    editorMetadata.mapMetadata.title,
  ]);

  useEffect(() => {
    if (!openPerfRecord) {
      return undefined;
    }
    const timer = window.setTimeout(() => setOpenPerfRecord(undefined), 5500);
    return () => window.clearTimeout(timer);
  }, [openPerfRecord]);

  const themeVariantStorage = useMemo(() => createThemeVariantStorage(), []);
  useEffect(() => () => themeVariantStorage.destroy?.(), [themeVariantStorage]);

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
        onAction={(action) => {
          setExportTopicId(undefined);
          setActiveDialog(action);
        }}
        onExportTopic={(topicId) => {
          setExportTopicId(topicId);
          setActiveDialog('export');
        }}
        themeVariantStorage={themeVariantStorage}
      />
      {openPerfRecord && (
        <button
          type="button"
          data-testid="map-open-perf-badge"
          role="status"
          aria-live="polite"
          title={`总耗时 ${openPerfRecord.totalMs}ms | 路由 ${openPerfRecord.routeCommitMs}ms | 数据 ${openPerfRecord.metadataMs}ms (${openPerfRecord.cacheHit ? '命中预取' : '网络拉取'}${openPerfRecord.serverDbMs !== undefined ? `, DB ${openPerfRecord.serverDbMs}ms` : ''}) | 渲染 ${openPerfRecord.renderMs}ms | 节点 ${openPerfRecord.topicCount}`}
          onClick={() => setOpenPerfRecord(undefined)}
          style={{
            appearance: 'none',
            position: 'fixed',
            left: 'max(14px, env(safe-area-inset-left, 0px))',
            bottom: 'max(14px, env(safe-area-inset-bottom, 0px))',
            zIndex: 1200,
            padding: '5px 10px',
            borderRadius: '999px',
            fontSize: '11.5px',
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.01em',
            color: isDark ? 'rgba(245, 245, 247, 0.9)' : 'rgba(60, 60, 67, 0.88)',
            background: isDark ? 'rgba(38, 38, 42, 0.82)' : 'rgba(255, 255, 255, 0.78)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: isDark ? '0 2px 12px rgba(0, 0, 0, 0.35)' : '0 2px 10px rgba(0, 0, 0, 0.08)',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          打开耗时 {openPerfRecord.totalMs} ms ·{' '}
          {openPerfRecord.cacheHit
            ? `命中预取 · 渲染 ${openPerfRecord.renderMs} ms`
            : `数据 ${openPerfRecord.metadataMs} ms · 渲染 ${openPerfRecord.renderMs} ms`}
        </button>
      )}
      {activeDialog && (
        <Suspense fallback={<></>}>
          <ActionDispatcher
            action={activeDialog}
            onClose={() => {
              setActiveDialog(undefined);
              setExportTopicId(undefined);
            }}
            mapsId={[mapId]}
            pageMode={pageMode}
            exportTopicId={exportTopicId}
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
