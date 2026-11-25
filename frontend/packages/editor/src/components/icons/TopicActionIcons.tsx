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

import React from 'react';
import SvgIcon from '@mui/material/SvgIcon';
import type { SvgIconProps } from '@mui/material/SvgIcon';

/**
 * Icon for "Add Sibling Topic" (•—口).
 */
export const AddSiblingTopicIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="5" cy="12" r="2.0" fill="currentColor" stroke="none" />
      <line x1="6.5" y1="12" x2="10" y2="12" />
      <rect x="10" y="8" width="11" height="8" rx="2" />
    </g>
  </SvgIcon>
);

/**
 * Icon for "Add Child Topic" (•↳口).
 */
export const AddChildTopicIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="5.5" r="2.0" fill="currentColor" stroke="none" />
      <path d="M9 5.5H6.5A2 2 0 0 0 4.5 7.5V13.5A2 2 0 0 0 6.5 15.5H10" />
      <rect x="10" y="11.5" width="11" height="8" rx="2" />
    </g>
  </SvgIcon>
);
