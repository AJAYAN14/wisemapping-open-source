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
import Radio from '@mui/material/Radio';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import { Designer, TextExporterFactory, sanitizeExportFileName } from '@wisemapping/editor';
import BaseDialog from '../base-dialog';
import {
  FormatBadge,
  FormatBody,
  FormatCard,
  FormatCardList,
  FormatDescription,
  FormatIconBox,
  FormatTitle,
} from './styled';
import { fetchMindmap } from '../../../editor-page/PersistenceManagerUtils';
import { useFetchMapMetadata } from '../../../../classes/middleware';
import type { ErrorInfo } from '../../../../classes/client';

type ExportFormat = 'xmind' | 'md';

type ExportDialogProps = {
  mapId: number;
  /** The designer of the editor the dialog was opened from; none from the map list. */
  designer?: Designer | undefined;
  onClose: (success?: boolean) => void;
};

const ExportDialog = ({ mapId, onClose, designer }: ExportDialogProps): React.ReactElement => {
  const intl = useIntl();
  const { data: mapMetadata } = useFetchMapMetadata(mapId);

  const [exportFormat, setExportFormat] = React.useState<ExportFormat>('xmind');
  const [isExporting, setIsExporting] = React.useState<boolean>(false);
  const [error, setError] = React.useState<ErrorInfo | undefined>(undefined);

  const handleFormatChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setExportFormat(event.target.value as ExportFormat);
    if (error) {
      setError(undefined);
    }
  };

  const handleOnClose = (): void => {
    if (!isExporting) {
      onClose();
    }
  };

  const handleOnSubmit = async (): Promise<void> => {
    setIsExporting(true);
    setError(undefined);

    try {
      const mindmap = designer !== undefined ? designer.getMindmap() : await fetchMindmap(mapId);
      const rawTitle = mapMetadata?.title ?? mindmap.getId() ?? 'mindmap';
      const baseFileName = sanitizeExportFileName(rawTitle, 'mindmap');
      const exporter = TextExporterFactory.create(exportFormat, mindmap, baseFileName);
      const { blob, extension } = await exporter.exportFile();

      const url = URL.createObjectURL(blob);
      const anchor: HTMLAnchorElement = document.createElement('a');
      anchor.style.display = 'none';
      anchor.download = `${baseFileName}.${extension}`;
      anchor.href = url;
      document.body.appendChild(anchor);
      try {
        anchor.click();
      } finally {
        URL.revokeObjectURL(url);
        document.body.removeChild(anchor);
      }

      onClose(true);
    } catch (fail) {
      const message =
        fail instanceof Error && fail.message
          ? fail.message
          : intl.formatMessage({
              id: 'export.error.generic',
              defaultMessage: 'Export failed. Please try again.',
            });
      console.error('Unexpected error during export:', fail);
      setError({ msg: message });
      setIsExporting(false);
    }
  };

  return (
    <div>
      <BaseDialog
        onClose={handleOnClose}
        onSubmit={() => {
          void handleOnSubmit();
        }}
        title={intl.formatMessage({ id: 'export.title', defaultMessage: 'Export' })}
        description={intl.formatMessage({
          id: 'export.desc',
          defaultMessage: 'Export your mindmap as XMind or Markdown (bundled as ZIP with images).',
        })}
        submitButton={intl.formatMessage({ id: 'export.title', defaultMessage: 'Export' })}
        isLoading={isExporting}
        error={error}
      >
        <FormatCardList
          name="export-format"
          value={exportFormat}
          onChange={handleFormatChange}
          aria-label={intl.formatMessage({ id: 'export.title', defaultMessage: 'Export' })}
        >
          <FormatCard selected={exportFormat === 'xmind'} disabled={isExporting}>
            <FormatIconBox selected={exportFormat === 'xmind'}>
              <AccountTreeRoundedIcon fontSize="small" />
            </FormatIconBox>
            <FormatBody>
              <FormatTitle>
                <FormattedMessage id="export.format.xmind.title" defaultMessage="XMind Mindmap" />
                <FormatBadge selected={exportFormat === 'xmind'}>.xmind</FormatBadge>
              </FormatTitle>
              <FormatDescription>
                <FormattedMessage
                  id="export.format.xmind.desc"
                  defaultMessage="Standard XMind workbook preserving topics, floating nodes, images, notes, links, and styles."
                />
              </FormatDescription>
            </FormatBody>
            <Radio
              value="xmind"
              checked={exportFormat === 'xmind'}
              disabled={isExporting}
              color="primary"
              slotProps={{ input: { 'aria-label': 'XMind (.xmind)' } }}
              sx={{ p: 0.5, mt: -0.25 }}
            />
          </FormatCard>

          <FormatCard selected={exportFormat === 'md'} disabled={isExporting}>
            <FormatIconBox selected={exportFormat === 'md'}>
              <DescriptionRoundedIcon fontSize="small" />
            </FormatIconBox>
            <FormatBody>
              <FormatTitle>
                <FormattedMessage id="export.format.md.title" defaultMessage="Markdown Document" />
                <FormatBadge selected={exportFormat === 'md'}>.md / .zip</FormatBadge>
              </FormatTitle>
              <FormatDescription>
                <FormattedMessage
                  id="export.format.md.desc"
                  defaultMessage="Exports as a Markdown outline; automatically bundles a ZIP with an assets folder when images exist."
                />
              </FormatDescription>
            </FormatBody>
            <Radio
              value="md"
              checked={exportFormat === 'md'}
              disabled={isExporting}
              color="primary"
              slotProps={{ input: { 'aria-label': 'Markdown (.md / .zip)' } }}
              sx={{ p: 0.5, mt: -0.25 }}
            />
          </FormatCard>
        </FormatCardList>
      </BaseDialog>
    </div>
  );
};

export default ExportDialog;
