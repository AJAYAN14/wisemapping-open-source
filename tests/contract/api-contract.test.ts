import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApiHandler } from '../../api/_core/api';
import {
  InMemoryMindmapRepo,
  TEST_JWT_SECRET,
  TEST_OWNER_EMAIL,
  signTestJwt,
} from './test-helpers';

describe('API Contract Tests (/api/restful/*)', () => {
  const originalEnv = { ...process.env };
  let repo: InMemoryMindmapRepo;
  let handler: (req: Request, context?: unknown) => Promise<Response>;
  let authToken: string;

  beforeEach(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    delete process.env.ALLOWED_EMAIL;
    repo = new InMemoryMindmapRepo();
    handler = createApiHandler({ repo });
    authToken = await signTestJwt();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function authHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${authToken}`,
      ...extra,
    };
  }

  it('serves dynamic non-empty /app/config and enforces Google-only auth flags', async () => {
    const res = await handler(
      new Request('https://internal/api/wm-api/app/config', {
        headers: {
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'wisemapping-private.vercel.app',
        },
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-expose-headers')).toContain('X-Mindmap-Version');
    expect(res.headers.get('access-control-expose-headers')).toContain('ResourceId');
    expect(res.headers.get('access-control-expose-headers')).toContain('Location');

    const config = (await res.json()) as Record<string, unknown>;
    expect(config).toMatchObject({
      apiBaseUrl: 'https://wisemapping-private.vercel.app',
      uiBaseUrl: 'https://wisemapping-private.vercel.app',
      clientType: 'rest',
      googleOauth2Enabled: true,
      googleOauth2Url: 'https://wisemapping-private.vercel.app/oauth2/authorization/google',
      facebookOauth2Enabled: false,
      oidcOauth2Enabled: false,
      localLoginEnabled: false,
      registrationEnabled: false,
      recaptcha2Enabled: false,
      jwtExpirationMin: 10080,
    });
  });

  it('handles OPTIONS preflight, disabled /authenticate, idempotent /logout, and 401 unauthorized', async () => {
    const optRes = await handler(
      new Request('http://localhost:8888/api/restful/maps', { method: 'OPTIONS' }),
    );
    expect(optRes.status).toBe(204);
    expect(optRes.headers.get('access-control-allow-methods')).toContain('PUT');

    const authDisabled = await handler(
      new Request('http://localhost:8888/api/restful/authenticate', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_OWNER_EMAIL, password: 'pw' }),
      }),
    );
    expect(authDisabled.status).toBe(401);
    const authErr = (await authDisabled.json()) as { errorCode: string; globalErrors: string[] };
    expect(authErr.errorCode).toBe('LOCAL_LOGIN_DISABLED');
    expect(authErr.globalErrors.length).toBeGreaterThan(0);

    const logoutRes = await handler(
      new Request('http://localhost:8888/api/restful/logout', { method: 'POST' }),
    );
    expect(logoutRes.status).toBe(200);

    const unauthRes = await handler(new Request('http://localhost:8888/api/restful/maps'));
    expect(unauthRes.status).toBe(401);
    expect(await unauthRes.json()).toEqual({ msg: 'Unauthorized' });

    const nonAllowlistedToken = await signTestJwt({ email: 'other@gmail.com' });
    const wrongUserRes = await handler(
      new Request('http://localhost:8888/api/restful/maps', {
        headers: { Authorization: `Bearer ${nonAllowlistedToken}` },
      }),
    );
    expect(wrongUserRes.status).toBe(401);
    expect(await wrongUserRes.json()).toEqual({ msg: 'Unauthorized' });
  });

  it('implements account endpoints with GOOGLE_OAUTH2 and single-owner protections', async () => {
    const getAcc = await handler(
      new Request('http://localhost:8888/api/restful/account', {
        headers: authHeaders(),
      }),
    );
    expect(getAcc.status).toBe(200);
    expect(await getAcc.json()).toMatchObject({
      email: TEST_OWNER_EMAIL,
      authenticationType: 'GOOGLE_OAUTH2',
      isAdmin: false,
    });

    const putFirst = await handler(
      new Request('http://localhost:8888/api/restful/account/firstname', {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'text/plain' }),
        body: 'Alex',
      }),
    );
    expect(putFirst.status).toBe(204);

    const putLast = await handler(
      new Request('http://localhost:8888/api/restful/account/lastname', {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'text/plain' }),
        body: 'Jian',
      }),
    );
    expect(putLast.status).toBe(204);

    const putLocale = await handler(
      new Request('http://localhost:8888/api/restful/account/locale', {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'text/plain' }),
        body: 'zh-CN',
      }),
    );
    expect(putLocale.status).toBe(204);

    const putBadLocale = await handler(
      new Request('http://localhost:8888/api/restful/account/locale', {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'text/plain' }),
        body: 'invalid_locale_string',
      }),
    );
    expect(putBadLocale.status).toBe(400);

    const putPw = await handler(
      new Request('http://localhost:8888/api/restful/account/password', {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'text/plain' }),
        body: 'newsecret',
      }),
    );
    expect(putPw.status).toBe(400);

    const delAcc = await handler(
      new Request('http://localhost:8888/api/restful/account', {
        method: 'DELETE',
        headers: authHeaders(),
      }),
    );
    expect(delAcc.status).toBe(403);
    const delBody = (await delAcc.json()) as { errorCode: string };
    expect(delBody.errorCode).toBe('ACCOUNT_DELETE_DISABLED');
  });

  it('supports mindmap CRUD, trailing slashes, Blob document saves, and atomic 409 optimistic locking', async () => {
    // 1. Create map
    const createRes = await handler(
      new Request('http://localhost:8888/api/restful/maps?title=Roadmap&description=Q1&theme=prism', {
        method: 'POST',
        headers: authHeaders(),
      }),
    );
    expect(createRes.status).toBe(201);
    const mapId = Number.parseInt(createRes.headers.get('resourceid')!, 10);
    expect(mapId).toBe(1);
    expect(createRes.headers.get('location')).toBe('/api/restful/maps/1');
    expect(createRes.headers.get('x-mindmap-version')).toBe('1');

    // Duplicate title rejected with 400 fieldErrors.title
    const dupRes = await handler(
      new Request('http://localhost:8888/api/restful/maps?title=Roadmap', {
        method: 'POST',
        headers: authHeaders(),
      }),
    );
    expect(dupRes.status).toBe(400);
    const dupErr = (await dupRes.json()) as { fieldErrors: Record<string, string> };
    expect(dupErr.fieldErrors['title']).toBeTruthy();

    // 2. Metadata & XML endpoints
    const metaRes = await handler(
      new Request(`http://localhost:8888/api/restful/maps/${mapId}/metadata?xml=true`, {
        headers: authHeaders(),
      }),
    );
    expect(metaRes.status).toBe(200);
    expect(metaRes.headers.get('x-mindmap-version')).toBe('1');
    const meta = (await metaRes.json()) as Record<string, unknown>;
    expect(meta['locked']).toBe(false);
    expect(meta['version']).toBe(1);
    expect(typeof meta['xml']).toBe('string');

    const xmlRes = await handler(
      new Request(`http://localhost:8888/api/restful/maps/${mapId}/document/xml`, {
        headers: authHeaders(),
      }),
    );
    expect(xmlRes.status).toBe(200);
    expect(xmlRes.headers.get('content-type')).toContain('application/xml');
    expect(xmlRes.headers.get('x-mindmap-version')).toBe('1');

    // 3. Save document with Blob-style text/plain JSON body -> version 2 (minor=false -> creates history)
    const v2Xml = '<map version="tango"><topic central="true" text="Roadmap v2"/></map>';
    const save1Res = await handler(
      new Request(`http://localhost:8888/api/restful/maps/${mapId}/document?minor=false`, {
        method: 'PUT',
        headers: authHeaders({
          'Content-Type': 'text/plain',
          'X-Mindmap-Version': '1',
        }),
        body: JSON.stringify({ id: mapId, xml: v2Xml, properties: '{"zoom":1.0}', version: 1 }),
      }),
    );
    expect(save1Res.status).toBe(204);
    expect(save1Res.headers.get('x-mindmap-version')).toBe('2');
    expect(repo.getHistoryCount(mapId)).toBe(1);

    // 4. Save document with minor=true -> version 3 (no extra history row)
    const v3Xml = '<map version="tango"><topic central="true" text="Roadmap v3"/></map>';
    const save2Res = await handler(
      new Request(`http://localhost:8888/api/restful/maps/${mapId}/document?minor=true`, {
        method: 'PUT',
        headers: authHeaders({
          'Content-Type': 'application/json; charset=utf-8',
          'X-Mindmap-Version': '2',
        }),
        body: JSON.stringify({ id: mapId, xml: v3Xml, properties: '{"zoom":1.1}', version: 2 }),
      }),
    );
    expect(save2Res.status).toBe(204);
    expect(save2Res.headers.get('x-mindmap-version')).toBe('3');
    expect(repo.getHistoryCount(mapId)).toBe(1);

    // 5. Stale version 1 on PUT /document, PUT /document/xml, and PUT /maps/{id} -> 409 Conflict
    const staleDocRes = await handler(
      new Request(`http://localhost:8888/api/restful/maps/${mapId}/document?minor=false`, {
        method: 'PUT',
        headers: authHeaders({
          'Content-Type': 'application/json; charset=utf-8',
          'X-Mindmap-Version': '1',
        }),
        body: JSON.stringify({
          id: mapId,
          xml: '<map><topic central="true" text="Stale"/></map>',
          properties: '{"zoom":0.8}',
          version: 1,
        }),
      }),
    );
    expect(staleDocRes.status).toBe(409);
    expect(staleDocRes.headers.get('content-type')).toContain('application/json');
    expect(staleDocRes.headers.get('x-mindmap-version')).toBe('3');
    const conflictBody = (await staleDocRes.json()) as {
      globalErrors: string[];
      fieldErrors: Record<string, string>;
      globalSeverity: string;
      errorCode: string;
      currentVersion: number;
    };
    expect(conflictBody.globalSeverity).toBe('WARNING');
    expect(conflictBody.errorCode).toBe('MINDMAP_VERSION_CONFLICT');
    expect(conflictBody.currentVersion).toBe(3);
    expect(conflictBody.globalErrors[0]).toContain('modified');

    const staleXmlRes = await handler(
      new Request(`http://localhost:8888/api/restful/maps/${mapId}/document/xml`, {
        method: 'PUT',
        headers: authHeaders({
          'Content-Type': 'text/plain',
          'If-Match': '"2"',
        }),
        body: '<map><topic central="true" text="Stale XML"/></map>',
      }),
    );
    expect(staleXmlRes.status).toBe(409);

    const staleMapRes = await handler(
      new Request(`http://localhost:8888/api/restful/maps/${mapId}`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          xml: '<map><topic central="true" text="Stale Map"/></map>',
          version: 2,
        }),
      }),
    );
    expect(staleMapRes.status).toBe(409);

    // Confirm DB XML & history were NOT overwritten by stale saves
    const afterXml = await handler(
      new Request(`http://localhost:8888/api/restful/maps/${mapId}/document/xml`, {
        headers: authHeaders(),
      }),
    );
    expect(await afterXml.text()).toBe(v3Xml);
    expect(repo.getHistoryCount(mapId)).toBe(1);
  });

  it('implements history listing, snapshot viewing, revert, labels, starred, lock, publish, and batch delete', async () => {
    // Create 2 maps (2nd via XML import)
    const create1 = await handler(
      new Request('http://localhost:8888/api/restful/maps/?title=Alpha', {
        method: 'POST',
        headers: authHeaders(),
      }),
    );
    const id1 = Number.parseInt(create1.headers.get('resourceid')!, 10);

    const create2 = await handler(
      new Request('http://localhost:8888/api/restful/maps?title=Beta', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/xml' }),
        body: '<map version="tango"><topic central="true" text="Imported"/></map>',
      }),
    );
    expect(create2.status).toBe(201);
    const id2 = Number.parseInt(create2.headers.get('resourceid')!, 10);

    // Save two history snapshots on map 1
    await handler(
      new Request(`http://localhost:8888/api/restful/maps/${id1}/document?minor=false`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          xml: '<map><topic central="true" text="Snap 1"/></map>',
          properties: '{}',
        }),
      }),
    );
    await handler(
      new Request(`http://localhost:8888/api/restful/maps/${id1}/document?minor=false`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          xml: '<map><topic central="true" text="Snap 2"/></map>',
          properties: '{}',
        }),
      }),
    );

    const histRes = await handler(
      new Request(`http://localhost:8888/api/restful/maps/${id1}/history/`, {
        headers: authHeaders(),
      }),
    );
    expect(histRes.status).toBe(200);
    const histBody = (await histRes.json()) as { count: number; changes: Array<{ id: number }> };
    expect(histBody.count).toBe(2);
    const olderHid = histBody.changes[1]!.id;

    const histXmlRes = await handler(
      new Request(`http://localhost:8888/api/restful/maps/${id1}/${olderHid}/document/xml`, {
        headers: authHeaders(),
      }),
    );
    expect(histXmlRes.status).toBe(200);
    expect(await histXmlRes.text()).toContain('Snap 1');

    const revertRes = await handler(
      new Request(`http://localhost:8888/api/restful/maps/${id1}/history/${olderHid}`, {
        method: 'POST',
        headers: authHeaders(),
      }),
    );
    expect(revertRes.status).toBe(204);
    expect(repo.getHistoryCount(id1)).toBe(3);

    const revertLatestRes = await handler(
      new Request(`http://localhost:8888/api/restful/maps/${id1}/history/latest`, {
        method: 'POST',
        headers: authHeaders(),
      }),
    );
    expect(revertLatestRes.status).toBe(204);
    expect(repo.getHistoryCount(id1)).toBe(3);

    // Labels CRUD & attachment (raw int JSON body)
    const createLbl = await handler(
      new Request('http://localhost:8888/api/restful/labels/', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ title: 'Work', color: '#ff0000' }),
      }),
    );
    expect(createLbl.status).toBe(201);
    const lblId = Number.parseInt(createLbl.headers.get('resourceid')!, 10);

    const attachLbl = await handler(
      new Request(`http://localhost:8888/api/restful/maps/${id1}/labels`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(lblId),
      }),
    );
    expect(attachLbl.status).toBe(200);

    // Star map 1 & clear description with ' '
    expect(
      (
        await handler(
          new Request(`http://localhost:8888/api/restful/maps/${id1}/starred`, {
            method: 'PUT',
            headers: authHeaders(),
            body: 'true',
          }),
        )
      ).status,
    ).toBe(204);
    expect(
      await (
        await handler(
          new Request(`http://localhost:8888/api/restful/maps/${id1}/starred`, {
            headers: authHeaders(),
          }),
        )
      ).text(),
    ).toBe('true');

    expect(
      (
        await handler(
          new Request(`http://localhost:8888/api/restful/maps/${id1}/description`, {
            method: 'PUT',
            headers: authHeaders(),
            body: ' ',
          }),
        )
      ).status,
    ).toBe(204);

    // Filter maps by starred, label, and shared_with_me
    const starredList = (await (
      await handler(
        new Request('http://localhost:8888/api/restful/maps/?q=starred', {
          headers: authHeaders(),
        }),
      )
    ).json()) as { count: number; mindmapsInfo: Array<{ id: number }> };
    expect(starredList.count).toBe(1);
    expect(starredList.mindmapsInfo[0]?.id).toBe(id1);

    const labelFiltered = (await (
      await handler(
        new Request('http://localhost:8888/api/restful/maps/?q=Work', {
          headers: authHeaders(),
        }),
      )
    ).json()) as { count: number };
    expect(labelFiltered.count).toBe(1);

    const sharedList = (await (
      await handler(
        new Request('http://localhost:8888/api/restful/maps/?q=shared_with_me', {
          headers: authHeaders(),
        }),
      )
    ).json()) as { count: number };
    expect(sharedList.count).toBe(0);

    // Lock no-op, publish disabled, collabs read-only, validate-note, duplicate
    const lockTrue = await handler(
      new Request(`http://localhost:8888/api/restful/maps/${id1}/lock`, {
        method: 'PUT',
        headers: authHeaders(),
        body: 'true',
      }),
    );
    expect(lockTrue.status).toBe(200);
    expect(await lockTrue.json()).toEqual({ email: TEST_OWNER_EMAIL });

    const lockFalse = await handler(
      new Request(`http://localhost:8888/api/restful/maps/${id1}/lock`, {
        method: 'PUT',
        headers: authHeaders(),
        body: 'false',
      }),
    );
    expect(lockFalse.status).toBe(204);

    expect(
      (
        await handler(
          new Request(`http://localhost:8888/api/restful/maps/${id1}/publish`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ isPublic: true }),
          }),
        )
      ).status,
    ).toBe(403);

    expect(
      (
        await handler(
          new Request(`http://localhost:8888/api/restful/maps/${id1}/publish`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ isPublic: false }),
          }),
        )
      ).status,
    ).toBe(204);

    expect(
      (
        await handler(
          new Request(`http://localhost:8888/api/restful/maps/${id1}/document/xml-pub`, {
            headers: authHeaders(),
          }),
        )
      ).status,
    ).toBe(403);

    const collabs = await handler(
      new Request(`http://localhost:8888/api/restful/maps/${id1}/collabs`, {
        headers: authHeaders(),
      }),
    );
    expect(collabs.status).toBe(200);

    const noteRes = await handler(
      new Request('http://localhost:8888/api/restful/maps/validate-note', {
        method: 'POST',
        headers: authHeaders(),
        body: 'Hello note',
      }),
    );
    expect(noteRes.status).toBe(200);
    expect(await noteRes.json()).toMatchObject({
      rawLength: 10,
      textLength: 10,
      overLimit: false,
    });

    const dupMap = await handler(
      new Request(`http://localhost:8888/api/restful/maps/${id1}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ title: 'Alpha Copy' }),
      }),
    );
    expect(dupMap.status).toBe(201);
    const id3 = Number.parseInt(dupMap.headers.get('resourceid')!, 10);

    // Remove label, delete label, batch delete maps
    expect(
      (
        await handler(
          new Request(`http://localhost:8888/api/restful/maps/${id1}/labels/${lblId}`, {
            method: 'DELETE',
            headers: authHeaders(),
          }),
        )
      ).status,
    ).toBe(204);

    expect(
      (
        await handler(
          new Request(`http://localhost:8888/api/restful/labels/${lblId}`, {
            method: 'DELETE',
            headers: authHeaders(),
          }),
        )
      ).status,
    ).toBe(204);

    expect(
      (
        await handler(
          new Request(`http://localhost:8888/api/restful/maps/batch?ids=${id2},${id3}`, {
            method: 'DELETE',
            headers: authHeaders(),
          }),
        )
      ).status,
    ).toBe(204);

    expect(
      (
        await handler(
          new Request('http://localhost:8888/api/restful/maps/batch?ids=bad', {
            method: 'DELETE',
            headers: authHeaders(),
          }),
        )
      ).status,
    ).toBe(400);
  });

  it('supports full folder CRUD, move-to-folder (single & batch), cycle prevention, and delete-to-root', async () => {
    // 1. Create parent & child folders
    const createParentRes = await handler(
      new Request('http://localhost:8888/api/restful/folders', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name: '工作' }),
      }),
    );
    expect(createParentRes.status).toBe(201);
    const parentBody = (await createParentRes.json()) as { folder: { id: number; name: string; parentId: number | null } };
    const parentId = parentBody.folder.id;
    expect(parentBody.folder.parentId).toBeNull();

    const createChildRes = await handler(
      new Request('http://localhost:8888/api/restful/folders', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name: '2026', parentId }),
      }),
    );
    expect(createChildRes.status).toBe(201);
    const childId = ((await createChildRes.json()) as { folder: { id: number } }).folder.id;

    // Invalid folder name with slash -> 400
    const badNameRes = await handler(
      new Request('http://localhost:8888/api/restful/folders', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name: 'a/b' }),
      }),
    );
    expect(badNameRes.status).toBe(400);

    // Cycle check -> 400
    const cycleRes = await handler(
      new Request(`http://localhost:8888/api/restful/folders/${parentId}`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ parentId: childId }),
      }),
    );
    expect(cycleRes.status).toBe(400);

    // 2. Create a map inside child folder and a map at root
    const mapInChildRes = await handler(
      new Request(`http://localhost:8888/api/restful/maps?title=SubMap&folderId=${childId}`, {
        method: 'POST',
        headers: authHeaders(),
      }),
    );
    expect(mapInChildRes.status).toBe(201);
    const mapInChildId = Number.parseInt(mapInChildRes.headers.get('resourceid')!, 10);

    const rootMapRes = await handler(
      new Request('http://localhost:8888/api/restful/maps?title=RootMap', {
        method: 'POST',
        headers: authHeaders(),
      }),
    );
    expect(rootMapRes.status).toBe(201);
    const rootMapId = Number.parseInt(rootMapRes.headers.get('resourceid')!, 10);

    // 3. Move root map into parent folder (single) and then batch move both into child folder
    const moveSingleRes = await handler(
      new Request(`http://localhost:8888/api/restful/maps/${rootMapId}/folder`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ folderId: parentId }),
      }),
    );
    expect(moveSingleRes.status).toBe(204);

    const moveBatchRes = await handler(
      new Request('http://localhost:8888/api/restful/maps/batch/folder', {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ mapIds: [rootMapId, mapInChildId], folderId: childId }),
      }),
    );
    expect(moveBatchRes.status).toBe(204);

    // Verify list maps reflects folderId and folderPath
    const listRes = await handler(
      new Request('http://localhost:8888/api/restful/maps', {
        headers: authHeaders(),
      }),
    );
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as {
      mindmapsInfo: Array<{ id: number; folderId: number | null; folderPath: string }>;
    };
    expect(listBody.mindmapsInfo.find((m) => m.id === rootMapId)).toMatchObject({
      folderId: childId,
      folderPath: '工作/2026/',
    });

    // 4. Rename parent folder and confirm map folderPath updates
    const renameRes = await handler(
      new Request(`http://localhost:8888/api/restful/folders/${parentId}`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name: '归档' }),
      }),
    );
    expect(renameRes.status).toBe(200);

    const listAfterRename = await handler(
      new Request('http://localhost:8888/api/restful/maps', {
        headers: authHeaders(),
      }),
    );
    const listAfterRenameBody = (await listAfterRename.json()) as {
      mindmapsInfo: Array<{ id: number; folderId: number | null; folderPath: string }>;
    };
    expect(listAfterRenameBody.mindmapsInfo.find((m) => m.id === mapInChildId)?.folderPath).toBe(
      '归档/2026/',
    );

    // 5. Delete child folder -> maps move back to root, not deleted
    const delRes = await handler(
      new Request(`http://localhost:8888/api/restful/folders/${childId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      }),
    );
    expect(delRes.status).toBe(204);

    const listAfterDelete = await handler(
      new Request('http://localhost:8888/api/restful/maps', {
        headers: authHeaders(),
      }),
    );
    const listAfterDeleteBody = (await listAfterDelete.json()) as {
      mindmapsInfo: Array<{ id: number; folderId: number | null; folderPath: string }>;
    };
    expect(listAfterDeleteBody.mindmapsInfo).toHaveLength(2);
    expect(listAfterDeleteBody.mindmapsInfo.every((m) => m.folderId === null && m.folderPath === '')).toBe(true);

    const foldersAfterDelete = await handler(
      new Request('http://localhost:8888/api/restful/folders', {
        headers: authHeaders(),
      }),
    );
    expect(((await foldersAfterDelete.json()) as { folders: Array<{ id: number }> }).folders.map((f) => f.id)).toEqual([
      parentId,
    ]);
  });

  it('resolves map metadata by folderPath + title and rejects slashes in map titles', async () => {
    // Reject slash in map title on create
    const slashCreate = await handler(
      new Request('http://localhost:8888/api/restful/maps?title=2026%2FQ4', {
        method: 'POST',
        headers: authHeaders(),
      }),
    );
    expect(slashCreate.status).toBe(400);

    // Create folder hierarchy + map inside it + root map
    const folderRes = await handler(
      new Request('http://localhost:8888/api/restful/folders', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name: '工作' }),
      }),
    );
    expect(folderRes.status).toBe(201);
    const { folder } = (await folderRes.json()) as { folder: { id: number } };

    const nestedCreate = await handler(
      new Request(
        `http://localhost:8888/api/restful/maps?title=${encodeURIComponent('项目计划')}&folderId=${folder.id}`,
        {
          method: 'POST',
          headers: authHeaders(),
        },
      ),
    );
    expect(nestedCreate.status).toBe(201);
    const nestedId = Number(nestedCreate.headers.get('ResourceId'));

    const rootCreate = await handler(
      new Request(
        `http://localhost:8888/api/restful/maps?title=${encodeURIComponent('项目计划')}`,
        {
          method: 'POST',
          headers: authHeaders(),
        },
      ),
    );
    expect(rootCreate.status).toBe(201);
    const rootId = Number(rootCreate.headers.get('ResourceId'));

    // Same title in different folders resolves distinctly
    const byNestedPath = await handler(
      new Request(
        `http://localhost:8888/api/restful/maps/by-path/metadata?folderPath=${encodeURIComponent('工作/')}&title=${encodeURIComponent('项目计划')}&xml=true`,
        { headers: authHeaders() },
      ),
    );
    expect(byNestedPath.status).toBe(200);
    const nestedMeta = (await byNestedPath.json()) as {
      id: number;
      title: string;
      folderPath: string;
      xml?: string;
    };
    expect(nestedMeta.id).toBe(nestedId);
    expect(nestedMeta.folderPath).toBe('工作/');
    expect(nestedMeta.xml).toContain('<map');

    const byRootPath = await handler(
      new Request(
        `http://localhost:8888/api/restful/maps/by-path/metadata?folderPath=&title=${encodeURIComponent('项目计划')}`,
        { headers: authHeaders() },
      ),
    );
    expect(byRootPath.status).toBe(200);
    const rootMeta = (await byRootPath.json()) as { id: number; folderPath: string };
    expect(rootMeta.id).toBe(rootId);
    expect(rootMeta.folderPath).toBe('');

    // Reject slash on rename
    const slashRename = await handler(
      new Request(`http://localhost:8888/api/restful/maps/${rootId}/title`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'text/plain' }),
        body: 'A/B',
      }),
    );
    expect(slashRename.status).toBe(400);

    // Missing title -> 400, unknown path -> 404
    const missingTitle = await handler(
      new Request('http://localhost:8888/api/restful/maps/by-path/metadata?folderPath=工作/', {
        headers: authHeaders(),
      }),
    );
    expect(missingTitle.status).toBe(400);

    const notFound = await handler(
      new Request(
        `http://localhost:8888/api/restful/maps/by-path/metadata?folderPath=${encodeURIComponent('不存在/')}&title=${encodeURIComponent('项目计划')}`,
        { headers: authHeaders() },
      ),
    );
    expect(notFound.status).toBe(403);
  });
});
