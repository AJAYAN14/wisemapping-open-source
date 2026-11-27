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

export interface GoogleIconProps {
  /** Material Symbols Rounded ligature name from fonts.google.com/icons. */
  name: string;
  /** Whether the symbol renders with FILL=1. */
  filled?: boolean | undefined;
  /** Font size in pixels (default 18). */
  size?: number | undefined;
  /** Variable font weight (default 400). */
  weight?: number | undefined;
  /** Optional explicit color override. */
  color?: string | undefined;
  /** Optional className merged with material-symbols-rounded. */
  className?: string | undefined;
  /** Optional test ID preserved for unit/integration test selectors. */
  testId?: string | undefined;
  style?: React.CSSProperties | undefined;
}

/**
 * Renders a Google Fonts Material Symbols Rounded glyph via `data-icon` + CSS `::before`
 * so ligature names never pollute textContent, screen readers, or copy/paste selection.
 */
export const GoogleIcon = ({
  name,
  filled = false,
  size = 18,
  weight = 400,
  color,
  className,
  testId,
  style,
}: GoogleIconProps): React.ReactElement => (
  <span
    aria-hidden="true"
    data-icon={name}
    data-testid={testId}
    className={className ? `material-symbols-rounded ${className}` : 'material-symbols-rounded'}
    style={{
      fontSize: `${size}px`,
      lineHeight: 1,
      width: '1em',
      height: '1em',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      userSelect: 'none',
      flexShrink: 0,
      color,
      fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' 20`,
      transition: 'font-variation-settings 140ms cubic-bezier(0.23, 1, 0.32, 1), color 140ms ease',
      ...style,
    }}
  />
);
