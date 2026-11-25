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

import AppConfig from './classes/app-config';
import { createJsonResponse } from './utils/response';
import AppI18n from './classes/app-i18n';
import { preloadMessages } from './classes/app-i18n/messages';

export const loader = async (): Promise<Response> => {
  // Ensure configuration is loaded before continuing, and the Chinese messages.
  await Promise.all([AppConfig.initialize(), preloadMessages(AppI18n.getUserLocale().code)]);
  return createJsonResponse('Load success');
};
