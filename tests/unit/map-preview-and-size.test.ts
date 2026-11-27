import { describe, expect, it } from 'vitest';
import { extractMapPreview } from '../../api/_core/lib/preview';
import { createApiHandler } from '../../api/_core/api';
import { InMemoryMindmapRepo, TEST_OWNER_EMAIL, TEST_OWNER_NAME, TEST_OWNER_UID, signTestJwt } from '../contract/test-helpers';

describe('extractMapPreview & /maps metadata fields', () => {
  it('extracts central topic, up to 6 level-1 branches, theme, and topic count', () => {
    const xml = `
      <map name="demo" version="tango" theme="prism">
        <topic central="true" text="中心主题 &amp; A">
          <topic position="180,0" text="右侧分支1" bgColor="#E0F2FE">
            <topic text="二级子节点" />
          </topic>
          <topic position="-180,0" text="左侧分支1" />
        </topic>
      </map>
    `;

    const preview = extractMapPreview(xml, 'Fallback');
    expect(preview.centralTopic).toBe('中心主题 & A');
    expect(preview.theme).toBe('prism');
    expect(preview.topicCount).toBe(4);
    expect(preview.branches).toEqual([
      { text: '右侧分支1', side: 'right', color: '#E0F2FE' },
      { text: '左侧分支1', side: 'left' },
    ]);
  });

  it('returns sizeBytes, lastOpenTime, and preview in GET /api/restful/maps and updates lastOpenTime on xml metadata load', async () => {
    const repo = new InMemoryMindmapRepo();
    const user = { uid: TEST_OWNER_UID, email: TEST_OWNER_EMAIL, name: TEST_OWNER_NAME };
    const created = await repo.createMap(user, {
      title: 'Test Map',
      description: '',
      xml: '<map version="tango"><topic central="true" text="Root"><topic position="100,0" text="Child" /></topic></map>',
    });

    const token = await signTestJwt();
    const handler = createApiHandler({
      repo,
      authenticate: async () => ({ uid: TEST_OWNER_UID, email: TEST_OWNER_EMAIL, name: TEST_OWNER_NAME }),
    });

    const listRes = await handler(
      new Request('http://localhost/api/restful/maps', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as {
      mindmapsInfo: Array<{
        id: number;
        sizeBytes: number;
        lastOpenTime: string;
        preview: { centralTopic: string; branches: Array<{ text: string }> };
      }>;
    };
    expect(listData.mindmapsInfo).toHaveLength(1);
    const item = listData.mindmapsInfo[0]!;
    expect(item.sizeBytes).toBeGreaterThan(50);
    expect(item.lastOpenTime).toBeTruthy();
    expect(item.preview.centralTopic).toBe('Root');
    expect(item.preview.branches[0]?.text).toBe('Child');

    await new Promise((r) => setTimeout(r, 15));

    const openRes = await handler(
      new Request(`http://localhost/api/restful/maps/${created.id}/metadata?xml=true`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(openRes.status).toBe(200);
    const openData = (await openRes.json()) as { lastOpenTime: string; sizeBytes: number };
    expect(openData.sizeBytes).toBe(item.sizeBytes);
    expect(new Date(openData.lastOpenTime).getTime()).toBeGreaterThanOrEqual(
      new Date(item.lastOpenTime).getTime(),
    );
  });
});
