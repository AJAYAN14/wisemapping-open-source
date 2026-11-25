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
import { FormattedMessage, useIntl } from 'react-intl';
import { StyledFooter } from './styled';
import poweredByIcon from './pwrdby-white.svg';
import ThemeToggle from '../../common/theme-toggle';

const Footer = (): React.ReactElement => {
  const intl = useIntl();
  // Read once per mount: rendering stays pure, and the year shown does not change mid-session.
  const [year] = React.useState(() => new Date().getFullYear());
  return (
    <StyledFooter>
      <div className="footer-inner">
        <div className="footer-brand">
          <img
            src={poweredByIcon}
            alt={intl.formatMessage({
              id: 'footer.powered-by',
              defaultMessage: 'Powered by WiseMapping',
            })}
          />
          <div className="copyright">
            <FormattedMessage
              id="footer.copyright"
              defaultMessage="© {year} WiseMapping"
              values={{ year }}
            />
          </div>
        </div>

        <div className="footer-actions">
          <ThemeToggle showBackground={true} />
        </div>
      </div>
    </StyledFooter>
  );
};

export default Footer;
