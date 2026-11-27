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

import { ErrorInfo, MapMetadata } from '../../classes/client';
import type { EditorRenderMode } from '@wisemapping/mindplot';
import type { LoaderFunctionArgs } from 'react-router';
import AppConfig from '../../classes/app-config';
import queryClient from '../../queryClient';
import Client from '../../classes/client';
import { createJsonResponse } from '../../utils/response';
import { mapMetadataByPathQueryKey, mapMetadataQueryKey } from '../../classes/middleware';
import AppI18n from '../../classes/app-i18n';
import I18nMsg from '@wisemapping/editor/classes/i18n-msg';
import { appLogger as log } from '../../utils/logger';
import {
  buildMapEditPath,
  buildMapHistoryViewPath,
  parseMapRouteSplat,
} from '../../utils/mapPath';
import { loadEditorPage } from '../../utils/editorPreload';
import { markMapOpenMetadataReady, markMapOpenRouteCommitted } from '../../utils/mapOpenTiming';

export type EditorMetadata = {
  editorMode: EditorRenderMode;
  mapMetadata: MapMetadata;
  zoom: number;
  bootstrapXML?: string; // Bootstrap XML to use instead of fetching from server
};

export type PageModeType = 'edit' | 'view-private';

export type DeferredEditorLoadResult =
  | { editorMetadata: EditorMetadata; redirectTo?: undefined }
  | { redirectTo: string; editorMetadata?: undefined };

export type DeferredEditorLoaderData = {
  editorMetadata?: EditorMetadata;
  metadataPromise?: Promise<DeferredEditorLoadResult>;
};

export type EditorLoaderOptions = {
  defer?: boolean;
};

const MAP_OPEN_STALE_TIME_MS = 30_000;

/**
 * Fetches map metadata by folderPath + title using React Query cache, and seeds the
 * ID-keyed metadata cache so in-editor dialogs share the same record without refetching.
 */
async function fetchMapMetadataByPathWithCache(
  folderPath: string,
  title: string,
  client: Client,
  includeXml = false,
): Promise<MapMetadata> {
  const metadata = await queryClient.fetchQuery<MapMetadata, ErrorInfo>({
    queryKey: mapMetadataByPathQueryKey(folderPath, title, includeXml),
    queryFn: () => client.fetchMapMetadataByPath(folderPath, title, includeXml),
    staleTime: MAP_OPEN_STALE_TIME_MS,
  });
  queryClient.setQueryData(mapMetadataQueryKey(metadata.id, includeXml), metadata);
  if (!includeXml) {
    queryClient.setQueryData(mapMetadataQueryKey(metadata.id, false), metadata);
  }
  return metadata;
}

const buildEditorMetadata = (
  mapMetadata: MapMetadata,
  pageMode: PageModeType,
  bootstrapXml: boolean,
): EditorMetadata => {
  const editorMode: EditorRenderMode =
    mapMetadata.isLocked || pageMode === 'view-private'
      ? 'viewonly-private'
      : `edition-${mapMetadata.role === 'none' ? 'owner' : mapMetadata.role}`;

  let zoom = 0.8;
  if (mapMetadata.jsonProps && mapMetadata.jsonProps.trim()) {
    try {
      const parsedProps = JSON.parse(mapMetadata.jsonProps.trim());
      if (parsedProps && typeof parsedProps === 'object' && 'zoom' in parsedProps) {
        zoom = typeof parsedProps.zoom === 'number' ? parsedProps.zoom : zoom;
      }
    } catch (error) {
      console.warn(
        `Failed to parse jsonProps for map ${mapMetadata.id}:`,
        mapMetadata.jsonProps,
        error,
      );
    }
  }

  const data: EditorMetadata = {
    editorMode,
    mapMetadata,
    zoom,
  };
  if (bootstrapXml && mapMetadata.xml) {
    data.bootstrapXML = mapMetadata.xml;
  }
  return data;
};

// The editor's own messages, loaded with the map so that its chrome paints in Chinese.
// language. Imported by path: the editor barrel would put the whole editor in the entry.
const preloadEditorMessages = (): Promise<unknown> =>
  I18nMsg.load(AppI18n.getUserLocale().code).catch((error) =>
    log.error('The editor messages could not be loaded', error),
  );

const resolveLoginRedirectUrl = (args?: LoaderFunctionArgs): string => {
  let url = window.location.pathname + window.location.search;
  if (args?.request?.url) {
    try {
      const reqUrl = new URL(args.request.url);
      url = reqUrl.pathname + reqUrl.search;
    } catch {
      // Fallback to window.location
    }
  }
  return `/login?redirect=${encodeURIComponent(url)}`;
};

