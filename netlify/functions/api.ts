import {
  JWT_EXPIRATION_MIN,
  UnauthorizedError,
  requireAuth,
  splitDisplayName,
} from './lib/auth';
import type { SessionJwtUser } from './lib/auth';
import {
  BadRequestError,
  emptyResponse,
  extractExpectedVersion,
  jsonResponse,
  normalizeApiPath,
  parsePositiveInt,
  readJsonBody,
  readTextBody,
  resolveOrigin,
  restErrorResponse,
  textResponse,
  unauthorizedResponse,
  xmlResponse,
} from './lib/http';
import {
  NotFoundOrForbiddenError,
  PgMindmapRepository,
  RepoValidationError,
  VersionConflictError,
} from './lib/repo';
import { getDbPool } from './lib/db';
import type { MindmapRepository, RepoUser } from './lib/repo';
import {
  MAP_ASSETS_BUCKET,
  StorageConfigurationError,
  StorageValidationError,
  createDefaultAssetStorageService,
  extractReferencedAssetPaths,
} from './lib/storage';
import type { AssetStorageService, UploadUrlRequestItem } from './lib/storage';
import {
  buildDefaultMindmapXml,
  validateDescription,
  validateLabelInput,
  validateMindmapXml,
  validateNoteContent,
  validateTitle,
} from './lib/validators';
import { createOAuthHandler } from './oauth';
import type { OAuthHandlerDeps } from './oauth';

export interface ApiHandlerDeps {
  repo?: MindmapRepository;
  authenticate?: (req: Request) => Promise<SessionJwtUser>;
  oauthHandler?: (req: Request, context?: unknown) => Promise<Response>;
  oauthDeps?: OAuthHandlerDeps;
  assetStorage?: AssetStorageService;
}

const VALID_LOCALE_REGEX = /^[a-z]{2}(?:-[A-Z]{2})?$/;

function toRepoUser(auth: SessionJwtUser): RepoUser {
  return {
    uid: auth.uid,
    email: auth.email,
    name: auth.name,
  };
}

function handleError(req: Request, err: unknown): Response {
  if (err instanceof UnauthorizedError) {
    return unauthorizedResponse(req);
  }
  if (err instanceof BadRequestError) {
    return restErrorResponse(req, 400, err.restErrors.globalErrors, {
      fieldErrors: err.restErrors.fieldErrors,
      globalSeverity: err.restErrors.globalSeverity,
      errorCode: err.restErrors.errorCode,
    });
  }
  if (err instanceof RepoValidationError) {
    return restErrorResponse(req, 400, err.globalErrors, {
      fieldErrors: err.fieldErrors,
      globalSeverity: 'WARNING',
      errorCode: err.errorCode,
    });
  }
  if (err instanceof NotFoundOrForbiddenError) {
    return restErrorResponse(req, 403, [err.message], {
      globalSeverity: 'WARNING',
      errorCode: err.errorCode,
    });
  }
  if (err instanceof VersionConflictError) {
    return restErrorResponse(req, 409, [err.message], {
      globalSeverity: 'WARNING',
      errorCode: 'MINDMAP_VERSION_CONFLICT',
      currentVersion: err.currentVersion,
      extraHeaders: {
        'X-Mindmap-Version': String(err.currentVersion),
      },
    });
  }
  if (err instanceof StorageValidationError) {
    return restErrorResponse(req, 400, [err.message], {
      globalSeverity: 'WARNING',
      errorCode: err.errorCode,
    });
  }
  if (err instanceof StorageConfigurationError) {
    return restErrorResponse(req, 503, [err.message], {
      globalSeverity: 'WARNING',
      errorCode: err.errorCode,
    });
  }
  console.error('[api] Unhandled error:', err);
  return restErrorResponse(req, 500, ['Internal server error.'], {
    globalSeverity: 'SEVERE',
    errorCode: 'INTERNAL_ERROR',
  });
}

function parseMinorParam(url: URL): boolean {
  return url.searchParams.get('minor')?.toLowerCase() === 'true';
}

