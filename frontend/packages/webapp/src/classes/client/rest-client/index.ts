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
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import Client, {
  ErrorInfo,
  MapInfo,
  BasicMapInfo,
  Label,
  Folder,
  ChangeHistory,
  AccountInfo,
  ImportMapInfo,
  Oauth2CallbackResult,
  JwtAuth,
  MapMetadata,
  LoginErrorInfo,
  AssetUploadUrlRequest,
  AssetUploadUrlItem,
  AssetStorageStats,
  AssetCleanupResult,
} from '..';
import AppI18n, { Locale, LocaleCode, Locales, localeFromStr } from '../../app-i18n';
import JwtTokenConfig from '../../jwt-token-config';
import { appLogger as log } from '../../../utils/logger';
import { describeHttpError } from '../http-error';

export default class RestClient implements Client {
  private baseUrl: string;
  private axios: AxiosInstance;
  private _onSessionExpired?: () => void;

  /**
   * The one place that reports an expired session, from the token the request carried:
   * - a request without a token was made by nobody signed in (an anonymous visitor on a public
   *   map), so its 401 is no expired session;
   * - the backend reads an expired token as anonymous, so a 403 sent with one is an expired
   *   session, while a 403 with a valid token is a refusal (the map was unshared or deleted).
   */
  private checkResponseForSessionExpired = <T>(error: {
    response?: AxiosResponse<T>;
    config?: { url?: string; headers?: { get?: (name: string) => unknown } };
  }): Promise<{ response?: AxiosResponse<T> }> => {
    const status = error.response ? error.response.status : 0;
    const authorization = error.config?.headers?.get?.('Authorization');
    const sentToken =
      typeof authorization === 'string' ? authorization.replace(/^Bearer\s+/i, '') : undefined;
    if (sentToken) {
      const signInFailed = error.config?.url?.endsWith('/authenticate');
      if (
        ((status === 401 || status === 302) && !signInFailed) ||
        (status === 403 && JwtTokenConfig.isTokenExpired(sentToken))
      ) {
        this.sessionExpired();
      }
    }
    return Promise.reject(error);
  };

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.axios = axios.create({ maxRedirects: 0 });

    // Configure request interceptors ...
    this.axios.interceptors.request.use((config) => {
      if (config.headers) {
        // JWT Token ...
        const jwtToken = this._jwtHeaderTokenValue();
        if (jwtToken) {
          config.headers['Authorization'] = jwtToken;
        }

        // Send browser locale ...
        const locale = this.getDefaultLocale();
        config.headers['Accept-Language'] = locale.code;
      }

      return config;
    });

