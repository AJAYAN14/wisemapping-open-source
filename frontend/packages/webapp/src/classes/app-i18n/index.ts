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
// Its messages are loaded on demand: see ./messages.
export class Locale {
  code: LocaleCode;
  label: string;

  constructor(code: LocaleCode, label: string) {
    this.code = code;
    this.label = label;
  }
}

export default abstract class AppI18n {
  private static readonly PUBLIC_AUTH_ROUTES = new Set<string>([
    '/',
    '/c/login',
    '/c/registration-google',
    '/c/oauth-callback',
  ]);

  public static getUserLocale(_accountLocale?: Locale): Locale {
    return Locales.ZH;
  }

  public static getBrowserLocale(): Locale {
    return Locales.ZH;
  }

  public static getDefaultLocale(): Locale {
    return Locales.ZH;
  }

  /**
   * Checks if a given path is a public page that should not require authentication.
   */
  public static isPublicPage(path?: string): boolean {
    const currentPath = path ?? window.location.pathname;
    return AppI18n.PUBLIC_AUTH_ROUTES.has(currentPath);
  }
}

export type LocaleCode = 'zh' | 'zh-CN';

export const Locales = {
  ZH: new Locale('zh', '中文 (简体)'),
  ZH_CN: new Locale('zh-CN', '中文 (普通话)'),
};

export const localeFromStr = (code: string): Locale => {
  const locales: Locale[] = Object.values(Locales);
  return locales.find((l) => l.code === code) ?? Locales.ZH;
};
