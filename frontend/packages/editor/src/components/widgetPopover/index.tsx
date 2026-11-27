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
import Popover from '@mui/material/Popover';
import type { PopoverOrigin } from '@mui/material/Popover';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { useState, useCallback, useEffect } from 'react';
import Typography from '@mui/material/Typography';
import { FormattedMessage, defineMessage } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';
import IconButton from '@mui/material/IconButton';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { WidgetBuilder, WidgetEventType } from '@wisemapping/mindplot';
import { Topic } from '@wisemapping/mindplot';
import type { Designer } from '@wisemapping/mindplot';

type WidgetPopoverProps = {
  widgetManager: WidgetBuilder;
  /**
   * Notified when the popover closes. Previously this component read a bare
   * `designer` identifier, which resolved to the `globalThis.designer` that
   * Designer's constructor assigns -- an undeclared dependency TypeScript could
   * not see, and one rename away from a runtime ReferenceError.
   */
  designer?: Designer | undefined;
};

export const WidgetPopover = ({
  widgetManager,
  designer,
}: WidgetPopoverProps): React.ReactElement => {
  const theme = useTheme();
  const isCompactViewport = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const [event, setEvent] = useState<WidgetEventType>('none');
  const [panelTitle, setPanelTitle] = useState<MessageDescriptor | undefined>(undefined);
  const [anchorElem, setAnchorElem] = useState<Element | undefined>(undefined);
  const [editorComponent, setEditorComponent] = useState<React.ReactElement | undefined>(undefined);
  const [anchorOrigin, setAnchorOrigin] = useState<PopoverOrigin>({
    vertical: 'bottom',
    horizontal: 'left',
  });
  const [transformOrigin, setTransformOrigin] = useState<PopoverOrigin>({
    vertical: 'top',
    horizontal: 'left',
  });

  const closeEditor = () => {
    setEvent('none');
    setAnchorElem(undefined);
  };
  const handleWidgetEvent = useCallback(
    (newEvent: WidgetEventType, topic?: Topic) => {
      setEvent(newEvent);

      let title: MessageDescriptor | undefined = undefined;
      let component: React.ReactElement = <></>;

      switch (newEvent) {
        case 'note': {
          title = defineMessage({ id: 'editor-panel.note-panel-title', defaultMessage: 'Note' });
          component = widgetManager.buidEditorForNote(topic!);
          break;
        }
        case 'link':
          title = defineMessage({ id: 'editor-panel.link-panel-title', defaultMessage: 'Link' });
          component = widgetManager.buildEditorForLink(topic!);
          break;
        case 'none':
          designer?.fireEvent('featureEdit', { event: 'close' });
          break;
      }

      topic?.closeEditors();

      const anchorElement = topic?.getOuterShape().getNode();

      if (anchorElement) {
        const rect = anchorElement.getBoundingClientRect();
        const isBottomHalf = rect.top > window.innerHeight / 2;
        const isRightHalf = rect.left > window.innerWidth / 2;

        const nextAnchorOrigin: PopoverOrigin = {
          vertical: isBottomHalf ? 'top' : 'bottom',
          horizontal: isRightHalf ? 'right' : 'left',
        };

        const nextTransformOrigin: PopoverOrigin = {
          vertical: isBottomHalf ? 'bottom' : 'top',
          horizontal: isRightHalf ? 'right' : 'left',
        };

        setAnchorOrigin(nextAnchorOrigin);
        setTransformOrigin(nextTransformOrigin);
      }

      setPanelTitle(title);
      setEditorComponent(component);
      setAnchorElem(anchorElement);
    },
    [widgetManager, designer],
  );

  useEffect(() => {
    widgetManager.addHander(handleWidgetEvent);
    return () => {
      widgetManager.addHander(() => undefined);
    };
  }, [widgetManager, handleWidgetEvent]);

  const isOpen = event != 'none';
  return (
    <>
      {isOpen && (
        <Popover
          id="popover"
          open={isOpen}
          anchorEl={isCompactViewport ? undefined : anchorElem}
          anchorReference={isCompactViewport ? 'anchorPosition' : 'anchorEl'}
          anchorPosition={
            isCompactViewport && typeof window !== 'undefined'
              ? {
                  top: Math.round(window.innerHeight * 0.48),
                  left: Math.round(window.innerWidth / 2),
                }
              : undefined
          }
          onClose={closeEditor}
          anchorOrigin={anchorOrigin}
          transformOrigin={
            isCompactViewport
              ? { vertical: 'center', horizontal: 'center' }
              : transformOrigin
          }
          marginThreshold={12}
          slotProps={{
            paper: {
              sx: {
                width: isCompactViewport ? 'min(360px, calc(100dvw - 24px))' : undefined,
                maxWidth: 'calc(100dvw - 24px)',
                maxHeight: 'calc(100dvh - 32px)',
                borderRadius: '14px',
                overflowX: 'hidden',
                overflowY: 'auto',
                boxShadow: (theme) =>
                  theme.palette.mode === 'dark'
                    ? '0 16px 40px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.3)'
                    : '0 14px 34px rgba(0, 0, 0, 0.10), 0 2px 8px rgba(0, 0, 0, 0.04)',
                border: (theme) =>
                  `1px solid ${
                    theme.palette.mode === 'dark'
                      ? 'rgba(84, 84, 86, 0.45)'
                      : 'rgba(60, 60, 67, 0.12)'
                  }`,
                backgroundColor: (theme) =>
                  theme.palette.mode === 'dark' ? '#1C1C1E' : '#FFFFFF',
              },
            },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              px: 1.75,
              py: 1,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: 'text.primary',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              {panelTitle && <FormattedMessage {...panelTitle} />}
            </Typography>

            <IconButton
              onClick={closeEditor}
              aria-label={'Close'}
              size="small"
              sx={{
                width: 26,
                height: 26,
                borderRadius: '7px',
                color: 'text.secondary',
                '&:hover': {
                  backgroundColor: 'action.hover',
                  color: 'text.primary',
                },
              }}
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Box>
          {editorComponent}
        </Popover>
      )}
    </>
  );
};