    // Process response globally ...
    this.axios.interceptors.response.use(
      (response) => response,
      (respoonse) => this.checkResponseForSessionExpired(respoonse),
    );
  }

  fetchMapMetadata(id: number, includeXml = false): Promise<MapMetadata> {
    const handler = (
      success: (mapMetadata: MapMetadata) => void,
      reject: (error: ErrorInfo) => void,
    ) => {
      const url = `${this.baseUrl}/api/restful/maps/${id}/metadata${includeXml ? '?xml=true' : ''}`;
      this.axios
        .get(url, {
          headers: { 'Content-Type': 'application/json' },
        })
        .then((response) => {
          // The backend sends the lock as "locked" (RestMindmapMetadata) and no id.
          const { locked, ...data } = response.data as Omit<MapMetadata, 'isLocked'> & {
            locked?: boolean;
          };
          const headerVersionRaw = response.headers?.['x-mindmap-version'];
          const parsedHeaderVersion =
            typeof headerVersionRaw === 'string' ? Number.parseInt(headerVersionRaw, 10) : NaN;
          const version =
            data.version !== undefined
              ? data.version
              : Number.isInteger(parsedHeaderVersion)
                ? parsedHeaderVersion
                : undefined;
          success({
            ...data,
            id,
            isLocked: Boolean(locked),
            ...(version !== undefined ? { version } : {}),
          });
        })
        .catch((error) => {
          const errorInfo = this.parseResponseOnError(error.response);
          reject(errorInfo);
        });
    };

    return new Promise(handler);
  }

  async logout(): Promise<void> {
    JwtTokenConfig.removeToken();

    // Kill backend session ...
    try {
      await this.axios.post(`${this.baseUrl}/api/restful/logout`, null, {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      log.error('Error logging out from backend', describeHttpError(e));
    }
  }

  login(model: JwtAuth): Promise<void> {
    const handler = (success: () => void, reject: (error: LoginErrorInfo) => void) => {
      this.axios
        .post(`${this.baseUrl}/api/restful/authenticate`, model, {
          headers: { 'Content-Type': 'application/json' },
        })
        .then((response) => {
          // Story JWT token ...
          const token = response.data;

          JwtTokenConfig.storeToken(token);
          success();
        })
        .catch((error) => {
          // Handle an expected error ...
          log.error(describeHttpError(error));
          const errorInfo = this.parseResponseOnError(error.response) as LoginErrorInfo;
          errorInfo.code = !error.response || error.response.status !== 403 ? 1 : 3;

          reject(errorInfo);
        });
    };
    return new Promise(handler);
  }

  private _jwtHeaderTokenValue(): string | undefined {
    // Set cookie on session ...
    const token = JwtTokenConfig.retreiveToken();
    return token ? `Bearer ${token}` : undefined;
  }

  onSessionExpired(callback?: () => void): (() => void) | undefined {
    if (callback) {
      this._onSessionExpired = callback;
    }
    return this._onSessionExpired;
  }

  private sessionExpired() {
    if (this._onSessionExpired) {
      this._onSessionExpired();
    }
  }

  importMap(model: ImportMapInfo): Promise<number> {
    const handler = (success: (mapId: number) => void, reject: (error: ErrorInfo) => void) => {
      const folderIdParam =
        model.folderId !== undefined && model.folderId !== null
          ? `&folderId=${encodeURIComponent(String(model.folderId))}`
          : '';
      const folderParam = model.folderPath
        ? `&folderPath=${encodeURIComponent(model.folderPath)}`
        : '';
      const overwriteParam = model.overwrite ? '&overwrite=true' : '';
      this.axios
        .post(
          `${this.baseUrl}/api/restful/maps?title=${encodeURIComponent(
            model.title,
          )}&description=${encodeURIComponent(model.description ? model.description : '')}${folderIdParam}${folderParam}${overwriteParam}`,
          model.content,
          { headers: { 'Content-Type': 'application/xml' } },
        )
        .then((response) => {
          const mapId = Number.parseInt(response.headers['resourceid'], 10);
          success(mapId);
        })
        .catch((error) => {
          const errorInfo = this.parseResponseOnError(error.response);
          reject(errorInfo);
        });
    };
    return new Promise(handler);
  }

  fetchAccountInfo(): Promise<AccountInfo> {
    const handler = (
      success: (account: AccountInfo) => void,
      reject: (error: ErrorInfo) => void,
    ) => {
      this.axios
        .get(`${this.baseUrl}/api/restful/account`, {
          headers: { 'Content-Type': 'application/json' },
        })
        .then((response) => {
          const account = response.data;
          const locale: LocaleCode | undefined = account.locale ?? undefined;
          let accountLocale: Locale | undefined;
          if (locale) {
            try {
              accountLocale = localeFromStr(locale);
            } catch {
              // A language the backend knows but this frontend doesn't: fall back to English.
              log.warn(`Unsupported account locale '${locale}', using Chinese`);
              accountLocale = Locales.ZH;
            }
          }
          success({
            lastname: account.lastname ? account.lastname : '',
            firstname: account.firstname ? account.firstname : '',
            fullName: account.fullName ? account.fullName : '',
            avatarUrl: account.avatarUrl ? account.avatarUrl : undefined,
            email: account.email,
            locale: accountLocale,
            authenticationType: account.authenticationType,
            isAdmin: account.isAdmin === true,
          });
        })
        .catch((error) => {
          const errorInfo = this.parseResponseOnError(error.response);
          reject(errorInfo);
        });
    };
    return new Promise(handler);
  }

  deleteMaps(ids: number[]): Promise<void> {
    const handler = (success: () => void, reject: (error: ErrorInfo) => void) => {
      this.axios
        .delete(`${this.baseUrl}/api/restful/maps/batch?ids=${ids.join()}`, {
          headers: { 'Content-Type': 'text/plain' },
        })
        .then(() => {
          success();
        })
        .catch((error) => {
          const response = error.response;
          const errorInfo = this.parseResponseOnError(response);
          reject(errorInfo);
        });
    };
    return new Promise(handler);
  }

  revertHistory(id: number, hid: number): Promise<void> {
    const handler = (success: () => void, reject: (error: ErrorInfo) => void) => {
      this.axios
        .post(`${this.baseUrl}/api/restful/maps/${id}/history/${hid}`, null, {
          headers: { 'Content-Type': 'text/plain' },
        })
        .then(() => {
          success();
        })
        .catch((error) => {
          const errorInfo = this.parseResponseOnError(error.response);
          reject(errorInfo);
        });
    };
    return new Promise(handler);
  }

  fetchHistory(id: number): Promise<ChangeHistory[]> {
    const handler = (
      success: (historyList: ChangeHistory[]) => void,
      reject: (error: ErrorInfo) => void,
    ) => {
      this.axios
        .get(`${this.baseUrl}/api/restful/maps/${id}/history/`, {
          headers: { 'Content-Type': 'application/json' },
        })
        .then((response) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const historyList: ChangeHistory[] = (response.data.changes as any[]).map((h) => {
            return {
              id: h.id,
              lastModificationBy: h.creator,
              lastModificationTime: h.creationTime,
            };
          });
          success(historyList);
        })
        .catch((error) => {
          const errorInfo = this.parseResponseOnError(error.response);
          reject(errorInfo);
        });
    };
    return new Promise(handler);
  }

  requestAssetUploadUrls(items: AssetUploadUrlRequest[]): Promise<AssetUploadUrlItem[]> {
    return this.axios
      .post<{ items: AssetUploadUrlItem[] }>(
        `${this.baseUrl}/api/restful/assets/upload-urls`,
        { items },
        { headers: { 'Content-Type': 'application/json' } },
      )
      .then((response) => response.data.items ?? [])
      .catch((error) => Promise.reject(this.parseResponseOnError(error.response)));
  }

  fetchAssetStorageStats(): Promise<AssetStorageStats> {
    return this.axios
      .get<AssetStorageStats>(`${this.baseUrl}/api/restful/assets/stats`, {
        headers: { 'Content-Type': 'application/json' },
      })
      .then((response) => response.data)
      .catch((error) => Promise.reject(this.parseResponseOnError(error.response)));
  }

  cleanupOrphanedAssets(): Promise<AssetCleanupResult> {
    return this.axios
      .post<AssetCleanupResult>(
        `${this.baseUrl}/api/restful/assets/cleanup`,
        {},
        { headers: { 'Content-Type': 'application/json' } },
      )
      .then((response) => response.data)
      .catch((error) => Promise.reject(this.parseResponseOnError(error.response)));
  }

  protected getDefaultLocale(): Locale {
    return AppI18n.getDefaultLocale();
  }

  renameMap(id: number, changes: Partial<BasicMapInfo>): Promise<void> {
    const handler = (success: () => void, reject: (error: ErrorInfo) => void) => {
      // Only what changed is sent: the backend refuses a title the user already has, the map's
      // own included, so resending an unchanged title would fail a description-only edit.
      const updateTitle = () =>
        changes.title === undefined
          ? undefined
          : this.axios.put(`${this.baseUrl}/api/restful/maps/${id}/title`, changes.title, {
              headers: { 'Content-Type': 'text/plain' },
            });
      // A cleared description is sent as a blank: the backend refuses an empty body.
      const updateDescription = () =>
        changes.description === undefined
          ? undefined
          : this.axios.put(
              `${this.baseUrl}/api/restful/maps/${id}/description`,
              changes.description || ' ',
              { headers: { 'Content-Type': 'text/plain' } },
            );

      Promise.resolve()
        .then(updateTitle)
        .then(updateDescription)
        .then(() => success())
        .catch((error) => {
          const response = error.response;
          const errorInfo = this.parseResponseOnError(response);
          reject(errorInfo);
        });
    };
    return new Promise(handler);
  }

  createMap(model: BasicMapInfo): Promise<number> {
    const handler = (success: (mapId: number) => void, reject: (error: ErrorInfo) => void) => {
      const theme = 'prism';
      const folderIdParam =
        model.folderId !== undefined && model.folderId !== null
          ? `&folderId=${encodeURIComponent(String(model.folderId))}`
          : '';

      this.axios
        .post(
          `${this.baseUrl}/api/restful/maps?title=${encodeURIComponent(
            model.title,
          )}&description=${encodeURIComponent(model.description ? model.description : '')}&theme=${encodeURIComponent(theme)}${folderIdParam}`,
          undefined,
          { headers: { 'Content-Type': 'application/json' } },
        )
        .then((response) => {
          const mapId = Number.parseInt(response.headers['resourceid'], 10);
          success(mapId);
        })
        .catch((error) => {
          const errorInfo = this.parseResponseOnError(error.response);
          reject(errorInfo);
        });
    };
    return new Promise(handler);
  }

  fetchAllMaps(): Promise<MapInfo[]> {
    const handler = (
      success: (mapsInfo: MapInfo[]) => void,
      reject: (error: ErrorInfo) => void,
    ) => {
      this.axios
        .get(`${this.baseUrl}/api/restful/maps/`, {
          headers: { 'Content-Type': 'application/json' },
        })
        .then((response) => {
          const data = response.data;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const maps: MapInfo[] = (data.mindmapsInfo as any[]).map((m) => {
            return {
              id: m.id,
              starred: m.starred,
              title: m.title,
              folderId: m.folderId ?? null,
              folderPath: m.folderPath,
              labels: m.labels,
              createdBy: m.creator,
              creationTime: m.creationTime,
              lastModificationBy: m.lastModifierUser,
              lastModificationTime: m.lastModificationTime,
              description: m.description,
              public: m['public'],
              role: m.role,
            };
          });
          success(maps);
        })
        .catch((error) => {
          const errorInfo = this.parseResponseOnError(error.response);
          reject(errorInfo);
        });
    };
    return new Promise(handler);
  }

  deleteMap(id: number): Promise<void> {
    const handler = (success: () => void, reject: (error: ErrorInfo) => void) => {
      this.axios
        .delete(`${this.baseUrl}/api/restful/maps/${id}`, {
          headers: { 'Content-Type': 'application/json' },
        })
        .then(() => {
          success();
        })
        .catch((error) => {
          const errorInfo = this.parseResponseOnError(error.response);
          reject(errorInfo);
        });
    };
    return new Promise(handler);
  }

  duplicateMap(id: number, basicInfo: BasicMapInfo): Promise<number> {
    const handler = (success: (mapId: number) => void, reject: (error: ErrorInfo) => void) => {
      this.axios
        .post(`${this.baseUrl}/api/restful/maps/${id}`, JSON.stringify(basicInfo), {
          headers: { 'Content-Type': 'application/json' },
        })
        .then((response) => {
          const mapId = Number.parseInt(response.headers['resourceid'], 10);
          success(mapId);
        })
        .catch((error) => {
          const response = error.response;
          const errorInfo = this.parseResponseOnError(response);
          reject(errorInfo);
        });
    };
    return new Promise(handler);
  }

  updateStarred(id: number, starred: boolean): Promise<void> {
    const handler = (success: () => void, reject: (error: ErrorInfo) => void) => {
      this.axios
        .put(`${this.baseUrl}/api/restful/maps/${id}/starred`, starred.toString(), {
          headers: { 'Content-Type': 'text/plain' },
        })
        .then(() => {
          success();
        })
        .catch((error) => {
          const response = error.response;
          const errorInfo = this.parseResponseOnError(response);
          reject(errorInfo);
        });
    };
    return new Promise(handler);
  }

  fetchLabels(): Promise<Label[]> {
    const handler = (success: (labels: Label[]) => void, reject: (error: ErrorInfo) => void) => {
      this.axios
        .get(`${this.baseUrl}/api/restful/labels/`, {
          headers: { 'Content-Type': 'application/json' },
        })
        .then((response) => {
          const data = response.data;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const maps: Label[] = (data.labels as any[]).map((l) => {
            return {
              id: l.id,
              color: l.color,
              title: l.title,
              iconName: l.iconName,
            };
          });
          success(maps);
        })
        .catch((error) => {
          const errorInfo = this.parseResponseOnError(error.response);
          reject(errorInfo);
        });
    };
    return new Promise(handler);
  }

  createLabel(title: string, color: string): Promise<number> {
    const handler = (success: (labelId: number) => void, reject: (error: ErrorInfo) => void) => {
      this.axios
        .post(
          `${this.baseUrl}/api/restful/labels`,
          JSON.stringify({ title, color, iconName: 'smile' }),
          {
            headers: { 'Content-Type': 'application/json' },
          },
        )
        .then((response) => {
          const mapId = Number.parseInt(response.headers['resourceid'], 10);
          success(mapId);
        })
        .catch((error) => {
          const errorInfo = this.parseResponseOnError(error.response);
          reject(errorInfo);
        });
    };
    return new Promise(handler);
  }

  deleteLabel(id: number): Promise<void> {
    const handler = (success: () => void, reject: (error: ErrorInfo) => void) => {
      this.axios
        .delete(`${this.baseUrl}/api/restful/labels/${id}`)
        .then(() => {
          success();
        })
        .catch((error) => {
          const errorInfo = this.parseResponseOnError(error.response);
          reject(errorInfo);
        });
    };
    return new Promise(handler);
  }

  addLabelToMap(labelId: number, mapId: number): Promise<void> {
    const handler = (success: () => void, reject: (error: ErrorInfo) => void) => {
      this.axios
        .post(`${this.baseUrl}/api/restful/maps/${mapId}/labels`, JSON.stringify(labelId), {
          headers: { 'Content-Type': 'application/json' },
        })
        .then(() => {
          success();
        })
        .catch((error) => {
          const errorInfo = this.parseResponseOnError(error.response);
          reject(errorInfo);
        });
    };
    return new Promise(handler);
  }

  deleteLabelFromMap(labelId: number, mapId: number): Promise<void> {
    const handler = (success: () => void, reject: (error: ErrorInfo) => void) => {
      this.axios
        .delete(`${this.baseUrl}/api/restful/maps/${mapId}/labels/${labelId}`)
        .then(() => {
          success();
        })
        .catch((error) => {
          const errorInfo = this.parseResponseOnError(error.response);
          reject(errorInfo);
        });
    };
    return new Promise(handler);
  }

  fetchFolders(): Promise<Folder[]> {
    return this.axios
      .get<{ folders: Folder[] }>(`${this.baseUrl}/api/restful/folders`, {
        headers: { 'Content-Type': 'application/json' },
      })
      .then((response) =>
        (response.data.folders ?? []).map((f) => ({
          id: f.id,
          name: f.name,
          parentId: f.parentId ?? null,
          creationTime: f.creationTime,
          updatedTime: f.updatedTime,
        })),
      )
      .catch((error) => Promise.reject(this.parseResponseOnError(error.response)));
  }

  createFolder(name: string, parentId: number | null = null): Promise<Folder> {
    return this.axios
      .post<{ folder: Folder }>(
        `${this.baseUrl}/api/restful/folders`,
        { name, parentId },
        { headers: { 'Content-Type': 'application/json' } },
      )
      .then((response) => ({
        ...response.data.folder,
        parentId: response.data.folder.parentId ?? null,
      }))
      .catch((error) => Promise.reject(this.parseResponseOnError(error.response)));
  }

  updateFolder(
    id: number,
    changes: { name?: string; parentId?: number | null },
  ): Promise<Folder> {
    return this.axios
      .put<{ folder: Folder }>(`${this.baseUrl}/api/restful/folders/${id}`, changes, {
        headers: { 'Content-Type': 'application/json' },
      })
      .then((response) => ({
        ...response.data.folder,
        parentId: response.data.folder.parentId ?? null,
      }))
      .catch((error) => Promise.reject(this.parseResponseOnError(error.response)));
  }

  deleteFolder(id: number): Promise<void> {
    return this.axios
      .delete(`${this.baseUrl}/api/restful/folders/${id}`)
      .then(() => undefined)
      .catch((error) => Promise.reject(this.parseResponseOnError(error.response)));
  }

  moveMapsToFolder(mapIds: number[], folderId: number | null): Promise<void> {
    if (mapIds.length === 1) {
      return this.axios
        .put(
          `${this.baseUrl}/api/restful/maps/${mapIds[0]}/folder`,
          { folderId },
          { headers: { 'Content-Type': 'application/json' } },
        )
        .then(() => undefined)
        .catch((error) => Promise.reject(this.parseResponseOnError(error.response)));
    }
    return this.axios
      .put(
        `${this.baseUrl}/api/restful/maps/batch/folder`,
        { mapIds, folderId },
        { headers: { 'Content-Type': 'application/json' } },
      )
      .then(() => undefined)
      .catch((error) => Promise.reject(this.parseResponseOnError(error.response)));
  }

  processGoogleCallback(code: string): Promise<Oauth2CallbackResult> {
    const handler = (
      success: (result: Oauth2CallbackResult) => void,
      reject: (error: ErrorInfo) => void,
    ) => {
      this.axios
        .post(`${this.baseUrl}/api/restful/oauth2/googlecallback?code=${code}`, null, {
          headers: { 'Content-Type': 'application/json' },
        })
        .then((response) => {
          success({
            email: response.data.email,
            oauthSync: response.data.oauthSync,
            syncCode: response.data.syncCode,
          });

          // Store jwt cookie ...
          const token = response.data.jwtToken;
          if (token) {
            JwtTokenConfig.storeToken(token);
          }
        })
        .catch((error) => {
          const errorInfo = this.parseResponseOnError(error.response);
          reject(errorInfo);
        });
    };
    return new Promise(handler);
  }

  confirmAccountSync(
    email: string,
    code?: string,
    provider?: string,
  ): Promise<Oauth2CallbackResult> {
    const handler = (
      success: (result: Oauth2CallbackResult) => void,
      reject: (error: ErrorInfo) => void,
    ) => {
      const params = new URLSearchParams();
      params.append('email', email);
      if (code) {
        params.append('code', code);
      }
      if (provider) {
        params.append('provider', provider);
      }
      this.axios
        .put(`${this.baseUrl}/api/restful/oauth2/confirmaccountsync?${params.toString()}`, null, {
          headers: { 'Content-Type': 'application/json' },
        })
        .then((response) => {
          success({
            email: response.data.email,
            oauthSync: response.data.oauthSync,
            syncCode: response.data.syncCode,
          });

          // Store jwt cookie ...
          const token = response.data.jwtToken;
          if (token) {
            JwtTokenConfig.storeToken(token);
          }
        })
        .catch((error) => {
          const errorInfo = this.parseResponseOnError(error.response);
          reject(errorInfo);
        });
    };
    return new Promise(handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseResponseOnError = (response: any): ErrorInfo => {
    if (response?.status !== 401) {
      log.error(`Performing backend action error: ${JSON.stringify(describeHttpError(response))}`);
    }

    let result: ErrorInfo | undefined;
    if (response) {
      const status: number = response.status;
      const data = response.data;
      const isMetadataRequest =
        typeof response?.config?.url === 'string' &&
        response.config.url.includes('/maps/') &&
        response.config.url.includes('/metadata') &&
        response?.config?.method?.toLowerCase() === 'get';
      const isSpamMindmapError = status === 422 && isMetadataRequest;
      const normalizedStatus = isSpamMindmapError ? 410 : status;

      switch (status) {
        case 401:
        case 302:
          // Check if there's a specific error message in the response
          if (data && data.globalErrors && data.globalErrors.length > 0) {
            // Use the actual error message from the backend (e.g., login failure)
            result = {
              msg: data.globalErrors[0],
            };
          } else {
            // No specific error message, treat as session expiration. The response interceptor
            // has already notified it, when the request was a signed-in one.
            result = {
              isAuth: true,
              msg: 'Your current session has expired. Please, sign in and try again.',
            };
          }
          break;
        default:
          if (data) {
            // Set global errors ...
            result = {};
            if (typeof data.errorCode === 'string') {
              result.errorCode = data.errorCode;
            }
            const globalErrors = data.globalErrors;
            if (globalErrors && globalErrors.length > 0) {
              result.msg = globalErrors[0];
            }

            // Set field errors ...
            if (data.fieldErrors && Object.keys(data.fieldErrors).length > 0) {
              result.fields = data.fieldErrors;
              if (!result.msg) {
                const [firstFieldError] = Object.values<string>(data.fieldErrors);
                if (firstFieldError !== undefined) {
                  result.msg = firstFieldError;
                }
              }
            }
          } else if (
            typeof response.statusText === 'string' &&
            response.statusText.trim().length > 0
          ) {
            result = { msg: response.statusText };
          } else {
            result = {};
          }
      }

      if (!result) {
        result = {};
      }

      if (!result.msg && typeof data === 'string' && data.trim().length > 0) {
        result.msg = data;
      } else if (
        !result.msg &&
        data &&
        typeof data === 'object' &&
        typeof data.message === 'string' &&
        data.message.trim().length > 0
      ) {
        result.msg = data.message;
      }

      result.status = normalizedStatus;

      if (result.isAuth === undefined) {
        // No access and no valid session: signing in may give access. The backend reads an
        // expired token as anonymous, and the cookie outlives the token.
        const token = JwtTokenConfig.retreiveToken();
        result.isAuth =
          normalizedStatus === 403 && (token === undefined || JwtTokenConfig.isTokenExpired(token));
      }
    }

    // Network related problem ...
    if (!result) {
      result = { msg: 'Unexpected error. Please, try latter' };
    }

    return result;
  };
}
