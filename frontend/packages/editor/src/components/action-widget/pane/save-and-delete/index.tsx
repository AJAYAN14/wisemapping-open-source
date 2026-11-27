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
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { ReactElement, ReactNode, useState } from 'react';
import NodeProperty from '../../../../classes/model/node-property';
import { FormattedMessage } from 'react-intl';
import ConfirmDeleteDialog from '../../../confirm-delete-dialog';

type SaveAndDeleteProps = {
  model: NodeProperty<string | undefined>;
  closeModal: () => void;
  submitHandler: () => void;
  deleteConfirmTitle?: ReactNode;
  deleteConfirmMessage?: ReactNode;
};

const SaveAndDelete = ({
  model,
  closeModal,
  submitHandler,
  deleteConfirmTitle,
  deleteConfirmMessage,
}: SaveAndDeleteProps): ReactElement => {
  const value = model.getValue();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirmDelete = () => {
    setConfirmOpen(false);
    closeModal();
    if (model.setValue) {
      model.setValue(undefined);
    }
  };

  return (
    <Box
      component="span"
      sx={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        display: 'flex',
        gap: 1,
      }}
    >
      {value && value.trim() !== '' && (
        <>
          <Button
            color="error"
            variant="text"
            onClick={() => setConfirmOpen(true)}
            size="small"
            sx={{
              borderRadius: '8px',
              fontWeight: 500,
              fontSize: '0.8rem',
              px: 1.5,
            }}
          >
            <FormattedMessage id="action.delete" defaultMessage="Delete" />
          </Button>
          <ConfirmDeleteDialog
            open={confirmOpen}
            title={
              deleteConfirmTitle ?? (
                <FormattedMessage id="confirm-delete.item-title" defaultMessage="Delete item?" />
              )
            }
            message={
              deleteConfirmMessage ?? (
                <FormattedMessage
                  id="confirm-delete.item-message"
                  defaultMessage="Are you sure you want to delete this item?"
                />
              )
            }
            onConfirm={handleConfirmDelete}
            onCancel={() => setConfirmOpen(false)}
          />
        </>
      )}
      <Button
        color="primary"
        variant="contained"
        disableElevation
        onClick={submitHandler}
        size="small"
        sx={{
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '0.8rem',
          px: 2,
          minHeight: '30px',
        }}
      >
        <FormattedMessage id="action.accept" defaultMessage="Accept" />
      </Button>
    </Box>
  );
};

export default SaveAndDelete;
