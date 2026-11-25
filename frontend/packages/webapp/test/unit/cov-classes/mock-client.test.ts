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

import MockClient from '../../../src/classes/client/mock-client';
import JwtTokenConfig from '../../../src/classes/jwt-token-config';
import { appLogger } from '../../../src/utils/logger';
import { MockPersistenceManager } from '@wisemapping/mindplot';
import { defined } from '../defined';

let client: MockClient;

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  JwtTokenConfig.removeToken();
  localStorage.clear();
  client = new MockClient();
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  JwtTokenConfig.removeToken();
});

describe('MockClient maps', () => {
  it('traces its calls through the app logger, not straight to the console', async () => {
    const debug = jest.spyOn(appLogger, 'debug').mockImplementation(() => undefined);
    await client.fetchAllMaps();
    await client.fetchLabels();

    expect(console.log).not.toHaveBeenCalled();
    expect(debug).toHaveBeenCalledWith('Fetching  maps from server');
  });

  it('starts empty with no hardcoded maps', async () => {
    await expect(client.fetchAllMaps()).resolves.toEqual([]);
  });

  it('createMap adds an owned map with monotonic integer id, XML, and empty history', async () => {
    await client.login({ email: 'owner@x.y', password: 'p' });
    const id = await client.createMap({ title: 'Fresh & "Quoted" <Map>', description: 'D' });
    const id2 = await client.createMap({ title: 'No description' });

    expect(Number.isInteger(id)).toBe(true);
    expect(id2).toBe(id + 1);

    const maps = await client.fetchAllMaps();
    expect(maps.find((m) => m.id === id)).toMatchObject({
      title: 'Fresh & "Quoted" <Map>',
      description: 'D',
      role: 'owner',
      starred: false,
      public: false,
      createdBy: 'owner@x.y',
      lastModificationBy: 'owner@x.y',
    });
    expect(maps.find((m) => m.title === 'No description')?.description).toBe('');

    const metadata = await client.fetchMapMetadata(id, true);
    expect(metadata.xml).toContain('Fresh &amp; &quot;Quoted&quot; &lt;Map&gt;');
    expect(() => new DOMParser().parseFromString(metadata.xml || '', 'text/xml')).not.toThrow();
    expect(
      new DOMParser()
        .parseFromString(metadata.xml || '', 'text/xml')
        .getElementsByTagName('parsererror'),
    ).toHaveLength(0);

    await expect(client.fetchHistory(id)).resolves.toEqual([]);
  });

  it('fetchMapInfo and fetchMapMetadata return persisted metadata or reject for unknown maps', async () => {
    const id = await client.createMap({ title: 'Project', description: 'Notes' });
    await client.updateStarred(id, true);
    await client.updateMapToPublic(id, true);
    localStorage.setItem(`wisemapping.mock.props.${id}`, '{"zoom":1.5}');

    await expect(client.fetchMapInfo(id)).resolves.toMatchObject({
      title: 'Project',
      starred: true,
      public: true,
    });
    await expect(client.fetchMapInfo(9999)).rejects.toThrow('Map could not be found 9999');

    const plain = await client.fetchMapMetadata(id);
    expect(plain).toMatchObject({
      id,
      title: 'Project',
      description: 'Notes',
      starred: true,
      public: true,
      isLocked: false,
      role: 'owner',
      jsonProps: '{"zoom":1.5}',
    });
    expect(plain.xml).toBeUndefined();

    const withXml = await client.fetchMapMetadata(id, true);
    expect(withXml.xml).toContain(`name="${id}"`);
    await expect(client.fetchMapMetadata(9999)).rejects.toMatchObject({ status: 404 });
  });

  it('renameMap changes title and description, allows description-only edits, and rejects taken titles', async () => {
    const id1 = await client.createMap({ title: 'First', description: 'Desc 1' });
    const id2 = await client.createMap({ title: 'Second', description: 'Desc 2' });

    await client.renameMap(id1, { title: 'Renamed', description: 'New desc' });
    await client.renameMap(id2, { title: 'Renamed 2' });
    // Keeping the map's own title while changing description must succeed.
    await client.renameMap(id2, { title: 'Renamed 2', description: 'Updated desc 2' });

    let maps = await client.fetchAllMaps();
    expect(maps.find((m) => m.id === id1)).toMatchObject({
      title: 'Renamed',
      description: 'New desc',
    });
    expect(maps.find((m) => m.id === id2)).toMatchObject({
      title: 'Renamed 2',
      description: 'Updated desc 2',
    });

    await client.renameMap(id2, { title: 'Renamed again', description: '' });
    maps = await client.fetchAllMaps();
    expect(maps.find((m) => m.id === id2)?.description).toBe('');

    await expect(client.renameMap(id2, { title: 'Renamed' })).rejects.toMatchObject({
      msg: 'Map already exists ...Renamed',
    });
  });

  it('duplicateMap copies XML and props with integer id, leaves empty description, and rejects invalid inputs', async () => {
    const sourceId = await client.createMap({ title: 'Original', description: 'Src' });
    const sourceXml = '<map name="1" version="tango"><topic central="true" text="Custom Root" id="1"/></map>';
    localStorage.setItem(`wisemapping.mock.xml.${sourceId}`, sourceXml);
    localStorage.setItem(`wisemapping.mock.props.${sourceId}`, '{"zoom":1.4}');

    const copyId = await client.duplicateMap(sourceId, { title: 'Copy', description: 'Copied' });
    expect(Number.isInteger(copyId)).toBe(true);
    expect(copyId).toBeGreaterThan(sourceId);

    const maps = await client.fetchAllMaps();
    expect(maps.find((m) => m.id === copyId)).toMatchObject({
      title: 'Copy',
      description: 'Copied',
    });
    const copyMeta = await client.fetchMapMetadata(copyId, true);
    expect(copyMeta.xml).toContain('Custom Root');
    expect(copyMeta.jsonProps).toBe('{"zoom":1.4}');
    await expect(client.fetchHistory(copyId)).resolves.toEqual([]);

    const bareCopyId = await client.duplicateMap(sourceId, { title: 'Bare copy' });
    expect((await client.fetchAllMaps()).find((m) => m.id === bareCopyId)?.description).toBe('');

    await expect(client.duplicateMap(sourceId, { title: 'Copy' })).rejects.toMatchObject({
      msg: 'Maps name must be unique:Copy',
    });
    await expect(client.duplicateMap(9999, { title: 'Ghost copy' })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('deleteMap and deleteMaps remove maps and clean up XML, props, and history keys', async () => {
    const id1 = await client.createMap({ title: 'One' });
    const id2 = await client.createMap({ title: 'Two' });
    const id3 = await client.createMap({ title: 'Three' });
    localStorage.setItem(`wisemapping.mock.props.${id1}`, '{"zoom":1}');
    localStorage.setItem(`wisemapping.mock.history.${id1}`, JSON.stringify([{ id: 10, xml: '<map/>' }]));
    localStorage.setItem(`wisemapping.mock.history.${id2}`, JSON.stringify([{ id: 11, xml: '<map/>' }]));

    await client.deleteMap(id1);
    await client.deleteMaps([id2]);

    const ids = (await client.fetchAllMaps()).map((m) => m.id);
    expect(ids).toEqual([id3]);
    expect(localStorage.getItem(`wisemapping.mock.xml.${id1}`)).toBeNull();
    expect(localStorage.getItem(`wisemapping.mock.props.${id1}`)).toBeNull();
    expect(localStorage.getItem(`wisemapping.mock.history.${id1}`)).toBeNull();
    expect(localStorage.getItem(`wisemapping.mock.xml.${id2}`)).toBeNull();
    expect(localStorage.getItem(`wisemapping.mock.history.${id2}`)).toBeNull();
  });

  it('updateStarred rejects for an unknown map', async () => {
    await expect(client.updateStarred(9999, true)).rejects.toMatchObject({ status: 404 });
  });

  it('fetchHistory reads snapshots saved via MockPersistenceManager and revertHistory restores & appends snapshot', async () => {
    await client.login({ email: 'editor@x.y', password: 'p' });
    const id = await client.createMap({ title: 'Versioned' });

    expect(await client.fetchHistory(id)).toEqual([]);

    const persistence = new MockPersistenceManager('<map version="tango"><topic central="true" text="Init" id="1"/></map>', {
      editorName: 'editor@x.y',
    });
    const docV1 = new DOMParser().parseFromString(
      '<map version="tango"><topic central="true" text="Snapshot V1" id="1"/></map>',
      'text/xml',
    );
    const docV2 = new DOMParser().parseFromString(
      '<map version="tango"><topic central="true" text="Snapshot V2" id="1"/></map>',
      'text/xml',
    );

    persistence.saveMapXml(String(id), docV1, '{"zoom":1}', true);
    persistence.saveMapXml(String(id), docV2, '{"zoom":1}', true);

    const historyBefore = await client.fetchHistory(id);
    expect(historyBefore).toHaveLength(2);
    expect(defined(historyBefore[0]).lastModificationBy).toBe('editor@x.y');

    const v1Id = defined(historyBefore[1]).id;
    await client.revertHistory(id, v1Id);

    const metaAfter = await client.fetchMapMetadata(id, true);
    expect(metaAfter.xml).toContain('Snapshot V1');

    const historyAfter = await client.fetchHistory(id);
    expect(historyAfter).toHaveLength(3);
    expect(defined(historyAfter[0]).id).toBeGreaterThan(defined(historyBefore[0]).id);

    await expect(client.fetchHistory(9999)).rejects.toMatchObject({ status: 404 });
    await expect(client.revertHistory(id, 999999)).rejects.toMatchObject({ status: 400 });
  });

  it('importMap persists the imported map and XML with 0 initial history', async () => {
    const importedId = await client.importMap({
      title: 'Imported',
      content: '<map version="tango"><topic central="true" text="Imported Root" id="1"/></map>',
    });
    const emptyContentId = await client.importMap({ title: 'Imported Blank' });

    expect(Number.isInteger(importedId)).toBe(true);
    expect(emptyContentId).toBe(importedId + 1);
    expect((await client.fetchMapMetadata(importedId, true)).xml).toContain('Imported Root');
    expect((await client.fetchMapMetadata(emptyContentId, true)).xml).toContain('Imported Blank');
    await expect(client.fetchHistory(importedId)).resolves.toEqual([]);
  });
});

describe('MockClient labels', () => {
  it('starts empty and persists monotonically incremented integer label ids', async () => {
    await expect(client.fetchLabels()).resolves.toEqual([]);

    const id1 = await client.createLabel('Work', 'blue');
    const id2 = await client.createLabel('Personal', 'green');

    expect(id1).toBe(1);
    expect(id2).toBe(2);
    expect(await new MockClient().fetchLabels()).toEqual([
      { id: 1, title: 'Work', color: 'blue' },
      { id: 2, title: 'Personal', color: 'green' },
    ]);
  });

  it('createLabel returns a promise', () => {
    expect(client.createLabel('Work', 'blue')).toBeInstanceOf(Promise);
  });

  it('addLabelToMap and deleteLabelFromMap round-trip a label on a map', async () => {
    const labelId = await client.createLabel('Focus', 'red');
    const mapId = await client.createMap({ title: 'Tagged' });

    await client.addLabelToMap(labelId, mapId);
    expect((await client.fetchAllMaps()).find((m) => m.id === mapId)?.labels).toEqual([
      { id: labelId, title: 'Focus', color: 'red' },
    ]);

    await client.deleteLabelFromMap(labelId, mapId);
    expect((await client.fetchAllMaps()).find((m) => m.id === mapId)?.labels).toEqual([]);
  });

  it('label operations reject unknown labels or maps', async () => {
    const mapId = await client.createMap({ title: 'Tagged' });
    const labelId = await client.createLabel('Tag', 'black');

    await expect(client.addLabelToMap(99, mapId)).rejects.toEqual({
      msg: 'unable to find label with id 99',
    });
    await expect(client.addLabelToMap(labelId, 9999)).rejects.toEqual({
      msg: 'unable to find map with id 9999',
    });
    await expect(client.deleteLabelFromMap(labelId, 9999)).rejects.toEqual({
      msg: 'unable to find map with id 9999',
    });
  });

  it('deleteLabel removes it from the list and from every map', async () => {
    const l1 = await client.createLabel('L1', 'black');
    const l2 = await client.createLabel('L2', 'green');
    const mapId = await client.createMap({ title: 'Tagged' });
    await client.addLabelToMap(l1, mapId);

    await client.deleteLabel(l1);

    expect((await client.fetchLabels()).map((l) => l.id)).toEqual([l2]);
    const maps = await client.fetchAllMaps();
    expect(maps.some((m) => m.labels.some((l) => l.id === l1))).toBe(false);
  });
});

describe('MockClient sharing', () => {
  it('returns single-owner permission for the active account', async () => {
    await client.login({ email: 'owner@x.y', password: 'p' });
    const perms = await client.fetchMapPermissions(1);

    expect(perms).toEqual([
      {
        name: 'owner@x.y',
        email: 'owner@x.y',
        role: 'owner',
      },
    ]);
  });

  it('adds and removes collaborators', async () => {
    await client.login({ email: 'owner@x.y', password: 'p' });
    await client.fetchMapPermissions(1);
    await client.addMapPermissions(1, 'welcome', [{ email: 'new@x.y', role: 'viewer' }]);
    await client.deleteMapPermission(1, 'owner@x.y');

    const emails = (await client.fetchMapPermissions(1)).map((p) => p.email);
    expect(emails).toEqual(['new@x.y']);
  });

  it('adding or removing on a fresh map starts from an empty list', async () => {
    await client.deleteMapPermission(7, 'nobody@x.y');
    expect(await client.fetchMapPermissions(7)).toEqual([]);

    await client.addMapPermissions(8, '', [{ email: 'a@x.y', role: 'editor' }]);
    expect(await client.fetchMapPermissions(8)).toEqual([{ email: 'a@x.y', role: 'editor' }]);
  });
});

describe('MockClient account', () => {
  it('fetchAccountInfo rejects as unauthenticated until somebody logs in and sets isAdmin false', async () => {
    await expect(client.fetchAccountInfo()).rejects.toEqual({
      msg: 'User not authenticated',
      isAuth: true,
      status: 401,
    });

    await client.login({ email: 'me@x.y', password: 'p' });

    await expect(client.fetchAccountInfo()).resolves.toMatchObject({
      email: 'me@x.y',
      firstname: 'me',
      lastname: '',
      isAdmin: false,
      locale: undefined,
    });
    expect(JwtTokenConfig.retreiveToken()).toBe('me@x.y');
  });

  it('updateAccountLanguage and updateAccountInfo are reflected in fetchAccountInfo', async () => {
    await client.login({ email: 'me@x.y', password: 'p' });
    await client.updateAccountLanguage('zh-CN');
    await client.updateAccountInfo('A', 'B');

    const account = await client.fetchAccountInfo();
    expect(account.locale?.code).toBe('zh-CN');
    expect(account.firstname).toBe('A');
    expect(account.lastname).toBe('B');
  });

  it('accepts the remaining account operations', async () => {
    await expect(client.logout()).resolves.toBeUndefined();
    await expect(client.deleteAccount()).resolves.toBeUndefined();
    await expect(client.updateAccountInfo('A', 'B')).resolves.toBeUndefined();
    await expect(client.updateAccountPassword('p')).resolves.toBeUndefined();
    await expect(client.resetPassword('a@x.y')).resolves.toEqual({ action: 'EMAIL_SENT' });
    await expect(client.resetPasswordFromToken('t', 'p')).resolves.toBeUndefined();
  });

  it('registerNewUser fails only for the error@example.com address', async () => {
    const user = {
      email: 'ok@example.com',
      firstname: 'a',
      lastname: 'b',
      password: 'p',
      recaptcha: '',
      acceptedTerms: true,
    };

    await expect(client.registerNewUser(user)).resolves.toBeUndefined();
    await expect(client.registerNewUser({ ...user, email: 'error@example.com' })).rejects.toEqual({
      msg: 'Unexpected error',
    });
  });

  it('activateAccount rejects the reserved invalid code', async () => {
    await expect(client.activateAccount('123')).resolves.toBeUndefined();
    await expect(client.activateAccount('999999999')).rejects.toEqual({
      msg: 'Invalid activation code. The link may be incorrect or expired.',
    });
  });

  it('OAuth callbacks return the active user email instead of hardcoded test@email.com', async () => {
    await client.login({ email: 'me@x.y', password: 'p' });
    const expected = { email: 'me@x.y', oauthSync: true };

    await expect(client.processGoogleCallback()).resolves.toEqual(expected);
    await expect(client.processFacebookCallback()).resolves.toEqual(expected);
    await expect(client.confirmAccountSync('a@x.y')).resolves.toEqual(expected);
  });

  it('onSessionExpired echoes the callback', () => {
    const cb = jest.fn();

    expect(client.onSessionExpired(cb)).toBe(cb);
    expect(client.onSessionExpired()).toBeUndefined();
  });
});
