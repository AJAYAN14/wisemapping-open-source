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

import React, { Suspense, use, useEffect } from 'react';
import { ActionType } from '../action-chooser';
import { PageModeType } from '../../editor-page/loader';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import type { Designer } from '@wisemapping/editor';
import { ClientContext } from '../../../classes/provider/client-context';
import { MapInfo, MapMetadata } from '../../../classes/client';
import { mapMetadataQueryKey } from '../../../classes/middleware';
import { buildMapEditPath } from '../../../utils/mapPath';
import { navigateTo } from '../../../utils/appNavigation';

// Dialogs are loaded lazily on demand so the maps list page stays lean on first load.
const RenameDialog = React.lazy(() => import('./rename-dialog'));
const DeleteDialog = React.lazy(() => import('./delete-dialog'));
const DuplicateDialog = React.lazy(() => import('./duplicate-dialog'));
const CreateDialog = React.lazy(() => import('./create-dialog'));
const HistoryDialog = React.lazy(() => import('./history-dialog'));
const DeleteMultiselectDialog = React.lazy(() => import('./delete-multiselect-dialog'));
const LabelDialog = React.lazy(() => import('./label-dialog'));
const MoveFolderDialog = React.lazy(() => import('./move-folder-dialog'));
const ExportDialog = React.lazy(() => import('./export-dialog'));

export type BasicMapInfo = {
  name: string;
  description: string | undefined;
};

type ActionDialogProps = {
  action?: ActionType;
  mapsId: number[];
  folderId?: number | null | undefined;
  onClose: (success?: boolean) => void;
  pageMode?: PageModeType;
  /** The designer of the editor the action comes from, if any. */
  designer?: Designer | undefined;
  /** Specific topic ID to export as a standalone branch when triggered from a topic context menu. */
  exportTopicId?: number | undefined;
  /** From the editor: saves its pending changes and stops it saving before a revert. */
  beforeRevert?: () => Promise<void>;
};

const ActionDispatcher = ({
  mapsId,
  action,
  folderId,
  onClose,
  designer,
  exportTopicId,
  beforeRevert,
}: ActionDialogProps): React.ReactElement => {
  const client = use(ClientContext);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (action) {
      switch (action) {
        case 'open': {
          const targetId = mapsId[0];
          if (targetId !== undefined) {
            const cachedListMap = queryClient
              .getQueryData<MapInfo[]>(['maps'])
              ?.find((item) => item.id === targetId);
            const cachedMeta = queryClient.getQueryData<MapMetadata>(
              mapMetadataQueryKey(targetId),
            );
            const known = cachedListMap ?? cachedMeta;
            if (known) {
              navigateTo(buildMapEditPath(known.folderPath, known.title));
            } else if (client?.fetchMapMetadata) {
              void client.fetchMapMetadata(targetId).then((meta) => {
                navigateTo(buildMapEditPath(meta.folderPath, meta.title));
              });
            }
          }
          onClose(true);
          break;
        }
        case 'back':
          navigateTo('/');
          onClose(true);
          break;
      }
    }
  }, [action, client, mapsId, onClose, queryClient]);

  const handleOnClose = (success?: boolean): void => {
    onClose(success);
  };

  // The map that the actions on a single map act on.
  const [mapId] = mapsId;
  const singleMap = mapId !== undefined;

  return (
    <Suspense fallback={null}>
      {action === 'create' && <CreateDialog onClose={handleOnClose} folderId={folderId} />}
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
          designer={designer}
          exportTopicId={exportTopicId}
        />
      )}
      {action === 'label' && <LabelDialog onClose={handleOnClose} mapsId={mapsId} />}
      {action === 'move-folder' && <MoveFolderDialog onClose={handleOnClose} mapsId={mapsId} />}
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
