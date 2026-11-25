export const MAX_SUPPORTED_NODES = 4000;
export const MAX_MAP_TITLE_LENGTH = 512;
export const MAX_MAP_DESCRIPTION_LENGTH = 512;
export const MAX_LABEL_TITLE_LENGTH = 30;
export const MAX_LABEL_COLOR_LENGTH = 7;
export const MAX_NOTE_LENGTH = 10000;

export type XmlValidationResult =
  | { valid: true; trimmed: string; topicCount: number }
  | { valid: false; message: string; errorCode: string };

export interface NoteValidationResponse {
  rawLength: number;
  textLength: number;
  html: boolean;
  remainingChars: number;
  overLimit: boolean;
  usagePercentage: number;
  statusMessage: string;
  statusClass: 'note-counter-normal' | 'note-counter-warning' | 'note-counter-over-limit';
}

const DISALLOWED_HTML_PATTERNS: RegExp[] = [
  /<script\b/i,
  /<\/script>/i,
  /javascript\s*:/i,
  /<iframe\b/i,
  /<object\b/i,
  /<embed\b/i,
  /\bon(?:load|error|click|mouseover|focus|blur|submit|change|input|keydown|keyup|mouseenter|mouseleave)\s*=/i,
];

export function validateMindmapXml(xml: unknown): XmlValidationResult {
  if (typeof xml !== 'string') {
    return {
      valid: false,
      message: 'Mind map XML must be a string.',
      errorCode: 'INVALID_MINDMAP_FORMAT',
    };
  }
  const trimmed = xml.trim();
  if (trimmed.length === 0) {
    return {
      valid: false,
      message: 'Mind map XML cannot be empty.',
      errorCode: 'MINDMAP_EMPTY_ERROR',
    };
  }
  if (!trimmed.startsWith('<map') || !trimmed.endsWith('</map>')) {
    return {
      valid: false,
      message: 'Invalid mind map XML format: must start with <map and end with </map>.',
      errorCode: 'INVALID_MINDMAP_FORMAT',
    };
  }

  const topicCount = trimmed.match(/<topic\b/g)?.length ?? 0;
  if (topicCount < 1) {
    return {
      valid: false,
      message: 'Mind map XML must contain at least one <topic> element.',
      errorCode: 'INVALID_MINDMAP_FORMAT',
    };
  }
  if (topicCount > MAX_SUPPORTED_NODES) {
    return {
      valid: false,
      message: `Mind map exceeds the maximum supported limit of ${MAX_SUPPORTED_NODES} topics.`,
      errorCode: 'TOO_BIG_MINDMAP',
    };
  }

  for (const pattern of DISALLOWED_HTML_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        valid: false,
        message: 'Mind map XML contains disallowed script or event-handler content.',
        errorCode: 'INVALID_MINDMAP_SECURITY',
      };
    }
  }

  return { valid: true, trimmed, topicCount };
}

export function validateTitle(title: unknown): { valid: true; value: string } | { valid: false; message: string } {
  if (typeof title !== 'string' || title.trim().length === 0) {
    return { valid: false, message: 'Title is required and cannot be blank.' };
  }
  const trimmed = title.trim();
  if (trimmed.length > MAX_MAP_TITLE_LENGTH) {
    return { valid: false, message: `Title cannot exceed ${MAX_MAP_TITLE_LENGTH} characters.` };
  }
  return { valid: true, value: trimmed };
}

export function validateDescription(
  description: unknown,
): { valid: true; value: string } | { valid: false; message: string } {
  if (description === undefined || description === null) {
    return { valid: true, value: '' };
  }
  if (typeof description !== 'string') {
    return { valid: false, message: 'Description must be a string.' };
  }
  if (description.length > MAX_MAP_DESCRIPTION_LENGTH) {
    return {
      valid: false,
      message: `Description cannot exceed ${MAX_MAP_DESCRIPTION_LENGTH} characters.`,
    };
  }
  return { valid: true, value: description.trim() };
}

export function validateLabelInput(
  title: unknown,
  color: unknown,
): { valid: true; title: string; color: string } | { valid: false; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};

  const trimmedTitle = typeof title === 'string' ? title.trim() : '';
  if (!trimmedTitle) {
    fieldErrors['title'] = 'Label title is required.';
  } else if (trimmedTitle.length > MAX_LABEL_TITLE_LENGTH) {
    fieldErrors['title'] = `Label title cannot exceed ${MAX_LABEL_TITLE_LENGTH} characters.`;
  }

  const trimmedColor = typeof color === 'string' ? color.trim() : '';
  if (!trimmedColor) {
    fieldErrors['color'] = 'Label color is required.';
  } else if (trimmedColor.length > MAX_LABEL_COLOR_LENGTH) {
    fieldErrors['color'] = `Label color cannot exceed ${MAX_LABEL_COLOR_LENGTH} characters.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false, fieldErrors };
  }
  return { valid: true, title: trimmedTitle, color: trimmedColor };
}

function decodeBasicHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function validateNoteContent(note: string): NoteValidationResponse {
  const rawLength = note.length;
  const html = /<[a-zA-Z][a-zA-Z0-9]*[^>]*>/.test(note);
  const textLength = html
    ? decodeBasicHtmlEntities(note.replace(/<[^>]*>/g, '')).length
    : rawLength;

  const remainingChars = MAX_NOTE_LENGTH - textLength;
  const overLimit = textLength > MAX_NOTE_LENGTH;
  const usagePercentage = (textLength / MAX_NOTE_LENGTH) * 100;

  let statusMessage: string;
  let statusClass: NoteValidationResponse['statusClass'];

  if (overLimit) {
    statusMessage = `Note exceeds limit by ${-remainingChars} characters`;
    statusClass = 'note-counter-over-limit';
  } else if (usagePercentage >= 90) {
    statusMessage = `Note is near limit (${remainingChars} characters remaining)`;
    statusClass = 'note-counter-warning';
  } else {
    statusMessage = `${remainingChars} characters remaining`;
    statusClass = 'note-counter-normal';
  }

  return {
    rawLength,
    textLength,
    html,
    remainingChars,
    overLimit,
    usagePercentage,
    statusMessage,
    statusClass,
  };
}

export function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildDefaultMindmapXml(title: string, layout = 'mindmap'): string {
  const safeLayout = layout.trim() || 'mindmap';
  return `<map version="tango" theme="prism" layout="${escapeXmlAttr(safeLayout)}"><topic central="true" text="${escapeXmlAttr(title)}"/></map>`;
}
