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
import { FormattedMessage } from 'react-intl';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Alert from '@mui/material/Alert';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import AlertTitle from '@mui/material/AlertTitle';

const VersionConflictDialog = ({ open }: { open: boolean }): React.ReactElement => {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <Dialog open={open} maxWidth="sm" fullWidth={true}>
      <DialogTitle>
        <FormattedMessage id="editor.conflict.title" defaultMessage="Mindmap updated elsewhere" />
      </DialogTitle>

      <DialogContent>
        <Alert severity="warning">
          <AlertTitle>
            <FormattedMessage
              id="editor.conflict.description"
              defaultMessage="A newer version of this mindmap was saved on another device. Refresh the page to load the latest version and avoid overwriting recent changes."
            />
          </AlertTitle>
        </Alert>
      </DialogContent>

      <DialogActions>
        <Button
          type="button"
          variant="contained"
          color="primary"
          size="medium"
          onClick={handleRefresh}
        >
          <FormattedMessage id="editor.conflict.refresh" defaultMessage="Refresh Page" />
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VersionConflictDialog;
