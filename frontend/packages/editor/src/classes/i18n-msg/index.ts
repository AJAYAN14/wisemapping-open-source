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
import zh from './../../compiled-lang/zh.json';
import zhCn from './../../compiled-lang/zh-CN.json';

type MessagePart = {
  type: number;
  value: string;
};

export type LocaleData = Record<string, MessagePart[]>;

const loaded = new Map<string, LocaleData>([
  ['zh', zh as LocaleData],
  ['zh-CN', zhCn as LocaleData],
]);

/** The locale whose messages are served: always Simplified Chinese. */
const supported = (locale: string): string => (loaded.has(locale) ? locale : 'zh');

class I18nMsg {
  /** The messages of a locale already loaded, or undefined. */
  static getLoaded(locale: string): LocaleData | undefined {
    return loaded.get(supported(locale));
  }

  /**
   * Returns the pre-bundled Chinese messages.
   */
  static async load(locale: string): Promise<LocaleData> {
    return loaded.get(supported(locale)) ?? (zh as LocaleData);
  }
}

/**
 * The locale and messages to give IntlProvider.
 */
export const useLocaleData = (locale: string): { locale: string; messages: LocaleData } => {
  const [shown, setShown] = useState(() => {
    const code = supported(locale);
    const messages = I18nMsg.getLoaded(code);
    return messages ? { locale: code, messages } : { locale: 'zh', messages: zh as LocaleData };
  });

  // A locale already loaded is shown in the same render.
  const ready = I18nMsg.getLoaded(locale);
  if (ready && shown.messages !== ready) {
    setShown({ locale: supported(locale), messages: ready });
  }

  useEffect(() => {
    if (I18nMsg.getLoaded(locale)) {
      return undefined;
    }
    let current = true;
    I18nMsg.load(locale)
      .then((messages) => {
        if (current) {
          setShown({ locale: supported(locale), messages });
        }
      })
      .catch((error) => console.error(`Messages for locale ${locale} could not be loaded`, error));
    return () => {
      current = false;
    };
  }, [locale]);

  return shown;
};

export default I18nMsg;
