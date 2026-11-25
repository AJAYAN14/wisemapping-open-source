import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MIGRATION_FILE } from './migrate-helper';

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\r\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTableBlock(sql: string, tableName: string): string {
  const headerRe = new RegExp(
    `CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+(?:public\\.)?${tableName}\\s*\\(`,
    'i',
  );
  const match = headerRe.exec(sql);
  if (!match) {
    throw new Error(`Table definition not found for ${tableName}`);
  }

  let depth = 1;
  let idx = match.index + match[0].length;
  while (idx < sql.length && depth > 0) {
    const ch = sql[idx];
    if (ch === '(') {
      depth += 1;
    } else if (ch === ')') {
      depth -= 1;
    }
    idx += 1;
  }
  if (depth !== 0) {
    throw new Error(`Unbalanced parentheses in CREATE TABLE for ${tableName}`);
  }
  return sql.slice(match.index + match[0].length, idx - 1).trim();
}

function extractPolicyStatements(sql: string, tableName: string): string[] {
  const re = new RegExp(
    `CREATE\\s+POLICY\\s+[a-z0-9_]+\\s+ON\\s+(?:public\\.)?${tableName}\\b[\\s\\S]*?;`,
    'gi',
  );
  return sql.match(re) ?? [];
}

function findPolicyForCommand(
  policies: string[],
  command: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
): string {
  const re = new RegExp(`\\bFOR\\s+${command}\\b`, 'i');
  const found = policies.find((p) => re.test(p));
  if (!found) {
    throw new Error(`Missing FOR ${command} policy`);
  }
  return found;
}

