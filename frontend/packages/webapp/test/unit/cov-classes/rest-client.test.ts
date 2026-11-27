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

import { inspect } from 'util';
import RestClient from '../../../src/classes/client/rest-client';
import JwtTokenConfig from '../../../src/classes/jwt-token-config';
import { appLogger } from '../../../src/utils/logger';
import { stubBackend, installWebCrypto, Reply, flushPromises } from './helpers/axios-stub';
import { defined } from '../defined';

const API = 'http://api.test';

/** A JWT whose exp is `secondsFromNow` away (negative: already expired). */
const tokenExpiringIn = (secondsFromNow: number): string => {
  const payload = {
    sub: 'ana@wisemapping.com',
    exp: Math.floor(Date.now() / 1000) + secondsFromNow,
  };
  return `h.${btoa(JSON.stringify(payload)).replace(/=+$/, '')}.s`;
};

const newClient = (replies?: Reply[] | ((req: { url: string; method: string }) => Reply)) => {
  const client = new RestClient(API);
  const calls = stubBackend(client, replies);
  return { client, calls };
};

beforeEach(() => {
  jest.spyOn(appLogger, 'error').mockImplementation(() => undefined);
  jest.spyOn(appLogger, 'warn').mockImplementation(() => undefined);
  JwtTokenConfig.removeToken();
  localStorage.clear();
});

let removeWebCrypto: () => void;
beforeAll(() => {
  removeWebCrypto = installWebCrypto();
});

afterAll(() => {
  JwtTokenConfig.removeToken();
  removeWebCrypto();
});

describe('RestClient request headers', () => {
  it('sends the stored JWT as a bearer token and the default Chinese locale', async () => {
    JwtTokenConfig.storeToken('abc');
    localStorage.setItem('user.locale', 'es');
    const { client, calls } = newClient([{ data: { changes: [] } }]);

    await client.fetchHistory(1);

    expect(defined(calls[0]).header('Authorization')).toBe('Bearer abc');
    expect(defined(calls[0]).header('Accept-Language')).toBe('zh');
  });

  it('omits the Authorization header when nobody is signed in', async () => {
    const { client, calls } = newClient([{ data: { changes: [] } }]);

    await client.fetchHistory(1);

    expect(defined(calls[0]).header('Authorization')).toBeFalsy();
  });
});

