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

import React, { use } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChangeHistory, ErrorInfo, MapInfo } from '../../../../classes/client';
import { SimpleDialogProps } from '..';
import BaseDialog from '../base-dialog';
import { useDate } from '../../../../classes/app-i18n/dates';
import { useFetchMapById } from '../../../../classes/middleware';
import { buildMapHistoryViewPath } from '../../../../utils/mapPath';

import Tooltip from '@mui/material/Tooltip';
import { ClientContext } from '../../../../classes/provider/client-context';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import RestoreRoundedIcon from '@mui/icons-material/RestoreRounded';
import UserAvatar from '../user-avatar';
import {
  HistoryActions,
  HistoryAuthor,
  HistoryEmpty,
  HistoryList,
  HistoryRow,
  HistoryText,
  HistoryTime,
} from './styled';
import { reloadPage } from '../../../../utils/redirect';

type HistoryDialogProps = SimpleDialogProps & {
  /**
   * Run before reverting, from the editor: saves its pending changes and stops it saving, or the
   * save on page unload would write the map back over the revert.
   */
  beforeRevert?: (() => Promise<void>) | undefined;
};

const normalizeError = (
  err: ErrorInfo | null | undefined,
  fallbackMessage: string,
): ErrorInfo | undefined => {
  if (!err) {
    return undefined;
  }
  if (typeof err === 'string') {
    return { msg: err };
  }
  if (err.msg) {
    return err;
  }
  if (err.fields && Object.keys(err.fields).length > 0) {
    const firstFieldMsg = Object.values(err.fields).find(
      (value) => typeof value === 'string' && value.trim().length > 0,
    );
    if (firstFieldMsg) {
      return { ...err, msg: firstFieldMsg };
    }
  }
  if (err instanceof Error && err.message) {
    return { msg: err.message };
  }
  return { msg: fallbackMessage };
};

const HistoryDialog = ({
  mapId,
  onClose,
  beforeRevert,
}: HistoryDialogProps): React.ReactElement => {
  const intl = useIntl();
  const date = useDate();
  const client = use(ClientContext);
  const queryClient = useQueryClient();
  const cachedMapFromList = queryClient
    .getQueryData<MapInfo[]>(['maps'])
    ?.find((item) => item.id === mapId);
  const { data: fetchedMap } = useFetchMapById(cachedMapFromList ? Number.NaN : mapId);
  const targetMap = cachedMapFromList ?? fetchedMap;
  const {
    data,
    isPending,
    error: fetchError,
  } = useQuery<unknown, ErrorInfo, ChangeHistory[]>({
    queryKey: [`history-${mapId}`],
    queryFn: () => client.fetchHistory(mapId),
    gcTime: 0, // Force reload...
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const changeHistory: ChangeHistory[] = data ? data : [];

  const handleOnClose = (): void => {
    onClose();
  };

  const revert = useMutation<void, ErrorInfo, number>({
    mutationFn: async (vid: number) => {
      await beforeRevert?.();
      await client.revertHistory(mapId, vid);
    },
    onSuccess: () => {
      handleOnClose();
      // The reverted map is loaded again from the server.
      reloadPage();
    },
  });

  const handleOnClick = (event: React.MouseEvent, vid: number): void => {
    event.preventDefault();
    if (!revert.isPending) {
      revert.mutate(vid);
    }
  };

  const fallbackErrorMessage = intl.formatMessage({
    id: 'login.server-error',
    defaultMessage: 'An unexpected error occurred. Please try again later.',
  });
  const dialogError =
    normalizeError(revert.error, fallbackErrorMessage) ??
    normalizeError(fetchError, fallbackErrorMessage);

  return (
    <BaseDialog
      onClose={handleOnClose}
      error={dialogError}
      title={intl.formatMessage({
        id: 'action.history-title',
        defaultMessage: 'Version history',
      })}
      description={intl.formatMessage({
        id: 'action.history-description',
        defaultMessage: 'List of saved versions.',
      })}
    >
      {isPending ? (
        <HistoryEmpty role="status" aria-busy="true">
          <CircularProgress size={28} />
          <FormattedMessage id="common.loading" defaultMessage="Loading..." />
        </HistoryEmpty>
      ) : !fetchError && changeHistory.length === 0 ? (
        <HistoryEmpty>
          <HistoryRoundedIcon />
          <FormattedMessage
            id="history.no-changes"
            defaultMessage="There is no changes available"
          />
        </HistoryEmpty>
      ) : (
        !fetchError && (
          <HistoryList>
            {changeHistory.map((row) => (
              <HistoryRow key={row.id}>
                <UserAvatar name={row.lastModificationBy} />
                <HistoryText>
                  <HistoryAuthor>{row.lastModificationBy}</HistoryAuthor>
                  <Tooltip
                    title={date(row.lastModificationTime).format('lll')}
                    placement="bottom-start"
                  >
                    <HistoryTime>{date(row.lastModificationTime).fromNow()}</HistoryTime>
                  </Tooltip>
                </HistoryText>
                <HistoryActions>
                  <Button
                    size="small"
                    {...(targetMap
                      ? {
                          href: buildMapHistoryViewPath(
                            targetMap.folderPath,
                            targetMap.title,
                            row.id,
                          ),
                          target: 'history',
                        }
                      : { disabled: true })}
                    startIcon={<OpenInNewRoundedIcon fontSize="small" />}
                  >
                    <FormattedMessage id="maps.view" defaultMessage="View" />
                  </Button>
                  <Button
                    size="small"
                    onClick={(e) => handleOnClick(e, row.id)}
                    disabled={revert.isPending}
                    startIcon={<RestoreRoundedIcon fontSize="small" />}
                  >
                    <FormattedMessage id="maps.revert" defaultMessage="Revert" />
                  </Button>
                </HistoryActions>
              </HistoryRow>
            ))}
          </HistoryList>
        )
      )}
    </BaseDialog>
  );
};

export default HistoryDialog;
