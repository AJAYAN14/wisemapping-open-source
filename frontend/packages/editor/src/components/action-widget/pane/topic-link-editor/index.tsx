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
import { ReactElement, useState } from 'react';
import NodeProperty from '../../../../classes/model/node-property';
import Box from '@mui/material/Box';
import React from 'react';
import Input from '../../input';
import Link from '@mui/material/Link';
import IconButton from '@mui/material/IconButton';
import SaveAndDelete from '../save-and-delete';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { FormattedMessage, useIntl } from 'react-intl';
import { PaneCard, PaneHeader, PaneHeaderCloseButton, PaneHeaderTitle } from '../shared/StyledPane';

/**
 * Url form for toolbar and node contextual editor
 */
const TopicLinkEditor = (props: {
  closeModal: () => void;
  urlModel: NodeProperty<string>;
}): ReactElement => {
  const [url, setUrl] = useState<string>(props.urlModel.getValue() || '');
  const intl = useIntl();

  const submitHandler = () => {
    if (checkURL(url)) {
      props.closeModal();
      const setValue = props.urlModel.setValue;
      if (setValue) {
        setValue(url);
      }
    }
  };

  const keyDownHandler = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitHandler();
    }
  };

  const checkURL = (url: string): boolean => {
    if (!url) return false;
    if (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://')) return true;
    const regex =
      // eslint-disable-next-line no-useless-escape
      /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
    return regex.test(url);
  };

  const isValidUrl = !url || checkURL(url);

  return (
    <PaneCard
      sx={{
        minWidth: 'min(320px, calc(100dvw - 32px))',
        maxWidth: 'min(380px, calc(100dvw - 24px))',
      }}
    >
      <PaneHeader sx={{ mb: 1.25 }}>
        <PaneHeaderTitle>
          <FormattedMessage id="editor-panel.tooltip-add-link" defaultMessage="Add Link" />
        </PaneHeaderTitle>
        <PaneHeaderCloseButton onClick={props.closeModal} aria-label="Close">
          <CloseRoundedIcon />
        </PaneHeaderCloseButton>
      </PaneHeader>
      <Input
        autoFocus
        error={!isValidUrl}
        fullWidth
        margin="dense"
        helperText={
          isValidUrl
            ? ''
            : intl.formatMessage({ id: 'link.help_text', defaultMessage: 'Address is not valid' })
        }
        placeholder={intl.formatMessage({
          id: 'link.placeholder',
          defaultMessage: 'https://www.example.com',
        })}
        label="URL"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        variant="outlined"
        size="small"
        type="url"
        onKeyDown={keyDownHandler}
        slotProps={{
          input: {
            endAdornment: (
              <Link href={isValidUrl ? url : ''} target="_blank">
                <IconButton size="small" disabled={!isValidUrl}>
                  <OpenInNewRoundedIcon fontSize="small" />
                </IconButton>
              </Link>
            ),
          },
        }}
      />
      <Box sx={{ mt: 2 }}>
        <SaveAndDelete
          model={props.urlModel as NodeProperty<string | undefined>}
          closeModal={props.closeModal}
          submitHandler={submitHandler}
          deleteConfirmTitle={
            <FormattedMessage id="confirm-delete.link-title" defaultMessage="Delete link?" />
          }
          deleteConfirmMessage={
            <FormattedMessage
              id="confirm-delete.link-message"
              defaultMessage="Are you sure you want to remove the link from this topic?"
            />
          }
        />
      </Box>
    </PaneCard>
  );
};

export default TopicLinkEditor;