describe('RestClient maps', () => {
  it('fetchMapMetadata gets the metadata, with the xml flag when asked', async () => {
    const meta = { id: 3, title: 't', locked: false };
    const { client, calls } = newClient([{ data: meta }, { data: meta }]);

    await expect(client.fetchMapMetadata(3)).resolves.toMatchObject({ id: 3, title: 't' });
    await client.fetchMapMetadata(3, true);

    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['GET', `${API}/api/restful/maps/3/metadata`],
      ['GET', `${API}/api/restful/maps/3/metadata?xml=true`],
    ]);
  });

  it('fetchMapMetadata reads the lock as the backend sends it, and fills in the id', async () => {
    // RestMindmapMetadata serialises the lock as "locked" and sends no id. Reading "isLocked"
    // made every map look unlocked: a second user got an editable map whose saves all failed.
    const { client } = newClient([
      { data: { title: 't', locked: true, isLockedBy: 'Ana', role: 'editor' } },
      { data: { title: 't', locked: false, role: 'editor' } },
    ]);

    await expect(client.fetchMapMetadata(3)).resolves.toMatchObject({
      id: 3,
      isLocked: true,
      isLockedBy: 'Ana',
    });
    await expect(client.fetchMapMetadata(3)).resolves.toMatchObject({ id: 3, isLocked: false });
  });

  it('fetchMapMetadata turns a 422 (spam map) into a 410 gone error', async () => {
    const { client } = newClient([{ status: 422, data: { globalErrors: ['spam'] } }]);

    await expect(client.fetchMapMetadata(3)).rejects.toEqual({
      msg: 'spam',
      status: 410,
      isAuth: false,
    });
  });

  it('fetchMapMetadata reads version from body, falls back to x-mindmap-version header, and omits when absent', async () => {
    const { client } = newClient([
      {
        data: { title: 'body-zero', locked: false, version: 0 },
        headers: { 'x-mindmap-version': '9' },
      },
      {
        data: { title: 'header-fallback', locked: false },
        headers: { 'x-mindmap-version': '7' },
      },
      { data: { title: 'no-version', locked: false } },
    ]);

    await expect(client.fetchMapMetadata(3)).resolves.toMatchObject({ id: 3, version: 0 });
    await expect(client.fetchMapMetadata(3)).resolves.toMatchObject({ id: 3, version: 7 });
    const withoutVersion = await client.fetchMapMetadata(3);
    expect(withoutVersion).not.toHaveProperty('version');
  });

  it('fetchMapMetadataByPath queries by folderPath and title with URLSearchParams', async () => {
    const { client, calls } = newClient([
      {
        data: { id: 19, title: '项目计划', folderPath: '工作/2026/', locked: false, version: 2 },
      },
    ]);

    await expect(
      client.fetchMapMetadataByPath('工作/2026/', '项目计划', true),
    ).resolves.toMatchObject({
      id: 19,
      title: '项目计划',
      folderPath: '工作/2026/',
      version: 2,
    });

    expect(defined(calls[0]).url).toBe(
      `${API}/api/restful/maps/by-path/metadata?folderPath=%E5%B7%A5%E4%BD%9C%2F2026%2F&title=%E9%A1%B9%E7%9B%AE%E8%AE%A1%E5%88%92&xml=true`,
    );
  });

  it('fetchAllMaps maps the server fields onto MapInfo', async () => {
    const { client, calls } = newClient([
      {
        data: {
          mindmapsInfo: [
            {
              id: 1,
              starred: true,
              title: 'A',
              labels: [],
              creator: 'me',
              creationTime: 'c',
              lastModifierUser: 'you',
              lastModificationTime: 'm',
              description: 'd',
              public: true,
              role: 'owner',
            },
          ],
        },
      },
    ]);

    const maps = await client.fetchAllMaps();

    expect(defined(calls[0]).url).toBe(`${API}/api/restful/maps/`);
    expect(maps).toEqual([
      {
        id: 1,
        starred: true,
        title: 'A',
        folderId: null,
        folderPath: undefined,
        labels: [],
        createdBy: 'me',
        creationTime: 'c',
        lastModificationBy: 'you',
        lastModificationTime: 'm',
        description: 'd',
        public: true,
        role: 'owner',
      },
    ]);
  });

  it('createMap posts title, description and the default theme and returns the new id', async () => {
    const { client, calls } = newClient([{ headers: { resourceid: '42' } }]);

    await expect(client.createMap({ title: 'My map', description: 'a&b' })).resolves.toBe(42);

    expect(defined(calls[0]).method).toBe('POST');
    expect(defined(calls[0]).url).toBe(
      `${API}/api/restful/maps?title=My%20map&description=a%26b&theme=prism`,
    );
  });

  it('createMap sends an empty description when none is given', async () => {
    const { client, calls } = newClient([{ headers: { resourceid: '1' } }]);

    await client.createMap({ title: 'T' });

    expect(defined(calls[0]).url).toBe(`${API}/api/restful/maps?title=T&description=&theme=prism`);
  });

  it('importMap posts the XML content and returns the new id', async () => {
    const { client, calls } = newClient([
      { headers: { resourceid: '7' } },
      { headers: { resourceid: '8' } },
    ]);

    await expect(
      client.importMap({ title: 'Imp', description: 'd', content: '<map/>' }),
    ).resolves.toBe(7);
    await client.importMap({ title: 'Imp2', content: '<map/>' });

    expect(defined(calls[0]).url).toBe(`${API}/api/restful/maps?title=Imp&description=d`);
    expect(defined(calls[0]).data).toBe('<map/>');
    expect(defined(calls[0]).header('Content-Type')).toBe('application/xml');
    expect(defined(calls[1]).url).toBe(`${API}/api/restful/maps?title=Imp2&description=`);
  });

  it('renameMap updates the title, then the description (blank when cleared)', async () => {
    const { client, calls } = newClient();

    await client.renameMap(4, { title: 'New', description: 'Desc' });
    await client.renameMap(4, { title: 'Other', description: '' });

    expect(calls.map((c) => [c.method, c.url, c.data])).toEqual([
      ['PUT', `${API}/api/restful/maps/4/title`, 'New'],
      ['PUT', `${API}/api/restful/maps/4/description`, 'Desc'],
      ['PUT', `${API}/api/restful/maps/4/title`, 'Other'],
      ['PUT', `${API}/api/restful/maps/4/description`, ' '],
    ]);
  });

  it('renameMap without a description leaves the description alone', async () => {
    // The editor's app bar renames with the title only; the map keeps its description.
    const { client, calls } = newClient();

    await client.renameMap(4, { title: 'Other' });

    expect(calls.map((c) => [c.method, c.url, c.data])).toEqual([
      ['PUT', `${API}/api/restful/maps/4/title`, 'Other'],
    ]);
  });

  it('renameMap without a title only updates the description', async () => {
    const { client, calls } = newClient();

    await client.renameMap(4, { description: 'Desc' });

    expect(calls.map((c) => [c.method, c.url, c.data])).toEqual([
      ['PUT', `${API}/api/restful/maps/4/description`, 'Desc'],
    ]);
  });

  it('renameMap reports the field error of a duplicated title', async () => {
    const { client, calls } = newClient([
      { status: 400, data: { fieldErrors: { title: 'Title already in use' } } },
    ]);

    await expect(client.renameMap(4, { title: 'Dup' })).rejects.toEqual({
      msg: 'Title already in use',
      fields: { title: 'Title already in use' },
      status: 400,
      isAuth: false,
    });
    // The description is never sent once the title fails.
    expect(calls).toHaveLength(1);
  });

  it('duplicateMap posts the new title and returns the copy id', async () => {
    const { client, calls } = newClient([{ headers: { resourceid: '99' } }]);

    await expect(client.duplicateMap(2, { title: 'Copy' })).resolves.toBe(99);

    expect(defined(calls[0]).method).toBe('POST');
    expect(defined(calls[0]).url).toBe(`${API}/api/restful/maps/2`);
    expect(JSON.parse(defined(calls[0]).data as string)).toEqual({ title: 'Copy' });
  });

  it('deleteMap and deleteMaps call the delete endpoints', async () => {
    const { client, calls } = newClient();

    await client.deleteMap(3);
    await client.deleteMaps([1, 2, 3]);

    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['DELETE', `${API}/api/restful/maps/3`],
      ['DELETE', `${API}/api/restful/maps/batch?ids=1,2,3`],
    ]);
  });

  it('updateStarred sends the new flag', async () => {
    const { client, calls } = newClient();

    await client.updateStarred(3, true);

    expect(calls[0]).toMatchObject({
      method: 'PUT',
      url: `${API}/api/restful/maps/3/starred`,
      data: 'true',
    });
  });

  it('fetchHistory maps the change list and revertHistory posts to the revision', async () => {
    const { client, calls } = newClient([
      { data: { changes: [{ id: 1, creator: 'me', creationTime: 't' }] } },
    ]);

    await expect(client.fetchHistory(9)).resolves.toEqual([
      { id: 1, lastModificationBy: 'me', lastModificationTime: 't' },
    ]);
    await client.revertHistory(9, 1);

    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['GET', `${API}/api/restful/maps/9/history/`],
      ['POST', `${API}/api/restful/maps/9/history/1`],
    ]);
  });
});

