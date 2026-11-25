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
import LocalStorageManager from '../../../src/components/LocalStorageManager';
import MockPersistenceManager from '../../../src/components/MockPersistenceManager';
import PersistenceManager from '../../../src/components/PersistenceManager';

const MAP_XML = '<map version="tango"><topic central="true" text="Central" id="1"/></map>';
const BROKEN_XML = '<html><body>Bad <b>gateway</body></html>';

const buildDoc = (): Document => new DOMParser().parseFromString(MAP_XML, 'text/xml');

const buildEvents = () => ({ onSuccess: jest.fn(), onError: jest.fn() });

describe('LocalStorageManager', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('settles the save of a read-only manager (B-SETTLE)', () => {
    const manager = new LocalStorageManager('/maps/{id}', false, undefined, true);
    const events = buildEvents();

    manager.saveMapXml('1', buildDoc(), '{}', false, events);

    expect(events.onSuccess).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('1-xml')).toBeNull();
  });

  it('stores the map and settles the save of a writable manager', () => {
    const manager = new LocalStorageManager('/maps/{id}', false, undefined, false);
    const events = buildEvents();

    manager.saveMapXml('1', buildDoc(), '{}', false, events);

    expect(events.onSuccess).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('1-xml')).toContain('Central');
  });

  it('does not log the whole map on save (B-SETTLE)', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const manager = new LocalStorageManager('/maps/{id}', false, undefined, false);

    manager.saveMapXml('1', buildDoc(), '{}', false, buildEvents());

    expect(log).not.toHaveBeenCalled();
  });

  it('rejects a map stored in local storage that is not well-formed XML (D8)', async () => {
    localStorage.setItem('1-xml', BROKEN_XML);
    const manager = new LocalStorageManager('/maps/{id}', false, undefined, false);

    await expect(manager.loadMapDom('1')).rejects.toThrow(/XML/);
  });

  it('rejects a fetched map that is not well-formed XML (D8)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve(BROKEN_XML),
    });
    const manager = new LocalStorageManager('/maps/{id}', true, undefined, true);

    await expect(manager.loadMapDom('1')).rejects.toThrow(/XML/);
  });

  it('loads a well-formed fetched map', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve(MAP_XML),
    });
    const manager = new LocalStorageManager('/maps/{id}', true, undefined, true);

    const doc = await manager.loadMapDom('1');
    expect(doc.documentElement.nodeName).toBe('map');
  });
});

const MAP_XML_V1 = '<map version="tango"><topic central="true" text="Version 1" id="1"/></map>';
const MAP_XML_V2 = '<map version="tango"><topic central="true" text="Version 2" id="1"/></map>';

const buildDocFrom = (xml: string): Document => new DOMParser().parseFromString(xml, 'text/xml');

