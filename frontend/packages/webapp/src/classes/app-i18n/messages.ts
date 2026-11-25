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

import { useEffect, useState } from 'react';
import type { MessageFormatElement } from 'react-intl';
import { appLogger as log } from '../../utils/logger';
import type { LocaleCode } from '.';
import zhMessages from '../../compiled-lang/zh.json';
import zhCnMessages from '../../compiled-lang/zh-CN.json';
import 'dayjs/locale/zh-cn';

export type Messages = Record<string, MessageFormatElement[]>;

const CHINESE = zhMessages as unknown as Messages;
const CHINESE_CN = zhCnMessages as unknown as Messages;
const loaded = new Map<LocaleCode, Messages>([
  ['zh', CHINESE],
  ['zh-CN', CHINESE_CN],
]);

/** The messages of a locale already loaded, or undefined. */
export const getLoadedMessages = (code: LocaleCode): Messages | undefined => loaded.get(code);

/**
 * Loads the messages of a locale.
 */
export const loadMessages = async (code: LocaleCode): Promise<Messages> =>
  loaded.get(code) ?? CHINESE;

/**
 * Loads the messages of a locale, falling back to Chinese.
 */
export const preloadMessages = (code: LocaleCode): Promise<Messages> =>
  loadMessages(code).catch((error) => {
    log.error(`Messages for locale ${code} could not be loaded`, error);
    return CHINESE;
  });

export type LocaleMessages = { locale: LocaleCode; messages: Messages };

/**
 * The locale and messages to give IntlProvider.
 */
export const useLocaleMessages = (code: LocaleCode): LocaleMessages => {
  const [shown, setShown] = useState<LocaleMessages>(() => {
    const messages = loaded.get(code);
    return messages ? { locale: code, messages } : { locale: 'zh', messages: CHINESE };
  });

  const ready = loaded.get(code);
  if (ready && shown.messages !== ready) {
    setShown({ locale: code, messages: ready });
  }

  useEffect(() => {
    if (loaded.has(code)) {
      return undefined;
    }
    let current = true;
    preloadMessages(code).then((messages) => {
      if (current && loaded.has(code)) {
        setShown({ locale: code, messages });
      }
    });
    return () => {
      current = false;
    };
  }, [code]);

  return shown;
};