const loadDeferredMap = (
  bootstrap: boolean,
  args: LoaderFunctionArgs,
): Response | DeferredEditorLoaderData => {
  const parsed = parseMapRouteSplat(args.params['*']);
  if (!parsed) {
    return new Response('Map could not be found', {
      status: 404,
      statusText: 'Not Found',
    });
  }

  const { pageMode, folderPath, title } = parsed;
  const targetPath =
    pageMode === 'edit'
      ? buildMapEditPath(folderPath, title)
      : buildMapHistoryViewPath(folderPath, title, parsed.hid);
  markMapOpenRouteCommitted(targetPath);

  const bootstrapXml = bootstrap && pageMode === 'edit';
  const messagesPromise = preloadEditorMessages();
  const chunkPromise = loadEditorPage().catch(() => undefined);

  const cacheKey = mapMetadataByPathQueryKey(folderPath, title, bootstrapXml);
  const cached = queryClient.getQueryData<MapMetadata>(cacheKey);
  const cacheState = queryClient.getQueryState(cacheKey);
  const isFreshCache = Boolean(
    cached &&
      !cacheState?.isInvalidated &&
      cacheState?.status === 'success' &&
      Date.now() - cacheState.dataUpdatedAt < MAP_OPEN_STALE_TIME_MS,
  );
  if (isFreshCache && cached) {
    queryClient.setQueryData(mapMetadataQueryKey(cached.id, bootstrapXml), cached);
    if (!bootstrapXml) {
      queryClient.setQueryData(mapMetadataQueryKey(cached.id, false), cached);
    }
    markMapOpenMetadataReady(targetPath, true);
    return {
      editorMetadata: buildEditorMetadata(cached, pageMode, bootstrapXml),
    };
  }

  const client = AppConfig.getClient();
  const metadataPromise: Promise<DeferredEditorLoadResult> = (async () => {
    try {
      const [mapMetadata] = await Promise.all([
        fetchMapMetadataByPathWithCache(folderPath, title, client, bootstrapXml),
        messagesPromise,
        chunkPromise,
      ]);
      markMapOpenMetadataReady(targetPath, false);
      return {
        editorMetadata: buildEditorMetadata(mapMetadata, pageMode, bootstrapXml),
      };
    } catch (e) {
      const error = e as ErrorInfo;
      if (!error.isAuth) {
        console.warn('Map could not be loaded');
        console.warn(e);
        throw e;
      }
      return {
        redirectTo: resolveLoginRedirectUrl(args),
      };
    }
  })();

  return { metadataPromise };
};

export function loader(bootstrap?: boolean): (args: LoaderFunctionArgs) => Promise<Response>;
export function loader(
  bootstrap: boolean,
  options: { defer: true },
): (args: LoaderFunctionArgs) => Response | DeferredEditorLoaderData;
export function loader(
  bootstrap = false,
  options?: EditorLoaderOptions,
): (args: LoaderFunctionArgs) => Promise<Response> | Response | DeferredEditorLoaderData {
  if (options?.defer) {
    return (args: LoaderFunctionArgs) => loadDeferredMap(bootstrap, args);
  }
  const loadMap = loadMapFor(bootstrap);
  return async (args: LoaderFunctionArgs): Promise<Response> => {
    const [result] = await Promise.all([
      loadMap(args),
      preloadEditorMessages(),
      loadEditorPage().catch(() => undefined),
    ]);
    return result;
  };
}

const loadMapFor = (bootstrap: boolean) => {
  return async (args: LoaderFunctionArgs): Promise<Response> => {
    const parsed = parseMapRouteSplat(args.params['*']);
    if (!parsed) {
      return new Response('Map could not be found', {
        status: 404,
        statusText: 'Not Found',
      });
    }

    const client = AppConfig.getClient();
    let result: Response | undefined;
    const { pageMode, folderPath, title } = parsed;

    switch (pageMode) {
      case 'edit':
      case 'view-private': {
        try {
          // A history revision is loaded by the editor from its own URL: bootstrapping it with
          // the current map's XML would show today's map instead of the revision.
          const bootstrapXml = bootstrap && pageMode === 'edit';
          const mapMetadata = await fetchMapMetadataByPathWithCache(
            folderPath,
            title,
            client,
            bootstrapXml,
          );
          result = createJsonResponse(buildEditorMetadata(mapMetadata, pageMode, bootstrapXml));
        } catch (e) {
          // If the issue is an auth error, it needs to be redirect to login.
          const error = e as ErrorInfo;
          if (!error.isAuth) {
            console.warn(`Map could not be loaded`);
            console.warn(e);
            throw e;
          }
        }
        break;
      }
      default: {
        const exhaustiveCheck: never = pageMode;
        throw new Error(exhaustiveCheck);
      }
    }

    // If result has not been set, redict to the login with the original url
    if (!result) {
      result = new Response('Map could not be loaded, redirect to login.', {
        status: 302,
        headers: {
          Location: resolveLoginRedirectUrl(args),
        },
      });
    }

    return result;
  };
};