describe('RestClient labels', () => {
  it('fetchLabels maps the label list', async () => {
    const { client } = newClient([
      { data: { labels: [{ id: 1, color: 'red', title: 'L', iconName: 'smile', other: 1 }] } },
    ]);

    await expect(client.fetchLabels()).resolves.toEqual([
      { id: 1, color: 'red', title: 'L', iconName: 'smile' },
    ]);
  });

  it('createLabel posts the label and returns the new id', async () => {
    const { client, calls } = newClient([{ headers: { resourceid: '12' } }]);

    await expect(client.createLabel('Work', '#fff')).resolves.toBe(12);

    expect(defined(calls[0]).url).toBe(`${API}/api/restful/labels`);
    expect(JSON.parse(defined(calls[0]).data as string)).toEqual({
      title: 'Work',
      color: '#fff',
      iconName: 'smile',
    });
  });

  it('deleteLabel, addLabelToMap and deleteLabelFromMap hit the label endpoints', async () => {
    const { client, calls } = newClient();

    await client.deleteLabel(5);
    await client.addLabelToMap(5, 9);
    await client.deleteLabelFromMap(5, 9);

    expect(calls.map((c) => [c.method, c.url, c.data])).toEqual([
      ['DELETE', `${API}/api/restful/labels/5`, undefined],
      ['POST', `${API}/api/restful/maps/9/labels`, '5'],
      ['DELETE', `${API}/api/restful/maps/9/labels/5`, undefined],
    ]);
  });
});

