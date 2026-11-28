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

const CHINESE_DIGITS: Readonly<Record<string, number>> = {
  零: 0,
  〇: 0,
  一: 1,
  壹: 1,
  二: 2,
  贰: 2,
  两: 2,
  三: 3,
  叁: 3,
  四: 4,
  肆: 4,
  五: 5,
  伍: 5,
  六: 6,
  陆: 6,
  七: 7,
  柒: 7,
  八: 8,
  捌: 8,
  九: 9,
  玖: 9,
};

const CHINESE_SMALL_UNITS: Readonly<Record<string, number>> = {
  十: 10,
  拾: 10,
  百: 100,
  佰: 100,
  千: 1000,
  仟: 1000,
};

const CHINESE_LARGE_UNITS: Readonly<Record<string, number>> = {
  万: 10000,
  亿: 100000000,
};

const CHINESE_NUMERAL_CLASS = '零〇一二两三四五六七八九十百千万亿壹贰叁肆伍陆柒捌玖拾佰仟';

const ORDINAL_PREFIX_REGEX = new RegExp(`第([${CHINESE_NUMERAL_CLASS}]+)`, 'g');

const STRUCTURAL_PREFIX_WORDS =
  '附录|附件|附表|附图|章节|部分|阶段|步骤|方案|项目|版本|模块|专题|单元|课程|讲义|周|卷|篇|节|章|册|回|集|期|季|条|款|项|步|级';

const DELIMITED_NUMERAL_REGEX = new RegExp(
  `(^|[\\s(（\\[【.,、:：\\-_/]|(?:${STRUCTURAL_PREFIX_WORDS}))([${CHINESE_NUMERAL_CLASS}]+)(?=$|[\\s)）\\]】.,、．:：\\-_/章节篇卷讲课回册集期季条款项步级次版组批])`,
  'g',
);

const COLLATE_LOCALE = 'zh-Hans-CN';
const COLLATE_OPTIONS: Intl.CollatorOptions = { numeric: true, sensitivity: 'base' };

/**
 * Parses a valid Chinese numeral string (e.g. `二`, `十二`, `一百零五`, `二〇二六`)
 * into a non-negative integer, returning `null` for malformed combinations like `万一`.
 */
export function parseChineseNumeral(raw: string): number | null {
  if (!raw) {
    return null;
  }

  if (raw.length === 1) {
    if (raw in CHINESE_DIGITS) {
      return CHINESE_DIGITS[raw]!;
    }
    return raw === '十' || raw === '拾' ? 10 : null;
  }

  let hasUnit = false;
  let hasZero = false;
  for (const ch of raw) {
    if (ch in CHINESE_SMALL_UNITS || ch in CHINESE_LARGE_UNITS) {
      hasUnit = true;
      break;
    }
    if (ch === '零' || ch === '〇') {
      hasZero = true;
    }
  }

  // Pure digit sequences without units (e.g. `二〇二六`) require a zero glyph to avoid
  // misinterpreting idiomatic pairs like `一二` or `三五` outside numeric context.
  if (!hasUnit) {
    if (!hasZero || raw.length > 9) {
      return null;
    }
    let digits = 0;
    for (const ch of raw) {
      const digit = CHINESE_DIGITS[ch];
      if (digit === undefined) {
        return null;
      }
      digits = digits * 10 + digit;
    }
    return digits;
  }

  let total = 0;
  let section = 0;
  let current = 0;
  let hasDigit = false;
  let zeroPending = false;
  let prevSmallUnit = Infinity;
  let prevLargeUnit = Infinity;

  for (const ch of raw) {
    if (ch in CHINESE_DIGITS) {
      const digit = CHINESE_DIGITS[ch]!;
      if (digit === 0) {
        // Leading zero or consecutive zeros in unit notation are invalid.
        if (zeroPending || hasDigit || (section === 0 && total === 0)) {
          return null;
        }
        zeroPending = true;
        continue;
      }
      if (hasDigit) {
        return null;
      }
      current = digit;
      hasDigit = true;
      zeroPending = false;
      continue;
    }

    if (ch in CHINESE_SMALL_UNITS) {
      const unit = CHINESE_SMALL_UNITS[ch]!;
      if (unit >= prevSmallUnit) {
        return null;
      }
      if (!hasDigit) {
        // Only `十`/`拾` may omit the leading `一` (e.g. `十二`, `一万零十`).
        if (unit !== 10) {
          return null;
        }
        current = 1;
      }
      section += current * unit;
      current = 0;
      hasDigit = false;
      zeroPending = false;
      prevSmallUnit = unit;
      continue;
    }

    if (ch in CHINESE_LARGE_UNITS) {
      const unit = CHINESE_LARGE_UNITS[ch]!;
      if (unit >= prevLargeUnit || zeroPending) {
        return null;
      }
      if (section === 0 && !hasDigit) {
        return null;
      }
      section += current;
      total += section * unit;
      section = 0;
      current = 0;
      hasDigit = false;
      prevSmallUnit = Infinity;
      prevLargeUnit = unit;
      continue;
    }

    return null;
  }

  if (zeroPending) {
    return null;
  }

  return total + section + current;
}

/**
 * Normalizes structural Chinese numerals (e.g. `第二章`, `十二、`, `（三）`, `附录十`)
 * into Arabic digits so `Intl.Collator` with `numeric: true` sorts them naturally.
 */
export function normalizeChineseNumeralsForSort(text: string): string {
  const withOrdinals = text.replace(ORDINAL_PREFIX_REGEX, (full, numeral: string) => {
    const parsed = parseChineseNumeral(numeral);
    return parsed === null ? full : `第${parsed}`;
  });

  return withOrdinals.replace(
    DELIMITED_NUMERAL_REGEX,
    (full, prefix: string, numeral: string) => {
      const parsed = parseChineseNumeral(numeral);
      return parsed === null ? full : `${prefix}${parsed}`;
    },
  );
}

/**
 * Compares two display names using natural Chinese collation: structural Chinese numerals
 * and Arabic numbers sort numerically (`第二章` < `第十章`), while text sorts by pinyin.
 */
export function compareDisplayNames(a: string, b: string): number {
  const normA = normalizeChineseNumeralsForSort(a);
  const normB = normalizeChineseNumeralsForSort(b);
  const normCmp = normA.localeCompare(normB, COLLATE_LOCALE, COLLATE_OPTIONS);
  if (normCmp !== 0) {
    return normCmp;
  }
  return a.localeCompare(b, COLLATE_LOCALE, COLLATE_OPTIONS);
}