export function createApiHandler(
  deps: ApiHandlerDeps = {},
): (req: Request, context?: unknown) => Promise<Response> {
  const repo: MindmapRepository = deps.repo ?? new PgMindmapRepository();
  const authenticate = deps.authenticate ?? requireAuth;
  const oauthHandler = deps.oauthHandler ?? createOAuthHandler(deps.oauthDeps);
  const resolveAssetStorage = (): AssetStorageService =>
    deps.assetStorage ?? createDefaultAssetStorageService();

  const cleanupOrphansBestEffort = async (user: RepoUser): Promise<void> => {
    try {
      const storage = resolveAssetStorage();
      const xmls = await repo.listAllXmlForOwner(user);
      const referenced = extractReferencedAssetPaths(xmls, MAP_ASSETS_BUCKET);
      await storage.cleanupOrphanedAssets(user.uid, referenced);
    } catch (err) {
      if (!(err instanceof StorageConfigurationError)) {
        console.warn('[api] Best-effort orphan asset cleanup failed:', err);
      }
    }
  };

  return async (req: Request, context?: unknown): Promise<Response> => {
    const method = req.method.toUpperCase();
    if (method === 'OPTIONS') {
      return emptyResponse(req, 204);
    }

    const url = new URL(req.url);
    const path = normalizeApiPath(url);

    // Defense-in-depth: if /api/restful/oauth2/* reaches api handler directly, delegate to oauthHandler
    if (path.startsWith('/oauth2/')) {
      if (path === '/oauth2/callback' || path === '/oauth2/googlecallback') {
        return oauthHandler(req, context);
      }
      return restErrorResponse(req, 400, ['Unsupported OAuth2 endpoint.'], {
        globalSeverity: 'WARNING',
        errorCode: 'UNSUPPORTED_OAUTH_ENDPOINT',
      });
    }

    try {
      // -----------------------------------------------------------------------
      // Public endpoints (no Bearer JWT required)
      // -----------------------------------------------------------------------
      if (path === '/app/config') {
        if (method !== 'GET') {
          return restErrorResponse(req, 405, ['Method not allowed.'], {
            globalSeverity: 'WARNING',
            errorCode: 'METHOD_NOT_ALLOWED',
          });
        }
        const origin = resolveOrigin(req);
        return jsonResponse(req, 200, {
          apiBaseUrl: origin,
          uiBaseUrl: origin,
          clientType: 'rest',
          googleOauth2Enabled: true,
          googleOauth2Url: `${origin}/oauth2/authorization/google`,
          facebookOauth2Enabled: false,
          facebookOauth2Url: '',
          oidcOauth2Enabled: false,
          localLoginEnabled: false,
          registrationEnabled: false,
          recaptcha2Enabled: false,
          jwtExpirationMin: JWT_EXPIRATION_MIN,
        });
      }

      if (path === '/authenticate' && method === 'POST') {
        return restErrorResponse(
          req,
          401,
          [
            'Sign-in with email and password is disabled on this site. Please use the Google Sign-In button to login.',
          ],
          {
            globalSeverity: 'WARNING',
            errorCode: 'LOCAL_LOGIN_DISABLED',
          },
        );
      }

      if (path === '/logout' && method === 'POST') {
        return emptyResponse(req, 200);
      }

      // Disabled public/admin/registration endpoints
      if (path.startsWith('/admin') || path.startsWith('/users')) {
        return restErrorResponse(req, 403, ['This endpoint is disabled in private mode.'], {
          globalSeverity: 'WARNING',
          errorCode: 'ENDPOINT_DISABLED',
        });
      }

      // -----------------------------------------------------------------------
      // Authenticated endpoints (require valid 7d JWT + ALLOWED_EMAIL)
      // -----------------------------------------------------------------------
      const auth = await authenticate(req);
      const user = toRepoUser(auth);

      // Account routes
      if (path === '/account') {
        if (method === 'GET') {
          const { firstname, lastname } = splitDisplayName(auth.name, auth.email);
          let avatarUrl = auth.avatarUrl;
          if (!avatarUrl) {
            try {
              const pool = getDbPool();
              const userRes = await pool.query<{ avatar: string }>(
                `SELECT COALESCE(raw_user_meta_data->>'avatar_url', raw_user_meta_data->>'picture') as avatar FROM auth.users WHERE id = $1 LIMIT 1;`,
                [auth.uid],
              );
              if (userRes.rows[0]?.avatar) {
                avatarUrl = userRes.rows[0].avatar;
              }
            } catch {
              // Ignore DB lookup error and use default
            }
          }
          return jsonResponse(req, 200, {
            id: 1,
            email: auth.email,
            firstname,
            lastname,
            fullName: auth.name,
            avatarUrl: avatarUrl || undefined,
            locale: 'zh',
            authenticationType: 'GOOGLE_OAUTH2',
            allowSendEmail: false,
            creationDate: new Date(0).toISOString(),
            isActive: true,
            isSuspended: false,
            isAdmin: false,
          });
        }
        if (method === 'DELETE') {
          return restErrorResponse(
            req,
            403,
            ['Account deletion is disabled in single-owner private mode.'],
            {
              globalSeverity: 'WARNING',
              errorCode: 'ACCOUNT_DELETE_DISABLED',
            },
          );
        }
      }

      if (path === '/account/firstname' && method === 'PUT') {
        const raw = (await readTextBody(req)).trim();
        if (!raw || raw.length > 255) {
          return restErrorResponse(req, 400, ['First name must be between 1 and 255 characters.'], {
            fieldErrors: { firstname: 'First name must be between 1 and 255 characters.' },
            globalSeverity: 'WARNING',
          });
        }
        return emptyResponse(req, 204);
      }

      if (path === '/account/lastname' && method === 'PUT') {
        const raw = (await readTextBody(req)).trim();
        if (!raw || raw.length > 255) {
          return restErrorResponse(req, 400, ['Last name must be between 1 and 255 characters.'], {
            fieldErrors: { lastname: 'Last name must be between 1 and 255 characters.' },
            globalSeverity: 'WARNING',
          });
        }
        return emptyResponse(req, 204);
      }

      if (path === '/account/locale' && method === 'PUT') {
        const raw = (await readTextBody(req)).trim();
        if (!raw || !VALID_LOCALE_REGEX.test(raw)) {
          return restErrorResponse(req, 400, ['Invalid locale code.'], {
            fieldErrors: { locale: 'Invalid locale code.' },
            globalSeverity: 'WARNING',
          });
        }
        return emptyResponse(req, 204);
      }

      if (path === '/account/password' && method === 'PUT') {
        return restErrorResponse(
          req,
          400,
          ['Password changes are not allowed for Google OAuth accounts.'],
          {
            globalSeverity: 'WARNING',
            errorCode: 'PASSWORD_CHANGE_NOT_ALLOWED',
          },
        );
      }

      // Asset storage routes: /assets/*
      if (path === '/assets/upload-urls' && method === 'POST') {
        const body = await readJsonBody<{ items?: UploadUrlRequestItem[] }>(req);
        const storage = resolveAssetStorage();
        const items = await storage.issueSignedUploadUrls(user.uid, body.items ?? []);
        return jsonResponse(req, 200, {
          bucket: MAP_ASSETS_BUCKET,
          items,
        });
      }

      if (path === '/assets/stats' && method === 'GET') {
        const [dbStats, xmls] = await Promise.all([
          repo.getOwnerXmlStats(user),
          repo.listAllXmlForOwner(user),
        ]);
        const referenced = extractReferencedAssetPaths(xmls, MAP_ASSETS_BUCKET);
        let storageSummary: {
          bucket: string;
          objectCount: number;
          totalBytes: number;
          configured: boolean;
          orphanCount?: number;
          orphanBytes?: number;
        } = {
          bucket: MAP_ASSETS_BUCKET,
          objectCount: 0,
          totalBytes: 0,
          configured: false,
          orphanCount: 0,
          orphanBytes: 0,
        };
        try {
          storageSummary = await resolveAssetStorage().getStorageUsage(user.uid, referenced);
        } catch (err) {
          if (!(err instanceof StorageConfigurationError)) {
            throw err;
          }
        }
        return jsonResponse(req, 200, {
          db: dbStats,
          storage: storageSummary,
        });
      }

      if (path === '/assets/cleanup' && method === 'POST') {
        const storage = resolveAssetStorage();
        const xmls = await repo.listAllXmlForOwner(user);
        const referenced = extractReferencedAssetPaths(xmls, MAP_ASSETS_BUCKET);
        const result = await storage.cleanupOrphanedAssets(user.uid, referenced);
        return jsonResponse(req, 200, result);
      }

      // Note validation endpoint (must match before /maps/{id})
      if (path === '/maps/validate-note' && method === 'POST') {
        const note = await readTextBody(req);
        return jsonResponse(req, 200, validateNoteContent(note));
      }

      // Batch delete endpoint (must match before /maps/{id})
      if (path === '/maps/batch' && method === 'DELETE') {
        const idsParam = url.searchParams.get('ids')?.trim() ?? '';
        if (!idsParam) {
          throw new BadRequestError(['Missing required query parameter: ids.'], {
            globalSeverity: 'WARNING',
            errorCode: 'INVALID_BATCH_IDS',
          });
        }
        const parts = idsParam.split(',').map((p) => p.trim());
        if (parts.length === 0 || parts.some((p) => p.length === 0)) {
          throw new BadRequestError(['Malformed ids query parameter.'], {
            globalSeverity: 'WARNING',
            errorCode: 'INVALID_BATCH_IDS',
          });
        }
        const ids = parts.map((p) => parsePositiveInt(p, 'ids'));
        await repo.deleteMapsBatch(user, ids);
        await cleanupOrphansBestEffort(user);
        return emptyResponse(req, 204);
      }

      // Collection: GET/POST /maps
      if (path === '/maps') {
        if (method === 'GET') {
          const filter = url.searchParams.get('q') ?? undefined;
          const maps = await repo.listMaps(user, filter);
          return jsonResponse(req, 200, {
            count: maps.length,
            mindmapsInfo: maps.map((m) => ({
              id: m.id,
              title: m.title,
              description: m.description,
              folderPath: m.folderPath,
              creator: user.name,
              lastModifierUser: m.lastModificationBy || user.name,
              role: 'owner',
              creationTime: m.creationTime,
              lastModificationTime: m.lastModificationTime,
              public: false,
              spamDetected: false,
              starred: m.starred,
              labels: m.labels,
              version: m.version,
            })),
          });
        }

        if (method === 'POST') {
          const titleCheck = validateTitle(url.searchParams.get('title'));
          const descCheck = validateDescription(url.searchParams.get('description'));
          const fieldErrors: Record<string, string> = {};
          if (!titleCheck.valid) {
            fieldErrors['title'] = titleCheck.message;
          }
          if (!descCheck.valid) {
            fieldErrors['description'] = descCheck.message;
          }
          if (Object.keys(fieldErrors).length > 0) {
            return restErrorResponse(req, 400, [], {
              fieldErrors,
              globalSeverity: 'WARNING',
            });
          }

          const title = (titleCheck as { valid: true; value: string }).value;
          const description = (descCheck as { valid: true; value: string }).value;
          const folderPath = url.searchParams.get('folderPath')?.trim() || '';
          const overwrite = url.searchParams.get('overwrite') === 'true';
          const layout = url.searchParams.get('layout')?.trim() || 'mindmap';

          const rawBody = await readTextBody(req);
          let xml: string;
          if (rawBody.trim().length > 0) {
            const xmlCheck = validateMindmapXml(rawBody);
            if (!xmlCheck.valid) {
              return restErrorResponse(req, 400, [xmlCheck.message], {
                globalSeverity: 'WARNING',
                errorCode: xmlCheck.errorCode,
              });
            }
            xml = xmlCheck.trimmed;
          } else {
            xml = buildDefaultMindmapXml(title, layout);
          }

          const created = await repo.createMap(user, {
            title,
            description,
            xml,
            folderPath,
            overwrite,
          });
          if (overwrite) {
            await cleanupOrphansBestEffort(user);
          }
          return emptyResponse(req, 201, {
            Location: `/api/restful/maps/${created.id}`,
            ResourceId: String(created.id),
            'X-Mindmap-Version': String(created.version),
          });
        }
      }

      // Labels collection: GET/POST /labels
      if (path === '/labels') {
        if (method === 'GET') {
          const labels = await repo.listLabels(user);
          return jsonResponse(req, 200, { labels });
        }

        if (method === 'POST') {
          const body = await readJsonBody<{
            title?: unknown;
            color?: unknown;
            parentLabelId?: unknown;
          }>(req);
          const queryTitle = url.searchParams.get('title');
          const labelCheck = validateLabelInput(queryTitle ?? body.title, body.color);
          if (!labelCheck.valid) {
            return restErrorResponse(req, 400, [], {
              fieldErrors: labelCheck.fieldErrors,
              globalSeverity: 'WARNING',
            });
          }
          const parentLabelId =
            body.parentLabelId !== undefined && body.parentLabelId !== null
              ? parsePositiveInt(String(body.parentLabelId), 'parentLabelId')
              : undefined;

          const created = await repo.createLabel(user, {
            title: labelCheck.title,
            color: labelCheck.color,
            parentLabelId,
          });
          return emptyResponse(req, 201, {
            Location: `/api/restful/labels/${created.id}`,
            ResourceId: String(created.id),
          });
        }
      }

      // DELETE /labels/{id}
      const labelMatch = /^\/labels\/([^/]+)$/.exec(path);
      if (labelMatch && method === 'DELETE') {
        const labelId = parsePositiveInt(labelMatch[1], 'labelId');
        await repo.deleteLabel(user, labelId);
        return emptyResponse(req, 204);
      }

      // -----------------------------------------------------------------------
      // Map-scoped routes: /maps/{id}...
      // -----------------------------------------------------------------------

      // GET /maps/{id}/{hid}/document/xml
      const historyXmlMatch = /^\/maps\/([^/]+)\/([^/]+)\/document\/xml$/.exec(path);
      if (historyXmlMatch && method === 'GET') {
        const mapId = parsePositiveInt(historyXmlMatch[1], 'mapId');
        const historyId = parsePositiveInt(historyXmlMatch[2], 'historyId');
        const xml = await repo.getHistoryXml(user, mapId, historyId);
        return xmlResponse(req, 200, xml);
      }

      // POST /maps/{id}/history/{hid}
      const historyRevertMatch = /^\/maps\/([^/]+)\/history\/([^/]+)$/.exec(path);
      if (historyRevertMatch && method === 'POST') {
        const mapId = parsePositiveInt(historyRevertMatch[1], 'mapId');
        const rawHid = historyRevertMatch[2];
        const historyId: number | 'latest' =
          rawHid === 'latest' ? 'latest' : parsePositiveInt(rawHid, 'historyId');
        const result = await repo.revertHistory(user, mapId, historyId);
        return emptyResponse(req, 204, {
          'X-Mindmap-Version': String(result.version),
        });
      }

      // GET /maps/{id}/history
      const historyListMatch = /^\/maps\/([^/]+)\/history$/.exec(path);
      if (historyListMatch && method === 'GET') {
        const mapId = parsePositiveInt(historyListMatch[1], 'mapId');
        const changes = await repo.listHistory(user, mapId);
        return jsonResponse(req, 200, {
          count: changes.length,
          changes: changes.map((c) => ({
            id: c.id,
            creationTime: c.creationTime,
            creator: c.editorName || user.name,
          })),
        });
      }

      // DELETE /maps/{id}/labels/{lid}
      const mapLabelDeleteMatch = /^\/maps\/([^/]+)\/labels\/([^/]+)$/.exec(path);
      if (mapLabelDeleteMatch && method === 'DELETE') {
        const mapId = parsePositiveInt(mapLabelDeleteMatch[1], 'mapId');
        const labelId = parsePositiveInt(mapLabelDeleteMatch[2], 'labelId');
        await repo.removeLabelFromMap(user, mapId, labelId);
        return emptyResponse(req, 204);
      }

      // POST /maps/{id}/labels (raw integer JSON body)
      const mapLabelsMatch = /^\/maps\/([^/]+)\/labels$/.exec(path);
      if (mapLabelsMatch && method === 'POST') {
        const mapId = parsePositiveInt(mapLabelsMatch[1], 'mapId');
        const parsed = await readJsonBody<unknown>(req);
        if (typeof parsed !== 'number' || !Number.isSafeInteger(parsed) || parsed < 1) {
          throw new BadRequestError(['Label id must be a positive integer.'], {
            globalSeverity: 'WARNING',
            errorCode: 'INVALID_LABEL_ID',
          });
        }
        await repo.addLabelToMap(user, mapId, parsed);
        return emptyResponse(req, 200);
      }

      // GET /maps/{id}/metadata
      const metadataMatch = /^\/maps\/([^/]+)\/metadata$/.exec(path);
      if (metadataMatch && method === 'GET') {
        const mapId = parsePositiveInt(metadataMatch[1], 'mapId');
        const includeXml = url.searchParams.get('xml')?.toLowerCase() === 'true';
        const map = await repo.getMap(user, mapId);
        return jsonResponse(
          req,
          200,
          {
            jsonProps: map.properties,
            locked: false,
            title: map.title,
            isLockedBy: null,
            creatorFullName: user.name,
            role: 'owner',
            description: map.description,
            folderPath: map.folderPath,
            createdBy: user.email,
            creationTime: map.creationTime,
            lastModificationBy: map.lastModificationBy || user.name,
            lastModificationTime: map.lastModificationTime,
            starred: map.starred,
            public: false,
            version: map.version,
            ...(includeXml ? { xml: map.xml } : {}),
          },
          {
            'X-Mindmap-Version': String(map.version),
          },
        );
      }

      // PUT /maps/{id}/document
      const documentMatch = /^\/maps\/([^/]+)\/document$/.exec(path);
      if (documentMatch && method === 'PUT') {
        const mapId = parsePositiveInt(documentMatch[1], 'mapId');
        const minor = parseMinorParam(url);
        const body = await readJsonBody<{
          id?: unknown;
          xml?: unknown;
          properties?: unknown;
          version?: unknown;
        }>(req);

        if (body.properties === null || body.properties === undefined || typeof body.properties !== 'string') {
          return restErrorResponse(req, 400, ['Map properties must be provided as a string.'], {
            globalSeverity: 'WARNING',
            errorCode: 'INVALID_PROPERTIES',
          });
        }

        const xmlCheck = validateMindmapXml(body.xml);
        if (!xmlCheck.valid) {
          return restErrorResponse(req, 400, [xmlCheck.message], {
            globalSeverity: 'WARNING',
            errorCode: xmlCheck.errorCode,
          });
        }

        const expectedVersion = extractExpectedVersion(req, body.version);
        const result = await repo.updateDocument(user, mapId, {
          xml: xmlCheck.trimmed,
          properties: body.properties,
          minor,
          expectedVersion,
        });

        return emptyResponse(req, 204, {
          'X-Mindmap-Version': String(result.version),
        });
      }

      // GET /maps/{id}/document/xml-pub (disabled)
      const docXmlPubMatch = /^\/maps\/([^/]+)\/document\/xml-pub$/.exec(path);
      if (docXmlPubMatch && method === 'GET') {
        return restErrorResponse(req, 403, ['Public sharing is disabled in private single-owner mode.'], {
          globalSeverity: 'WARNING',
          errorCode: 'PUBLIC_SHARING_DISABLED',
        });
      }

      // GET/PUT /maps/{id}/document/xml
      const docXmlMatch = /^\/maps\/([^/]+)\/document\/xml$/.exec(path);
      if (docXmlMatch) {
        const mapId = parsePositiveInt(docXmlMatch[1], 'mapId');
        if (method === 'GET') {
          const { xml, version } = await repo.getMapXml(user, mapId);
          return xmlResponse(req, 200, xml, {
            'X-Mindmap-Version': String(version),
          });
        }
        if (method === 'PUT') {
          const rawXml = await readTextBody(req);
          const xmlCheck = validateMindmapXml(rawXml);
          if (!xmlCheck.valid) {
            return restErrorResponse(req, 400, [xmlCheck.message], {
              globalSeverity: 'WARNING',
              errorCode: xmlCheck.errorCode,
            });
          }
          const expectedVersion = extractExpectedVersion(req);
          const result = await repo.updateDocument(user, mapId, {
            xml: xmlCheck.trimmed,
            minor: false,
            expectedVersion,
          });
          return emptyResponse(req, 200, {
            'X-Mindmap-Version': String(result.version),
          });
        }
      }

      // PUT /maps/{id}/title
      const titleMatch = /^\/maps\/([^/]+)\/title$/.exec(path);
      if (titleMatch && method === 'PUT') {
        const mapId = parsePositiveInt(titleMatch[1], 'mapId');
        const rawTitle = await readTextBody(req);
        const titleCheck = validateTitle(rawTitle);
        if (!titleCheck.valid) {
          return restErrorResponse(req, 400, [], {
            fieldErrors: { title: titleCheck.message },
            globalSeverity: 'WARNING',
          });
        }
        await repo.updateTitle(user, mapId, titleCheck.value);
        return emptyResponse(req, 204);
      }

      // PUT /maps/{id}/description
      const descMatch = /^\/maps\/([^/]+)\/description$/.exec(path);
      if (descMatch && method === 'PUT') {
        const mapId = parsePositiveInt(descMatch[1], 'mapId');
        const rawDesc = await readTextBody(req);
        if (rawDesc.length === 0) {
          return restErrorResponse(req, 400, [], {
            fieldErrors: { description: 'Description body must not be empty.' },
            globalSeverity: 'WARNING',
          });
        }
        const descCheck = validateDescription(rawDesc);
        if (!descCheck.valid) {
          return restErrorResponse(req, 400, [], {
            fieldErrors: { description: descCheck.message },
            globalSeverity: 'WARNING',
          });
        }
        await repo.updateDescription(user, mapId, descCheck.value);
        return emptyResponse(req, 204);
      }

      // GET/PUT /maps/{id}/starred
      const starredMatch = /^\/maps\/([^/]+)\/starred$/.exec(path);
      if (starredMatch) {
        const mapId = parsePositiveInt(starredMatch[1], 'mapId');
        if (method === 'GET') {
          const starred = await repo.getStarred(user, mapId);
          return textResponse(req, 200, starred ? 'true' : 'false');
        }
        if (method === 'PUT') {
          const raw = (await readTextBody(req)).trim().toLowerCase();
          if (raw !== 'true' && raw !== 'false') {
            return restErrorResponse(req, 400, ['Starred value must be "true" or "false".'], {
              globalSeverity: 'WARNING',
              errorCode: 'INVALID_BOOLEAN',
            });
          }
          await repo.updateStarred(user, mapId, raw === 'true');
          return emptyResponse(req, 204);
        }
      }

      // PUT /maps/{id}/lock
      const lockMatch = /^\/maps\/([^/]+)\/lock$/.exec(path);
      if (lockMatch && method === 'PUT') {
        const mapId = parsePositiveInt(lockMatch[1], 'mapId');
        const raw = (await readTextBody(req)).trim().toLowerCase();
        if (raw !== 'true' && raw !== 'false') {
          return restErrorResponse(req, 400, ['Lock value must be "true" or "false".'], {
            globalSeverity: 'WARNING',
            errorCode: 'INVALID_BOOLEAN',
          });
        }
        await repo.assertMapOwned(user, mapId);
        if (raw === 'true') {
          return jsonResponse(req, 200, { email: user.email });
        }
        return emptyResponse(req, 204);
      }

      // PUT /maps/{id}/publish
      const publishMatch = /^\/maps\/([^/]+)\/publish$/.exec(path);
      if (publishMatch && method === 'PUT') {
        const mapId = parsePositiveInt(publishMatch[1], 'mapId');
        const body = await readJsonBody<{ isPublic?: unknown }>(req);
        if (typeof body.isPublic !== 'boolean') {
          return restErrorResponse(req, 400, ['Field "isPublic" must be a boolean.'], {
            globalSeverity: 'WARNING',
            errorCode: 'INVALID_PUBLISH_PAYLOAD',
          });
        }
        await repo.assertMapOwned(user, mapId);
        if (body.isPublic) {
          return restErrorResponse(
            req,
            403,
            ['Public sharing is disabled in private single-owner mode.'],
            {
              globalSeverity: 'WARNING',
              errorCode: 'PUBLIC_SHARING_DISABLED',
            },
          );
        }
        return emptyResponse(req, 204);
      }

      // /maps/{id}/collabs*
      const collabsMatch = /^\/maps\/([^/]+)\/collabs(?:\/.*)?$/.exec(path);
      if (collabsMatch) {
        const mapId = parsePositiveInt(collabsMatch[1], 'mapId');
        await repo.assertMapOwned(user, mapId);
        if (method === 'GET') {
          return jsonResponse(req, 200, {
            count: 1,
            collaborations: [
              {
                id: 1,
                email: user.email,
                name: user.name,
                role: 'owner',
              },
            ],
          });
        }
        return restErrorResponse(
          req,
          403,
          ['Collaboration is disabled in private single-owner mode.'],
          {
            globalSeverity: 'WARNING',
            errorCode: 'COLLABORATION_DISABLED',
          },
        );
      }

      // /maps/{id}: GET, POST (duplicate), PUT, DELETE
      const mapMatch = /^\/maps\/([^/]+)$/.exec(path);
      if (mapMatch) {
        const mapId = parsePositiveInt(mapMatch[1], 'mapId');

        if (method === 'GET') {
          const map = await repo.getMap(user, mapId);
          return jsonResponse(
            req,
            200,
            {
              id: map.id,
              title: map.title,
              description: map.description,
              creator: user.email,
              owner: user.email,
              lastModifierUser: {
                email: user.email,
                creationDate: map.lastModificationTime,
              },
              creationTime: map.creationTime,
              lastModificationTime: map.lastModificationTime,
              public: false,
              spamDetected: false,
              starred: map.starred,
              properties: map.properties,
              xml: map.xml,
              version: map.version,
            },
            {
              'X-Mindmap-Version': String(map.version),
            },
          );
        }

        if (method === 'POST') {
          const body = await readJsonBody<{ title?: unknown; description?: unknown }>(req);
          const titleCheck = validateTitle(body.title);
          const descCheck = validateDescription(body.description);
          const fieldErrors: Record<string, string> = {};
          if (!titleCheck.valid) {
            fieldErrors['title'] = titleCheck.message;
          }
          if (!descCheck.valid) {
            fieldErrors['description'] = descCheck.message;
          }
          if (Object.keys(fieldErrors).length > 0) {
            return restErrorResponse(req, 400, [], {
              fieldErrors,
              globalSeverity: 'WARNING',
            });
          }

          const created = await repo.duplicateMap(user, mapId, {
            title: (titleCheck as { valid: true; value: string }).value,
            description:
              body.description !== undefined
                ? (descCheck as { valid: true; value: string }).value
                : undefined,
          });
          return emptyResponse(req, 201, {
            Location: `/api/restful/maps/${created.id}`,
            ResourceId: String(created.id),
            'X-Mindmap-Version': String(created.version),
          });
        }

        if (method === 'PUT') {
          const minor = parseMinorParam(url);
          const body = await readJsonBody<{
            xml?: unknown;
            title?: unknown;
            description?: unknown;
            properties?: unknown;
            version?: unknown;
          }>(req);

          const fieldErrors: Record<string, string> = {};
          let validatedTitle: string | undefined;
          if (body.title !== undefined) {
            const titleCheck = validateTitle(body.title);
            if (!titleCheck.valid) {
              fieldErrors['title'] = titleCheck.message;
            } else {
              validatedTitle = titleCheck.value;
            }
          }

          let validatedDescription: string | undefined;
          if (body.description !== undefined) {
            const descCheck = validateDescription(body.description);
            if (!descCheck.valid) {
              fieldErrors['description'] = descCheck.message;
            } else {
              validatedDescription = descCheck.value;
            }
          }

          if (Object.keys(fieldErrors).length > 0) {
            return restErrorResponse(req, 400, [], {
              fieldErrors,
              globalSeverity: 'WARNING',
            });
          }

          let validatedXml: string | undefined;
          if (body.xml !== undefined) {
            const xmlCheck = validateMindmapXml(body.xml);
            if (!xmlCheck.valid) {
              return restErrorResponse(req, 400, [xmlCheck.message], {
                globalSeverity: 'WARNING',
                errorCode: xmlCheck.errorCode,
              });
            }
            validatedXml = xmlCheck.trimmed;
          }

          let validatedProperties: string | undefined;
          if (body.properties !== undefined) {
            if (typeof body.properties !== 'string') {
              return restErrorResponse(req, 400, ['Properties must be a string.'], {
                globalSeverity: 'WARNING',
                errorCode: 'INVALID_PROPERTIES',
              });
            }
            validatedProperties = body.properties;
          }

          const expectedVersion = extractExpectedVersion(req, body.version);
          const result = await repo.updateMap(user, mapId, {
            xml: validatedXml,
            properties: validatedProperties,
            title: validatedTitle,
            description: validatedDescription,
            minor,
            expectedVersion,
          });

          return emptyResponse(req, 204, {
            'X-Mindmap-Version': String(result.version),
          });
        }

        if (method === 'DELETE') {
          await repo.deleteMap(user, mapId);
          await cleanupOrphansBestEffort(user);
          return emptyResponse(req, 204);
        }
      }

      return restErrorResponse(req, 404, ['API endpoint not found.'], {
        globalSeverity: 'WARNING',
        errorCode: 'NOT_FOUND',
      });
    } catch (err) {
      return handleError(req, err);
    }
  };
}

export default createApiHandler();