describe('RestClient account', () => {
  it('fetchAccountInfo maps the account, defaulting missing names and the locale', async () => {
    const { client } = newClient([
      {
        data: {
          firstname: 'Ana',
          lastname: 'Li',
          email: 'a@b.c',
          locale: 'fr',
          authenticationType: 'GOOGLE_OAUTH2',
          isAdmin: true,
        },
      },
      { data: { email: 'x@y.z', locale: null, authenticationType: 'GOOGLE_OAUTH2', isAdmin: 'yes' } },
    ]);

    const first = await client.fetchAccountInfo();
    expect(first).toMatchObject({
      firstname: 'Ana',
      lastname: 'Li',
      email: 'a@b.c',
      authenticationType: 'GOOGLE_OAUTH2',
      isAdmin: true,
    });
    expect(first.locale?.code).toBe('zh');

    await expect(client.fetchAccountInfo()).resolves.toEqual({
      firstname: '',
      lastname: '',
      fullName: '',
      avatarUrl: undefined,
      email: 'x@y.z',
      locale: undefined,
      authenticationType: 'GOOGLE_OAUTH2',
      isAdmin: false,
    });
  });

  it('fetchAccountInfo falls back to Chinese for a locale the frontend does not support', async () => {
    const { client } = newClient([{ data: { email: 'a@b.c', locale: 'xx' } }]);

    const account = await client.fetchAccountInfo();

    expect(account.email).toBe('a@b.c');
    expect(account.locale?.code).toBe('zh');
  });
});