describe('M2 migration SQL contract (0001_initial_schema.sql)', () => {
  const rawSql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const strippedSql = stripSqlComments(rawSql);

  it('exists, is transaction-wrapped, and contains zero nemo references', () => {
    expect(fs.existsSync(MIGRATION_FILE)).toBe(true);
    expect(rawSql.trim().length).toBeGreaterThan(0);
    expect(strippedSql).toMatch(/^BEGIN;/i);
    expect(strippedSql).toMatch(/COMMIT;$/i);

    expect(/nemo/i.test(rawSql)).toBe(false);
    expect(/nemo/i.test(strippedSql)).toBe(false);
  });

  it('defines exactly 4 clean-slate idempotent tables and excludes legacy Java tables', () => {
    const createTableMatches = Array.from(
      strippedSql.matchAll(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(?:public\.)?([a-z0-9_]+)/gi),
    ).map((m) => m[1]?.toLowerCase());

    expect(createTableMatches).toEqual([
      'mindmaps',
      'mindmap_history',
      'labels',
      'mindmap_labels',
    ]);

    const allCreateTables = strippedSql.match(/CREATE\s+TABLE\b/gi) ?? [];
    expect(allCreateTables).toHaveLength(4);

    const legacyTables = [
      'collaborator',
      'account',
      'collaboration',
      'collaboration_properties',
      'mindmap_xml',
      'mindmap_spam_info',
      'access_auditory',
      'mindmap_inactive_user',
      'r_label_mindmap',
    ];
    for (const legacy of legacyTables) {
      const legacyRe = new RegExp(`\\b${legacy}\\b`, 'i');
      expect(legacyRe.test(strippedSql)).toBe(false);
    }
  });

  it('defines mindmaps with plain TEXT XML, VARCHAR(512) title/description, version check, and allows duplicate titles', () => {
    const block = extractTableBlock(strippedSql, 'mindmaps');

    expect(block).toMatch(/\bid\s+BIGINT\s+GENERATED\s+(?:BY\s+DEFAULT|ALWAYS)\s+AS\s+IDENTITY\s+PRIMARY\s+KEY\b/i);
    expect(block).toMatch(/\bowner_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+auth\.users\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE\b/i);
    expect(block).toMatch(/\btitle\s+VARCHAR\s*\(\s*512\s*\)\s+NOT\s+NULL\b/i);
    expect(block).toMatch(/\bdescription\s+VARCHAR\s*\(\s*512\s*\)\s+DEFAULT\s+''/i);
    expect(block).toMatch(/\bxml\s+TEXT\s+NOT\s+NULL\b/i);
    expect(block).toMatch(/\bproperties\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'\{"zoom":0\.8\}'/i);
    expect(block).toMatch(/\bstarred\s+BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+FALSE\b/i);
    expect(block).toMatch(/\bversion\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+1\b/i);
    expect(block).toMatch(/CHECK\s*\(\s*version\s*>=\s*1\s*\)/i);
    expect(block).toMatch(/\blast_modification_by\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+''/i);
    expect(block).toMatch(/\bcreation_time\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+NOW\(\)/i);
    expect(block).toMatch(/\blast_modification_time\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+NOW\(\)/i);

    // Duplicate mindmap titles must be allowed for duplicateMap
    expect(/UNIQUE\s*\(\s*owner_id\s*,\s*title\s*\)/i.test(block)).toBe(false);
    expect(/CREATE\s+UNIQUE\s+INDEX[\s\S]*?\bON\s+(?:public\.)?mindmaps\b/i.test(strippedSql)).toBe(false);
  });

  it('defines mindmap_history for permanent snapshots cascading from mindmaps and auth.users', () => {
    const block = extractTableBlock(strippedSql, 'mindmap_history');

    expect(block).toMatch(/\bid\s+BIGINT\s+GENERATED\s+(?:BY\s+DEFAULT|ALWAYS)\s+AS\s+IDENTITY\s+PRIMARY\s+KEY\b/i);
    expect(block).toMatch(/\bmindmap_id\s+BIGINT\s+NOT\s+NULL\s+REFERENCES\s+(?:public\.)?mindmaps\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE\b/i);
    expect(block).toMatch(/\bowner_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+auth\.users\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE\b/i);
    expect(block).toMatch(/\bxml\s+TEXT\s+NOT\s+NULL\b/i);
    expect(block).toMatch(/\beditor_name\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+''/i);
    expect(block).toMatch(/\bcreation_time\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+NOW\(\)/i);
  });

  it('defines labels with UNIQUE(owner_id, title), self-parent check, and color/title bounds', () => {
    const block = extractTableBlock(strippedSql, 'labels');

    expect(block).toMatch(/\bid\s+BIGINT\s+GENERATED\s+(?:BY\s+DEFAULT|ALWAYS)\s+AS\s+IDENTITY\s+PRIMARY\s+KEY\b/i);
    expect(block).toMatch(/\bowner_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+auth\.users\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE\b/i);
    expect(block).toMatch(/\btitle\s+VARCHAR\s*\(\s*30\s*\)\s+NOT\s+NULL\b/i);
    expect(block).toMatch(/\bcolor\s+VARCHAR\s*\(\s*7\s*\)\s+NOT\s+NULL\b/i);
    expect(block).toMatch(/\bparent_label_id\s+BIGINT\s+REFERENCES\s+(?:public\.)?labels\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE\b/i);
    expect(block).toMatch(/\bcreation_time\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+NOW\(\)/i);
    expect(block).toMatch(/UNIQUE\s*\(\s*owner_id\s*,\s*title\s*\)/i);
    expect(block).toMatch(/CHECK\s*\(\s*parent_label_id\s+IS\s+NULL\s+OR\s+parent_label_id\s*<>\s*id\s*\)/i);
  });

  it('defines mindmap_labels join table with composite PK and cascade FKs', () => {
    const block = extractTableBlock(strippedSql, 'mindmap_labels');

    expect(block).toMatch(/\bmindmap_id\s+BIGINT\s+NOT\s+NULL\s+REFERENCES\s+(?:public\.)?mindmaps\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE\b/i);
    expect(block).toMatch(/\blabel_id\s+BIGINT\s+NOT\s+NULL\s+REFERENCES\s+(?:public\.)?labels\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE\b/i);
    expect(block).toMatch(/\bowner_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+auth\.users\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE\b/i);
    expect(block).toMatch(/PRIMARY\s+KEY\s*\(\s*mindmap_id\s*,\s*label_id\s*\)/i);
  });

  it('creates all 7 FK and query indexes idempotently', () => {
    const expectedIndexes = [
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+mindmaps_owner_id_last_mod_idx\s+ON\s+(?:public\.)?mindmaps\s*\(\s*owner_id\s*,\s*last_modification_time\s+DESC\s*\)/i,
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+mindmap_history_mindmap_id_creation_idx\s+ON\s+(?:public\.)?mindmap_history\s*\(\s*mindmap_id\s*,\s*creation_time\s+DESC\s*\)/i,
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+mindmap_history_owner_id_idx\s+ON\s+(?:public\.)?mindmap_history\s*\(\s*owner_id\s*\)/i,
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+labels_owner_id_idx\s+ON\s+(?:public\.)?labels\s*\(\s*owner_id\s*\)/i,
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+labels_parent_label_id_idx\s+ON\s+(?:public\.)?labels\s*\(\s*parent_label_id\s*\)/i,
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+mindmap_labels_label_id_idx\s+ON\s+(?:public\.)?mindmap_labels\s*\(\s*label_id\s*\)/i,
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+mindmap_labels_owner_id_idx\s+ON\s+(?:public\.)?mindmap_labels\s*\(\s*owner_id\s*\)/i,
    ];

    for (const pattern of expectedIndexes) {
      expect(strippedSql).toMatch(pattern);
    }
  });

  it('enforces ENABLE + FORCE RLS, revokes anon/PUBLIC, grants authenticated DML, and splits per-command policies', () => {
    const tables = ['mindmaps', 'mindmap_history', 'labels', 'mindmap_labels'] as const;
    const identitySequences = ['mindmaps_id_seq', 'mindmap_history_id_seq', 'labels_id_seq'] as const;

    expect(strippedSql).toMatch(/GRANT\s+USAGE\s+ON\s+SCHEMA\s+public\s+TO\s+authenticated\s*,\s*service_role/i);

    for (const table of tables) {
      expect(strippedSql).toMatch(
        new RegExp(`ALTER\\s+TABLE\\s+(?:public\\.)?${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i'),
      );
      expect(strippedSql).toMatch(
        new RegExp(`ALTER\\s+TABLE\\s+(?:public\\.)?${table}\\s+FORCE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i'),
      );
      expect(strippedSql).toMatch(
        new RegExp(`REVOKE\\s+ALL\\s+ON\\s+TABLE\\s+(?:public\\.)?${table}\\s+FROM\\s+anon\\s*,\\s*PUBLIC`, 'i'),
      );
      expect(strippedSql).toMatch(
        new RegExp(
          `GRANT\\s+SELECT\\s*,\\s*INSERT\\s*,\\s*UPDATE\\s*,\\s*DELETE\\s+ON\\s+TABLE\\s+(?:public\\.)?${table}\\s+TO\\s+authenticated`,
          'i',
        ),
      );

      const policies = extractPolicyStatements(strippedSql, table);
      expect(policies).toHaveLength(4);
      const joined = policies.join(' ');
      expect(joined).toMatch(/\bFOR\s+SELECT\b/i);
      expect(joined).toMatch(/\bFOR\s+INSERT\b/i);
      expect(joined).toMatch(/\bFOR\s+UPDATE\b/i);
      expect(joined).toMatch(/\bFOR\s+DELETE\b/i);
      expect(/\bFOR\s+ALL\b/i.test(joined)).toBe(false);

      for (const policy of policies) {
        expect(policy).toMatch(/\bTO\s+authenticated\b/i);
        expect(policy).toMatch(/\(\s*SELECT\s+auth\.uid\(\)\s*\)\s*=\s*owner_id/i);
        expect(/\bOR\s+TRUE\b/i.test(policy)).toBe(false);
        expect(/\bOR\s+1\s*=\s*1\b/i.test(policy)).toBe(false);
        expect(/\b(?:USING|WITH\s+CHECK)\s*\(\s*TRUE\s*\)/i.test(policy)).toBe(false);
        if (/\bFOR\s+UPDATE\b/i.test(policy)) {
          expect(policy).toMatch(/\bUSING\s*\([\s\S]*\(\s*SELECT\s+auth\.uid\(\)\s*\)\s*=\s*owner_id/i);
          expect(policy).toMatch(/\bWITH\s+CHECK\s*\([\s\S]*\(\s*SELECT\s+auth\.uid\(\)\s*\)\s*=\s*owner_id/i);
        }
        const policyNameMatch = /CREATE\s+POLICY\s+([a-z0-9_]+)/i.exec(policy);
        expect(policyNameMatch?.[1]).toBeTruthy();
        expect(strippedSql).toMatch(
          new RegExp(`DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+${policyNameMatch![1]}\\s+ON\\s+(?:public\\.)?${table}`, 'i'),
        );
      }
    }

    for (const seq of identitySequences) {
      expect(strippedSql).toMatch(
        new RegExp(`REVOKE\\s+ALL\\s+ON\\s+SEQUENCE\\s+(?:public\\.)?${seq}\\s+FROM\\s+anon\\s*,\\s*PUBLIC`, 'i'),
      );
      expect(strippedSql).toMatch(
        new RegExp(
          `GRANT\\s+USAGE\\s*,\\s*SELECT\\s+ON\\s+SEQUENCE\\s+(?:public\\.)?${seq}\\s+TO\\s+authenticated`,
          'i',
        ),
      );
    }

    // Zero policies or grants for anon or public
    expect(/CREATE\s+POLICY[^;]*?\bTO\s+(?:anon|public)\b/i.test(strippedSql)).toBe(false);
    expect(/\bGRANT\b[\s\S]*?\bTO\s+(?:anon|public)\b/i.test(strippedSql)).toBe(false);
    expect(/\bGRANT\b[^;]*\bTO\b[^;]*\b(?:anon|public)\b/i.test(strippedSql)).toBe(false);

    // Cross-table ownership EXISTS checks individually on BOTH FOR INSERT and FOR UPDATE policies
    const historyPolicies = extractPolicyStatements(strippedSql, 'mindmap_history');
    for (const cmd of ['INSERT', 'UPDATE'] as const) {
      const policy = findPolicyForCommand(historyPolicies, cmd);
      expect(policy, `mindmap_history FOR ${cmd}`).toMatch(
        /\bWITH\s+CHECK\b[\s\S]*EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+(?:public\.)?mindmaps\b/i,
      );
    }

    const labelPolicies = extractPolicyStatements(strippedSql, 'labels');
    for (const cmd of ['INSERT', 'UPDATE'] as const) {
      const policy = findPolicyForCommand(labelPolicies, cmd);
      expect(policy, `labels FOR ${cmd}`).toMatch(
        /\bWITH\s+CHECK\b[\s\S]*(?:EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+(?:public\.)?labels\b|is_valid_parent_label\b)/i,
      );
    }
    expect(strippedSql).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?is_valid_parent_label\b/i,
    );

    const mindmapLabelPolicies = extractPolicyStatements(strippedSql, 'mindmap_labels');
    for (const cmd of ['INSERT', 'UPDATE'] as const) {
      const policy = findPolicyForCommand(mindmapLabelPolicies, cmd);
      expect(policy, `mindmap_labels FOR ${cmd} mindmaps`).toMatch(
        /\bWITH\s+CHECK\b[\s\S]*EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+(?:public\.)?mindmaps\b/i,
      );
      expect(policy, `mindmap_labels FOR ${cmd} labels`).toMatch(
        /\bWITH\s+CHECK\b[\s\S]*EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+(?:public\.)?labels\b/i,
      );
    }
  });

  it('enforces negative R2 invariants (no BYTEA/ZIP, no public sharing, no history pruning)', () => {
    expect(/\bBYTEA\b/i.test(strippedSql)).toBe(false);
    expect(/\b(?:zlib|gzip|zip|compress)\b/i.test(strippedSql)).toBe(false);
    expect(/\bis_public\b/i.test(strippedSql)).toBe(false);
    expect(/\bCREATE\s+TRIGGER\b/i.test(strippedSql)).toBe(false);
    expect(/\bpg_cron\b/i.test(strippedSql)).toBe(false);
    expect(/DELETE\s+FROM\s+(?:public\.)?mindmap_history\b/i.test(strippedSql)).toBe(false);
  });
});
