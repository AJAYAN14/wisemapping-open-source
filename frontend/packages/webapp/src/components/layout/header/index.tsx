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

import { StyledNav, StyledDiv, Logo } from './styled';

import React from 'react';
import { useIntl } from 'react-intl';
import { Link } from 'react-router';
import { useTheme } from '@mui/material/styles';

export const Header = (): React.ReactElement => {
  const intl = useIntl();
  const theme = useTheme();

  return (
    <StyledNav>
      <StyledDiv>
        <Logo>
          <Link to="/login" className="header-logo">
            <img
              src={theme.logo}
              alt={intl.formatMessage({ id: 'common.logo', defaultMessage: 'WiseMapping logo' })}
            />
          </Link>
        </Logo>
      </StyledDiv>
    </StyledNav>
  );
};

export default Header;