describe('RestClient login and logout', () => {
  it('login stores the token without calling extra endpoints', async () => {
    const { client, calls } = newClient([{ data: 'jwt-123' }]);

    await client.login({ email: 'me@x.y', password: 'p' });

    expect(calls[0]).toMatchObject({ method: 'POST', url: `${API}/api/restful/authenticate` });
    expect(JSON.parse(defined(calls[0]).data as string)).toEqual({
      email: 'me@x.y',
      password: 'p',
    });
    expect(JwtTokenConfig.retreiveToken()).toBe('jwt-123');
    expect(calls).toHaveLength(1);
  });

  it('login reports bad credentials with code 1 without expiring the session', async () => {
    const expired = jest.fn();
    const { client } = newClient([{ status: 401, data: { globalErrors: ['Bad credentials'] } }]);
    client.onSessionExpired(expired);

    await expect(client.login({ email: 'a', password: 'b' })).rejects.toEqual({
      msg: 'Bad credentials',
      status: 401,
      isAuth: false,
      code: 1,
    });
    expect(expired).not.toHaveBeenCalled();
  });

  it('a failed login logs neither the password nor the token', async () => {
    JwtTokenConfig.storeToken('secret.jwt.value');
    const { client } = newClient([{ status: 500, data: { globalErrors: ['Boom'] } }]);

    await expect(client.login({ email: 'a', password: 'S3cret-pass!' })).rejects.toBeDefined();

    const logged = inspect(jest.mocked(appLogger.error).mock.calls, { depth: 10 });
    expect(appLogger.error).toHaveBeenCalled();
    expect(logged).not.toContain('S3cret-pass!');
    expect(logged).not.toContain('secret.jwt.value');
    expect(logged).toContain('/api/restful/authenticate');
    expect(logged).toContain('500');
  });

  it('login reports a 403 (account not active) with code 3', async () => {
    const { client } = newClient([{ status: 403, data: { globalErrors: ['Inactive'] } }]);

    await expect(client.login({ email: 'a', password: 'b' })).rejects.toMatchObject({
      msg: 'Inactive',
      code: 3,
    });
  });

  it('login reports a network failure with code 1', async () => {
    const { client } = newClient(['network']);

    await expect(client.login({ email: 'a', password: 'b' })).rejects.toEqual({
      msg: 'Unexpected error. Please, try latter',
      code: 1,
    });
  });

  it('logout removes the token and tells the backend', async () => {
    JwtTokenConfig.storeToken('tok');
    const { client, calls } = newClient();

    await client.logout();
    await flushPromises();

    expect(JwtTokenConfig.retreiveToken()).toBeUndefined();
    expect(calls[0]).toMatchObject({ method: 'POST', url: `${API}/api/restful/logout` });
  });
  // The backend call is awaited, so a failed logout is logged (it used to escape the try/catch
  // as an unhandled promise rejection).
  it('logout logs a backend failure', async () => {
    const client = new RestClient(API);
    // Already handled here, so the test run itself sees no unhandled rejection.
    const failure = Promise.reject(new Error('backend down'));
    failure.catch(() => undefined);
    (client as unknown as { axios: { post: () => Promise<unknown> } }).axios.post = () => failure;

    await client.logout();
    await flushPromises();

    expect(appLogger.error).toHaveBeenCalledWith(
      'Error logging out from backend',
      expect.anything(),
    );
  });
});

describe('RestClient OAuth callbacks', () => {
  const oauthReply = { data: { email: 'o@x.y', oauthSync: true, syncCode: 'S', jwtToken: 'J' } };

  it('processGoogleCallback returns the sync result and stores the token', async () => {
    const { client, calls } = newClient([oauthReply]);

    await expect(client.processGoogleCallback('the-code')).resolves.toEqual({
      email: 'o@x.y',
      oauthSync: true,
      syncCode: 'S',
    });

    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: `${API}/api/restful/oauth2/googlecallback?code=the-code`,
    });
    expect(JwtTokenConfig.retreiveToken()).toBe('J');
    expect(calls).toHaveLength(1);
  });

  it('processGoogleCallback keeps no token when the server sends none', async () => {
    const noToken = newClient([{ data: { email: 'o', oauthSync: false } }]);
    await noToken.client.processGoogleCallback('c');
    expect(noToken.calls).toHaveLength(1);
    expect(JwtTokenConfig.retreiveToken()).toBeUndefined();
  });

  it('processGoogleCallback rejects with the server error', async () => {
    const { client } = newClient([{ status: 400, data: { globalErrors: ['Bad code'] } }]);

    await expect(client.processGoogleCallback('c')).rejects.toMatchObject({
      msg: 'Bad code',
      status: 400,
    });
  });

  // The code travels in the query string, so the body is a JSON null like confirmAccountSync's;
  // the request config used to be sent as the body (`{"headers":{"Content-Type":...}}`).
  it('processGoogleCallback sends no payload, only the JSON content type', async () => {
    const { client, calls } = newClient([{ data: { email: 'o' } }]);

    await client.processGoogleCallback('c');

    expect(defined(calls[0]).data).toBe('null');
    expect(defined(calls[0]).header('Content-Type')).toBe('application/json');
  });

  it('confirmAccountSync puts email, code and provider and stores the token', async () => {
    const { client, calls } = newClient([oauthReply]);

    await expect(client.confirmAccountSync('a@b.c', 'C1', 'google')).resolves.toEqual({
      email: 'o@x.y',
      oauthSync: true,
      syncCode: 'S',
    });

    expect(calls[0]).toMatchObject({
      method: 'PUT',
      url: `${API}/api/restful/oauth2/confirmaccountsync?email=a%40b.c&code=C1&provider=google`,
    });
    expect(JwtTokenConfig.retreiveToken()).toBe('J');
  });

  it('confirmAccountSync sends only the email when code and provider are missing', async () => {
    const { client, calls } = newClient([{ data: { email: 'o' } }]);

    await client.confirmAccountSync('a@b.c');

    expect(defined(calls[0]).url).toBe(
      `${API}/api/restful/oauth2/confirmaccountsync?email=a%40b.c`,
    );
  });

  it('confirmAccountSync rejects with server errors', async () => {
    const ko = newClient([{ status: 409, data: { globalErrors: ['Conflict'] } }]);
    await expect(ko.client.confirmAccountSync('a')).rejects.toMatchObject({
      msg: 'Conflict',
      status: 409,
    });
  });
});