describe('MockPersistenceManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('settles the save (B-SETTLE)', () => {
    const manager: PersistenceManager = new MockPersistenceManager(MAP_XML);
    const events = buildEvents();

    manager.saveMapXml('1', buildDoc(), '{}', false, events);

    expect(events.onSuccess).toHaveBeenCalledTimes(1);
  });

  it('accepts a save without events', () => {
    const manager: PersistenceManager = new MockPersistenceManager(MAP_XML);
    expect(() => manager.saveMapXml('1', buildDoc(), '{}', false)).not.toThrow();
  });

  it('persists current XML and props without creating history on minor saves', () => {
    localStorage.setItem(
      'wisemapping.mock.maps',
      JSON.stringify([{ id: 1, title: 'Demo', lastModificationTime: '2020-01-01T00:00:00Z' }]),
    );
    localStorage.setItem('mock-map-1-xml', 'legacy');

    const manager = new MockPersistenceManager(MAP_XML, { editorName: 'Owner' });
    const events = buildEvents();

    manager.saveMapXml('1', buildDocFrom(MAP_XML_V1), '{"zoom":1.2}', false, events);

    expect(events.onSuccess).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('wisemapping.mock.xml.1')).toContain('Version 1');
    expect(localStorage.getItem('mock-map-1-xml')).toBeNull();
    expect(localStorage.getItem('wisemapping.mock.props.1')).toBe('{"zoom":1.2}');
    expect(localStorage.getItem('wisemapping.mock.history.1')).toBeNull();

    const maps = JSON.parse(localStorage.getItem('wisemapping.mock.maps') || '[]');
    expect(maps[0].lastModificationBy).toBe('Owner');
    expect(maps[0].lastModificationTime).not.toBe('2020-01-01T00:00:00Z');
  });

  it('appends monotonically ordered snapshots only when saveHistory is true', () => {
    const manager = new MockPersistenceManager(MAP_XML, { editorName: 'Alice' });

    manager.saveMapXml('1', buildDocFrom(MAP_XML_V1), '{}', true);
    manager.saveMapXml('1', buildDocFrom(MAP_XML_V2), '{}', true);

    const history = JSON.parse(localStorage.getItem('wisemapping.mock.history.1') || '[]');
    expect(history).toHaveLength(2);
    expect(history[0].id).toBeGreaterThan(history[1].id);
    expect(history[0].xml).toContain('Version 2');
    expect(history[1].xml).toContain('Version 1');
    expect(history[0].lastModificationBy).toBe('Alice');
  });

  it('loads a specific history snapshot by hid and rejects missing ones', async () => {
    const writer = new MockPersistenceManager(MAP_XML, { editorName: 'Alice' });
    writer.saveMapXml('1', buildDocFrom(MAP_XML_V1), '{}', true);
    writer.saveMapXml('1', buildDocFrom(MAP_XML_V2), '{}', true);

    const history = JSON.parse(localStorage.getItem('wisemapping.mock.history.1') || '[]');
    const olderId = history[1].id;

    const reader = new MockPersistenceManager(MAP_XML, { hid: olderId });
    const doc = await reader.loadMapDom('1');
    expect(new XMLSerializer().serializeToString(doc)).toContain('Version 1');

    // A history-view manager must not mutate current XML or history.
    const events = buildEvents();
    reader.saveMapXml('1', buildDocFrom(MAP_XML), '{}', true, events);
    expect(events.onSuccess).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('wisemapping.mock.xml.1')).toContain('Version 2');
    expect(JSON.parse(localStorage.getItem('wisemapping.mock.history.1') || '[]')).toHaveLength(2);

    const missingReader = new MockPersistenceManager(MAP_XML, { hid: 999999 });
    await expect(missingReader.loadMapDom('1')).rejects.toThrow('History entry 999999');
  });

  it('discardChanges restores the latest snapshot without deleting maps that have no history', () => {
    const manager = new MockPersistenceManager(MAP_XML, { editorName: 'Alice' });

    // No history yet: current XML is preserved.
    manager.saveMapXml('1', buildDocFrom(MAP_XML_V1), '{}', false);
    manager.discardChanges('1');
    expect(localStorage.getItem('wisemapping.mock.xml.1')).toContain('Version 1');

    // With a saved snapshot: minor edits are discarded back to the latest snapshot.
    manager.saveMapXml('1', buildDocFrom(MAP_XML_V1), '{}', true);
    manager.saveMapXml('1', buildDocFrom(MAP_XML_V2), '{}', false);
    expect(localStorage.getItem('wisemapping.mock.xml.1')).toContain('Version 2');

    manager.discardChanges('1');
    expect(localStorage.getItem('wisemapping.mock.xml.1')).toContain('Version 1');
  });
});

describe('PersistenceManager.save', () => {
  class FailingManager extends PersistenceManager {
    saveMapXml(): void {
      throw new Error('storage full');
    }

    discardChanges(): void {
      // Not used.
    }

    loadMapDom(): Promise<Document> {
      return Promise.resolve(buildDoc());
    }

    unlockMap(): void {
      // Not used.
    }
  }

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not crash when the save fails and no events were given (B-SETTLE)', () => {
    const mindmap = PersistenceManager.loadFromDom('1', buildDoc());
    const manager = new FailingManager();

    expect(() => manager.save(mindmap, {}, false)).not.toThrow();
  });

  it('reports a failed save through events.onError', () => {
    const mindmap = PersistenceManager.loadFromDom('1', buildDoc());
    const manager = new FailingManager();
    const events = buildEvents();

    manager.save(mindmap, {}, false, events);

    expect(events.onError).toHaveBeenCalledTimes(1);
  });
});
