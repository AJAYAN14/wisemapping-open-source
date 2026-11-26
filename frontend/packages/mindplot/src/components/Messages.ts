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
import Bundle from './lang/Bundle';
import type { LocaleMessages, MsgKey } from './lang/zh';

class Messages {
  public static __bundle: LocaleMessages | undefined;

  static init(_locale?: string) {
    this.__bundle = Bundle.zh;
  }
}

const $msg = function $msg(key: MsgKey): string {
  const bundle = Messages.__bundle ?? Bundle.zh;
  Messages.__bundle = bundle;
  return bundle[key] || Bundle.zh[key] || key;
};

export default Messages;
export { $msg };
