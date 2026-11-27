import { describe, expect, it } from 'vitest';
import {
  MAX_NOTE_LENGTH,
  MAX_SUPPORTED_NODES,
  buildDefaultMindmapXml,
  validateDescription,
  validateLabelInput,
  validateMindmapXml,
  validateNoteContent,
  validateTitle,
} from '../../api/_core/lib/validators';

describe('functions validators', () => {
  it('validates mindmap XML structure, topic counts, and security rules', () => {
    const valid = validateMindmapXml('<map version="tango"><topic central="true" text="Hi"/></map>');
    expect(valid.valid).toBe(true);

    expect(validateMindmapXml(null).valid).toBe(false);
    expect(validateMindmapXml('   ').valid).toBe(false);
    expect(validateMindmapXml('<notmap><topic/></notmap>').valid).toBe(false);
    expect(validateMindmapXml('<map></map>').valid).toBe(false);
    expect(validateMindmapXml('<map><topic text="hi"/><script>alert(1)</script></map>').valid).toBe(
      false,
    );
    expect(
      validateMindmapXml('<map><topic text="hi" url="javascript:alert(1)"/></map>').valid,
    ).toBe(false);
    expect(
      validateMindmapXml('<map><topic text="hi" onload="evil()"/></map>').valid,
    ).toBe(false);

    const tooManyTopics = `<map>${'<topic text="n"/>'.repeat(MAX_SUPPORTED_NODES + 1)}</map>`;
    const tooBigRes = validateMindmapXml(tooManyTopics);
    expect(tooBigRes.valid).toBe(false);
    if (!tooBigRes.valid) {
      expect(tooBigRes.errorCode).toBe('TOO_BIG_MINDMAP');
    }
  });

  it('validates title, description, and label inputs', () => {
    expect(validateTitle('  My Map  ')).toEqual({ valid: true, value: 'My Map' });
    expect(validateTitle('   ').valid).toBe(false);
    expect(validateTitle('a/b').valid).toBe(false);
    expect(validateTitle('a\\b').valid).toBe(false);
    expect(validateTitle('a'.repeat(513)).valid).toBe(false);

    expect(validateDescription(undefined)).toEqual({ valid: true, value: '' });
    expect(validateDescription(' ')).toEqual({ valid: true, value: '' });
    expect(validateDescription('d'.repeat(513)).valid).toBe(false);

    expect(validateLabelInput('Work', '#ff0000')).toEqual({
      valid: true,
      title: 'Work',
      color: '#ff0000',
    });
    expect(validateLabelInput('', '#ff0000').valid).toBe(false);
    expect(validateLabelInput('a'.repeat(31), '#ff0000').valid).toBe(false);
    expect(validateLabelInput('Work', '').valid).toBe(false);
  });

  it('computes NoteValidationResponse accurately across normal, warning, and over-limit', () => {
    const exactLimit = validateNoteContent('a'.repeat(MAX_NOTE_LENGTH));
    expect(exactLimit.overLimit).toBe(false);
    expect(exactLimit.remainingChars).toBe(0);
    expect(exactLimit.statusClass).toBe('note-counter-warning');

    const overLimit = validateNoteContent('a'.repeat(MAX_NOTE_LENGTH + 1));
    expect(overLimit.overLimit).toBe(true);
    expect(overLimit.remainingChars).toBe(-1);
    expect(overLimit.statusClass).toBe('note-counter-over-limit');

    const htmlNote = validateNoteContent('<p>Hello &amp; world</p>');
    expect(htmlNote.html).toBe(true);
    expect(htmlNote.rawLength).toBe(24);
    expect(htmlNote.textLength).toBe(13);
    expect(htmlNote.statusClass).toBe('note-counter-normal');
  });

  it('escapes XML special characters in default mindmap generator', () => {
    const xml = buildDefaultMindmapXml('R&D <"Alpha">');
    expect(xml).toContain('text="R&amp;D &lt;&quot;Alpha&quot;&gt;"');
    expect(validateMindmapXml(xml).valid).toBe(true);
  });
});
