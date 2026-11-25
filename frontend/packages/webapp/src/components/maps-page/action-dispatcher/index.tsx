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

import React, { Suspense, useEffect } from 'react';
import RenameDialog from './rename-dialog';
import DeleteDialog from './delete-dialog';
import { ActionType } from '../action-chooser';
import { PageModeType } from '../../editor-page/loader';
import { QueryClient } from '@tanstack/react-query';
import DuplicateDialog from './duplicate-dialog';
import CreateDialog from './create-dialog';
import HistoryDialog from './history-dialog';
import DeleteMultiselectDialog from './delete-multiselect-dialog';
import LabelDialog from './label-dialog';
import type { Designer } from '@wisemapping/editor';

// Uses the editor's exporters: loaded lazily on demand.
const ExportDialog = React.lazy(() => import('./export-dialog'));

export type BasicMapInfo = {
  name: string;
  description: string | undefined;
};

type ActionDialogProps = {
  action?: ActionType;
  mapsId: number[];
  onClose: (success?: boolean) => void;
  fromEditor?: boolean;
  pageMode?: PageModeType;
  /** The designer of the editor the action comes from, if any. */
  designer?: Designer | undefined;
  /** From the editor: saves its pending changes and stops it saving before a revert. */
  beforeRevert?: () => Promise<void>;
};

const ActionDispatcher = ({
  mapsId,
  action,
  onClose,
  fromEditor = false,
  designer,
  beforeRevert,
}: ActionDialogProps): React.ReactElement => {
  useEffect(() => {
    if (action) {
      switch (action) {
        case 'open':
          window.location.href = `/c/maps/${mapsId}/edit`;
          onClose(true);
          break;
        case 'back':
          window.location.href = '/c/maps';
          onClose(true);
          break;
      }
    }
  }, [action, mapsId, onClose]);

  const handleOnClose = (success?: boolean): void => {
    onClose(success);
  };

  // The map that the actions on a single map act on.
  const [mapId] = mapsId;
  const singleMap = mapId !== undefined;

  return (
    <Suspense fallback={null}>
      {action === 'create' && <CreateDialog onClose={handleOnClose} />}
      {action === 'delete' && mapsId.length == 1 && singleMap && (
        <DeleteDialog onClose={handleOnClose} mapId={mapId} />
      )}
      {action === 'delete' && mapsId.length > 1 && (
        <DeleteMultiselectDialog onClose={handleOnClose} mapsId={mapsId} />
      )}
      {action === 'rename' && singleMap && <RenameDialog onClose={handleOnClose} mapId={mapId} />}
      {action === 'duplicate' && singleMap && (
        <DuplicateDialog onClose={handleOnClose} mapId={mapId} />
      )}
      {action === 'history' && singleMap && (
        <HistoryDialog onClose={handleOnClose} mapId={mapId} beforeRevert={beforeRevert} />
      )}
      {action === 'export' && singleMap && (
        <ExportDialog
          onClose={handleOnClose}
          mapId={mapId}
          enableImgExport={fromEditor}
          designer={designer}
        />
      )}
      {action === 'label' && <LabelDialog onClose={handleOnClose} mapsId={mapsId} />}
    </Suspense>
  );
};

export const handleOnMutationSuccess = (onClose: () => void, queryClient: QueryClient): void => {
  queryClient.invalidateQueries({ queryKey: ['maps'] });
  onClose();
};

export type SimpleDialogProps = {
  mapId: number;
  onClose: (success?: boolean) => void;
};

export type MultiDialogProps = {
  mapsId: number[];
  onClose: (success?: boolean) => void;
};

export default ActionDispatcher;