describe('RestClient error handling', () => {
  // Every endpoint shares the same error mapping; drive it through one call per case.
  const failWith = (reply: Reply) => newClient([reply]).client.deleteMap(1);

  it('uses the first global error as the message', async () => {
    await expect(
      failWith({ status: 400, data: { globalErrors: ['First', 'Second'] } }),
    ).rejects.toEqual({ msg: 'First', status: 400, isAuth: false });
  });

  it('keeps the field errors and uses the first one as message when there is no global one', async () => {
    await expect(
      failWith({ status: 400, data: { globalErrors: [], fieldErrors: { email: 'Bad email' } } }),
    ).rejects.toEqual({
      msg: 'Bad email',
      fields: { email: 'Bad email' },
      status: 400,
      isAuth: false,
    });
  });

  it('keeps the global message when there are also field errors', async () => {
    await expect(
      failWith({ status: 400, data: { globalErrors: ['G'], fieldErrors: { a: 'F' } } }),
    ).rejects.toMatchObject({ msg: 'G', fields: { a: 'F' } });
  });

  it('falls back to a plain-text body, then to data.message', async () => {
    await expect(failWith({ status: 500, data: 'Server exploded' })).rejects.toEqual({
      msg: 'Server exploded',
      status: 500,
      isAuth: false,
    });
    await expect(failWith({ status: 500, data: { message: 'From message' } })).rejects.toEqual({
      msg: 'From message',
      status: 500,
      isAuth: false,
    });
  });

  it('falls back to the status text when there is no body', async () => {
    await expect(failWith({ status: 404, statusText: 'Not Found' })).rejects.toEqual({
      msg: 'Not Found',
      status: 404,
      isAuth: false,
    });
    await expect(failWith({ status: 404, statusText: '  ' })).rejects.toEqual({
      status: 404,
      isAuth: false,
    });
  });

  it('ignores blank text bodies and blank messages', async () => {
    await expect(failWith({ status: 500, data: '   ' })).rejects.toEqual({
      status: 500,
      isAuth: false,
    });
    await expect(failWith({ status: 500, data: { message: ' ' } })).rejects.toEqual({
      status: 500,
      isAuth: false,
    });
  });

  it('treats a 403 without a session token as an auth problem', async () => {
    await expect(failWith({ status: 403, data: {} })).rejects.toEqual({
      status: 403,
      isAuth: true,
    });

    JwtTokenConfig.storeToken('tok');
    await expect(failWith({ status: 403, data: {} })).rejects.toEqual({
      status: 403,
      isAuth: false,
    });
  });

  it('treats a 403 with an expired token as an auth problem', async () => {
    // The backend reads an expired JWT as anonymous, so a private map answers 403. The cookie
    // outlives the JWT: a returning user opening a map link was told they had no access
    // instead of being sent to sign in.
    JwtTokenConfig.storeToken(tokenExpiringIn(-60));
    await expect(failWith({ status: 403, data: {} })).rejects.toEqual({
      status: 403,
      isAuth: true,
    });
  });

  it('turns a 401 without details into a session-expired auth error', async () => {
    JwtTokenConfig.storeToken(tokenExpiringIn(3600));
    const expired = jest.fn();
    const { client } = newClient([{ status: 401 }]);
    client.onSessionExpired(expired);

    await expect(client.deleteMap(1)).rejects.toEqual({
      isAuth: true,
      msg: 'Your current session has expired. Please, sign in and try again.',
      status: 401,
    });
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('treats a 302 redirect like an expired session', async () => {
    await expect(failWith({ status: 302 })).rejects.toMatchObject({ isAuth: true, status: 302 });
  });

  it('reports a network failure with a generic message', async () => {
    await expect(failWith('network')).rejects.toEqual({
      msg: 'Unexpected error. Please, try latter',
    });
  });

  const expiryNotified = async (status: number, token?: string): Promise<boolean> => {
    if (token) {
      JwtTokenConfig.storeToken(token);
    }
    const expired = jest.fn();
    const { client } = newClient([{ status, data: {} }]);
    client.onSessionExpired(expired);
    await expect(client.deleteMap(1)).rejects.toBeDefined();
    return expired.mock.calls.length > 0;
  };

  it('a 401 on a signed-in request is an expired session', async () => {
    expect(await expiryNotified(401, tokenExpiringIn(3600))).toBe(true);
  });

  it('a 403 sent with an expired token is an expired session', async () => {
    expect(await expiryNotified(403, tokenExpiringIn(-60))).toBe(true);
  });

  it('a 403 sent with a valid token is a refusal, not an expired session', async () => {
    // A map that was unshared or deleted meanwhile: the user is still signed in.
    expect(await expiryNotified(403, tokenExpiringIn(3600))).toBe(false);
  });

  it('a 401 or 403 without a token is no session expiry: nobody was signed in', async () => {
    // An anonymous visitor on a public map: the account request answers 401, and a "session
    // expired" dialog used to cover the map.
    expect(await expiryNotified(401)).toBe(false);
    expect(await expiryNotified(403)).toBe(false);
  });

  it('a 405 is no session expiry', async () => {
    expect(await expiryNotified(405, tokenExpiringIn(3600))).toBe(false);
  });

  it('does not notify the session-expired callback on other errors', async () => {
    const expired = jest.fn();
    const { client } = newClient([{ status: 500, data: {} }, 'network']);
    client.onSessionExpired(expired);

    await expect(client.deleteMap(1)).rejects.toBeDefined();
    await expect(client.deleteMap(1)).rejects.toBeDefined();

    expect(expired).not.toHaveBeenCalled();
  });

  it('onSessionExpired returns the registered callback and keeps it when called without one', () => {
    const client = new RestClient(API);
    const cb = jest.fn();

    expect(client.onSessionExpired(cb)).toBe(cb);
    expect(client.onSessionExpired()).toBe(cb);
  });

  it.each<[string, (c: RestClient) => Promise<unknown>]>([
    ['fetchMapMetadata', (c) => c.fetchMapMetadata(1)],
    ['importMap', (c) => c.importMap({ title: 't' })],
    ['fetchAccountInfo', (c) => c.fetchAccountInfo()],
    ['deleteMaps', (c) => c.deleteMaps([1])],
    ['revertHistory', (c) => c.revertHistory(1, 2)],
    ['fetchHistory', (c) => c.fetchHistory(1)],
    ['createMap', (c) => c.createMap({ title: 't' })],
    ['fetchAllMaps', (c) => c.fetchAllMaps()],
    ['duplicateMap', (c) => c.duplicateMap(1, { title: 't' })],
    ['updateStarred', (c) => c.updateStarred(1, true)],
    ['fetchLabels', (c) => c.fetchLabels()],
    ['createLabel', (c) => c.createLabel('t', 'c')],
    ['deleteLabel', (c) => c.deleteLabel(1)],
    ['addLabelToMap', (c) => c.addLabelToMap(1, 2)],
    ['deleteLabelFromMap', (c) => c.deleteLabelFromMap(1, 2)],
  ])('%s rejects with the parsed server error', async (_name, call) => {
    const { client } = newClient(() => ({ status: 409, data: { globalErrors: ['Conflict'] } }));

    await expect(call(client)).rejects.toMatchObject({ msg: 'Conflict', status: 409 });
  });
});
