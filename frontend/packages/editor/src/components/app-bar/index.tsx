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
import { formatTooltip } from '../visualization-toolbar/utils';
import {
  buildFindInMapConfig,
  buildOutlineViewConfig,
  useFindInMapShortcut,
} from '../visualization-toolbar/mapViewActions';
import React, {
  ReactElement,
  useCallback,
  useEffect,
  useState,
  useRef,
  useMemo,
  useSyncExternalStore,
} from 'react';
import MaterialToolbar from '@mui/material/Toolbar';
import MaterialAppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import useMediaQuery from '@mui/material/useMediaQuery';
import { ToolbarMenuItem } from '../toolbar';
import ActionConfig from '../../classes/action/action-config';
import Editor from '../../classes/model/editor';
import Capability from '../../classes/action/capability';
import Tooltip from '@mui/material/Tooltip';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import RedoRoundedIcon from '@mui/icons-material/RedoRounded';
import RestoreRoundedIcon from '@mui/icons-material/RestoreRounded';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import StarRateRoundedIcon from '@mui/icons-material/StarRateRounded';
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded';
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import Typography from '@mui/material/Typography';
import UndoAndRedo from '../action-widget/button/undo-and-redo';
import LogoTextBlackSvg from '../../../images/logo-text-black.svg';
import LogoTextOrangeSvg from '../../../images/logo-text-orange.svg';
import IconButton from '@mui/material/IconButton';
import { ToolbarActionType } from '../toolbar/ToolbarActionType';
import MapInfo from '../../classes/model/map-info';
import { useIntl } from 'react-intl';
import ThemeEditor from '../action-widget/pane/theme-editor';
import NodePropertyValueModelBuilder from '../../classes/model/node-property-builder';
import TextField from '@mui/material/TextField';
import { $notify } from '@wisemapping/mindplot';
import { useTheme } from '../../contexts/ThemeContext';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import { getFrostedGlassBar, appleFontStack, applePressMixin } from '../../theme/appleDesign';
import debounce from 'lodash/debounce';

interface AppBarProps {
  model: Editor | undefined;
  mapInfo: MapInfo;
  capability: Capability;
  onAction: (type: ToolbarActionType) => void;
  accountConfig?: React.ReactElement | undefined;
}

const appBarDivisor = {
  render: () => <Typography component="div" sx={{ flexGrow: 1 }} />,
};

const AppBar = ({
  model,
  mapInfo,
  capability,
  onAction,
  accountConfig,
}: AppBarProps): ReactElement => {
  const [isStarred, setIsStarred] = useState<undefined | boolean>(undefined);
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [editedTitle, setEditedTitle] = useState<string>(() => mapInfo.getTitle());
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [currentTitle, setCurrentTitle] = useState<string>(() => mapInfo.getTitle());
  const [overflowAnchor, setOverflowAnchor] = useState<HTMLElement | null>(null);
  const [themeDialogOpen, setThemeDialogOpen] = useState<boolean>(false);
  const [findInMapOpen, setFindInMapOpen] = useState<boolean>(false);
  const canRename = !capability.isHidden('rename');

  // Another map: its title replaces the previous one. Adjusted while rendering, not in an effect,
  // so the bar never shows a frame of the previous map's title.
  const [seenMapInfo, setSeenMapInfo] = useState(mapInfo);
  if (mapInfo !== seenMapInfo) {
    setSeenMapInfo(mapInfo);
    const latestTitle = mapInfo.getTitle();
    setCurrentTitle(latestTitle);
    setEditedTitle(latestTitle);
  }

  // Renaming taken away mid-edit: the edit is discarded. Adjusted while rendering, like the above.
  if (!canRename && isEditingTitle) {
    setIsEditingTitle(false);
    setEditedTitle(currentTitle);
  }

  // Whether the map has loaded is designer state: read it from the designer, and listen for the
  // load (the designer may not be built yet, which reads as "not loaded").
  const subscribeToMapLoad = useCallback(
    (onChange: () => void): (() => void) => {
      const designer = (() => {
        try {
          return model?.getDesigner();
        } catch {
          return undefined;
        }
      })();
      if (!designer) {
        return () => undefined;
      }
      designer.addEvent('loadSuccess', onChange);
      return () => {
        designer.removeEvent('loadSuccess', onChange);
      };
    },
    [model],
  );
  const isMapLoaded = useSyncExternalStore(
    subscribeToMapLoad,
    () => model?.isMapLoadded() ?? false,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const intl = useIntl();
  const { mode, toggleMode } = useTheme();
  const muiTheme = useMuiTheme();
  const isCompactBar = useMediaQuery(muiTheme.breakpoints.down('md'), { noSsr: true });

  useFindInMapShortcut(model, setFindInMapOpen, true);

  const handleStarredOnClick = () => {
    const newStatus = !isStarred;
    mapInfo.updateStarred(newStatus).then(() => setIsStarred(newStatus));
  };

  const handleTitleClick = () => {
    if (!canRename) {
      return;
    }
    setIsEditingTitle(true);
    setEditedTitle(currentTitle);
  };

  const handleTitleSave = async () => {
    if (editedTitle.trim() === '' || editedTitle === currentTitle) {
      setIsEditingTitle(false);
      return;
    }

    setIsSaving(true);
    try {
      await mapInfo.updateTitle(editedTitle.trim());
      setCurrentTitle(editedTitle.trim());
      setIsEditingTitle(false);
      // Update the document title as well
      document.title = `${editedTitle.trim()} | WiseMapping`;
      // Show success notification
      $notify(
        intl.formatMessage({
          id: 'appbar.title-renamed',
          defaultMessage: 'Mindmap renamed',
        }),
      );
    } catch (error) {
      console.error(
        intl.formatMessage({
          id: 'appbar.error-saving-title',
          defaultMessage: 'Error saving',
        }),
        error,
      );
      // Revert to original title on error
      setEditedTitle(currentTitle);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTitleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleTitleSave();
    } else if (event.key === 'Escape') {
      handleTitleCancel();
    }
  };

  const handleTitleCancel = () => {
    setIsEditingTitle(false);
    setEditedTitle(currentTitle);
  };

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      const inputElement = inputRef.current.querySelector('input');
      if (inputElement) {
        inputElement.focus();
        // Position cursor at the end of the text instead of selecting all
        const length = inputElement.value.length;
        inputElement.setSelectionRange(length, length);
      }
    }
  }, [isEditingTitle]);

  // Debounced save handler - first save is immediate, subsequent saves within 5 seconds are debounced
  // First save executes immediately, intermediate saves are discarded (only the last save within 5 seconds executes)
  const handleDebouncedSave = useMemo(
    () =>
      debounce(
        () => {
          if (!model) {
            return;
          }
          model.save(true).catch((error) => {
            console.error('Save failed from app bar:', error);
          });
        },
        5000,
        { leading: true, trailing: true },
      ),
    [model],
  );

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      handleDebouncedSave.cancel();
    };
  }, [handleDebouncedSave]);

  const readOnlyTitleField = (
    <TextField
      value={currentTitle}
      variant="outlined"
      size="small"
      onClick={canRename ? handleTitleClick : undefined}
      data-testid="app-bar-title"
      sx={{
        minWidth: 0,
        width: '100%',
        cursor: canRename ? 'pointer' : 'default',
        '& .MuiOutlinedInput-root': {
          fontSize: '0.95rem',
          fontWeight: 600,
          fontFamily: appleFontStack,
          minHeight: '2.125rem',
          borderRadius: '10px',
          backgroundColor: 'transparent',
          transition: 'background-color 150ms ease, border-color 150ms ease',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'transparent',
            transition: 'border-color 150ms ease',
          },
          '&:hover': {
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: canRename ? (theme) => theme.palette.divider : 'transparent',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'transparent',
          },
        },
        '& .MuiOutlinedInput-input': {
          padding: '6px 12px',
          cursor: canRename ? 'pointer' : 'default',
        },
      }}
      slotProps={{
        input: { readOnly: true },
      }}
    />
  );

  const readOnlyTitleDisplay = canRename ? (
    <Tooltip
      title={intl.formatMessage({
        id: 'appbar.tooltip-rename',
        defaultMessage: 'Rename',
      })}
    >
      {readOnlyTitleField}
    </Tooltip>
  ) : (
    readOnlyTitleField
  );

  useEffect(() => {
    if (capability.isHidden('starred')) {
      return undefined;
    }
    // A late answer for a previous map must not overwrite the current one ...
    let active = true;
    mapInfo
      .isStarred()
      .then((value) => {
        if (active) {
          setIsStarred(value);
        }
      })
      .catch((e) => {
        console.error(`Unexpected error loading starred status-> ${e}`);
      });
    return () => {
      active = false;
    };
  }, [capability, mapInfo]);

  const config: (ActionConfig | undefined)[] = [
    {
      icon: <ArrowBackIosNewRoundedIcon sx={{ fontSize: 18 }} />,
      tooltip: intl.formatMessage({
        id: 'appbar.back-to-map-list',
        defaultMessage: 'Back to maps list',
      }),
      'data-testid': 'app-bar-back-button',
      onClick: () => {
        onAction('back');
      },
    },
    {
      render: () => (
        <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', flexShrink: 0 }}>
          <img
            src={mode === 'light' ? LogoTextBlackSvg : LogoTextOrangeSvg}
            style={{ height: 28, width: 'auto', display: 'block' }}
            aria-label={intl.formatMessage({
              id: 'appbar.logo-aria-label',
              defaultMessage: 'WiseMapping Logo',
            })}
          />
        </Box>
      ),
      visible: !capability.isHidden('appbar-title'),
    },
    {
      render: () => (
        <Box
          sx={{
            mx: { xs: 0.25, sm: 1.5, md: 3 },
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            minWidth: { xs: '56px', sm: '100px' },
            flex: { xs: '1 1 72px', sm: '0 1 auto' },
            maxWidth: { xs: '34dvw', sm: '240px', md: '320px' },
          }}
        >
          {isEditingTitle && canRename ? (
            <TextField
              ref={inputRef}
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleTitleSave}
              variant="outlined"
              size="small"
              data-testid="app-bar-title"
              sx={{
                minWidth: 0,
                width: '100%',
                '& .MuiOutlinedInput-root': {
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  fontFamily: appleFontStack,
                  minHeight: '2.125rem',
                  borderRadius: '10px',
                  border: (theme) => `1px solid ${theme.palette.primary.main}`,
                  boxShadow: (theme) =>
                    `0 0 0 3px ${
                      theme.palette.mode === 'dark'
                        ? 'rgba(2, 132, 199, 0.35)'
                        : 'rgba(2, 132, 199, 0.18)'
                    }`,
                  '& fieldset': {
                    border: 'none',
                  },
                },
                '& .MuiOutlinedInput-input': {
                  padding: '6px 12px',
                },
              }}
              disabled={isSaving}
            />
          ) : (
            readOnlyTitleDisplay
          )}
        </Box>
      ),
      visible: !capability.isHidden('appbar-title'),
    },
    undefined,
    {
      render: () => (
        <UndoAndRedo
          configuration={{
            icon: <UndoRoundedIcon />,
            tooltip: formatTooltip(
              intl.formatMessage({ id: 'appbar.tooltip-undo', defaultMessage: 'Undo' }),
              'Z',
            ),
            onClick: () => {
              model!.getDesigner().undo();
            },
          }}
          disabledCondition={(event) => event.undoSteps > 0}
          model={model}
        />
      ),
      visible: !capability.isHidden('undo-changes'),
      disabled: () => !model?.isMapLoadded(),
    },
    {
      render: () => (
        <UndoAndRedo
          configuration={{
            icon: <RedoRoundedIcon />,
            tooltip: formatTooltip(
              intl.formatMessage({ id: 'appbar.tooltip-redo', defaultMessage: 'Redo' }),
              'Shift + Z',
            ),
            onClick: () => {
              model!.getDesigner().redo();
            },
          }}
          disabledCondition={(event) => event.redoSteps > 0}
          model={model}
        />
      ),
      visible: !capability.isHidden('redo-changes'),
      disabled: () => !model?.isMapLoadded(),
    },
    undefined,
    {
      icon: <SaveOutlinedIcon />,
      onClick: handleDebouncedSave,
      tooltip: formatTooltip(
        intl.formatMessage({ id: 'appbar.tooltip-save', defaultMessage: 'Save' }),
        'S',
      ),
      visible: !capability.isHidden('save'),
      disabled: () => !model?.isMapLoadded(),
    },
    {
      icon: <RestoreRoundedIcon />,
      onClick: () => {
        onAction('history');
      },
      tooltip: intl.formatMessage({
        id: 'appbar.tooltip-history',
        defaultMessage: 'Changes History',
      }),
      visible: !isCompactBar && !capability.isHidden('history'),
    },
    {
      icon: isStarred ? (
        <StarRateRoundedIcon sx={{ color: '#FDDA0D' }} />
      ) : (
        <StarBorderRoundedIcon />
      ),
      onClick: handleStarredOnClick,
      tooltip: intl.formatMessage({ id: 'appbar.tooltip-starred', defaultMessage: 'Starred' }),
      visible: !isCompactBar && !capability.isHidden('starred'),
      disabled: () => isStarred === undefined,
    },
    appBarDivisor,
    buildFindInMapConfig(model, intl, { open: findInMapOpen, setOpen: setFindInMapOpen }),
    buildOutlineViewConfig(model, capability, intl),
    {
      icon: <PaletteOutlinedIcon />,
      tooltip: intl.formatMessage({ id: 'appbar.tooltip-theme', defaultMessage: 'Theme' }),
      options: [
        {
          render: (closeModal) => {
            if (model) {
              const modelBuilder = new NodePropertyValueModelBuilder(model.getDesigner());
              return (
                <ThemeEditor closeModal={closeModal} themeModel={modelBuilder.getThemeModel()} />
              );
            }
            return <div>Theme Editor not available</div>;
          },
        },
      ],
      visible: !isCompactBar && !capability.isHidden('theme'),
      disabled: () => !isMapLoaded,
    },
    {
      icon: <FileDownloadRoundedIcon />,
      onClick: () => {
        onAction('export');
      },
      tooltip: intl.formatMessage({ id: 'appbar.tooltip-export', defaultMessage: 'Export' }),
      visible: !isCompactBar && !capability.isHidden('export'),
      disabled: () => !isMapLoaded,
    },
    {
      icon: mode === 'dark' ? <LightModeRoundedIcon /> : <DarkModeOutlinedIcon />,
      tooltip: intl.formatMessage({
        id: 'appbar.tooltip-theme-toggle',
        defaultMessage: 'Toggle Theme',
      }),
      visible: !isCompactBar,
      onClick: () => {
        toggleMode();
      },
    },
    {
      render: () => (
        <>
          <Tooltip
            title={intl.formatMessage({
              id: 'appbar.more-actions',
              defaultMessage: 'More actions',
            })}
          >
            <IconButton
              aria-label={intl.formatMessage({
                id: 'appbar.more-actions',
                defaultMessage: 'More actions',
              })}
              aria-haspopup="menu"
              aria-expanded={Boolean(overflowAnchor)}
              data-testid="app-bar-more-button"
              onClick={(e) => setOverflowAnchor(e.currentTarget)}
            >
              <MoreVertRoundedIcon />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={overflowAnchor}
            open={Boolean(overflowAnchor)}
            onClose={() => setOverflowAnchor(null)}
          >
            {!capability.isHidden('history') && (
              <MenuItem
                onClick={() => {
                  setOverflowAnchor(null);
                  onAction('history');
                }}
              >
                <ListItemIcon>
                  <RestoreRoundedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>
                  {intl.formatMessage({
                    id: 'appbar.tooltip-history',
                    defaultMessage: 'Changes History',
                  })}
                </ListItemText>
              </MenuItem>
            )}
            {!capability.isHidden('starred') && (
              <MenuItem
                disabled={isStarred === undefined}
                onClick={() => {
                  setOverflowAnchor(null);
                  handleStarredOnClick();
                }}
              >
                <ListItemIcon>
                  {isStarred ? (
                    <StarRateRoundedIcon fontSize="small" sx={{ color: '#FDDA0D' }} />
                  ) : (
                    <StarBorderRoundedIcon fontSize="small" />
                  )}
                </ListItemIcon>
                <ListItemText>
                  {intl.formatMessage({
                    id: 'appbar.tooltip-starred',
                    defaultMessage: 'Starred',
                  })}
                </ListItemText>
              </MenuItem>
            )}
            {!capability.isHidden('theme') && (
              <MenuItem
                disabled={!isMapLoaded}
                onClick={() => {
                  setOverflowAnchor(null);
                  setThemeDialogOpen(true);
                }}
              >
                <ListItemIcon>
                  <PaletteOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>
                  {intl.formatMessage({
                    id: 'appbar.tooltip-theme',
                    defaultMessage: 'Theme',
                  })}
                </ListItemText>
              </MenuItem>
            )}
            {!capability.isHidden('export') && (
              <MenuItem
                disabled={!isMapLoaded}
                onClick={() => {
                  setOverflowAnchor(null);
                  onAction('export');
                }}
              >
                <ListItemIcon>
                  <FileDownloadRoundedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>
                  {intl.formatMessage({
                    id: 'appbar.tooltip-export',
                    defaultMessage: 'Export',
                  })}
                </ListItemText>
              </MenuItem>
            )}
            <MenuItem
              onClick={() => {
                setOverflowAnchor(null);
                toggleMode();
              }}
            >
              <ListItemIcon>
                {mode === 'dark' ? (
                  <LightModeRoundedIcon fontSize="small" />
                ) : (
                  <DarkModeOutlinedIcon fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText>
                {intl.formatMessage({
                  id: 'appbar.tooltip-theme-toggle',
                  defaultMessage: 'Toggle Theme',
                })}
              </ListItemText>
            </MenuItem>
          </Menu>
        </>
      ),
      visible: isCompactBar,
    },
    {
      // Renders nothing when no account configuration is provided.
      render: () => accountConfig,
      visible: !capability.isHidden('account'),
    },
  ];

  return (
    <>
      <MaterialAppBar
        role="menubar"
        position="absolute"
        color="transparent"
        data-canvas-inset="top"
        elevation={0}
        className="material-menubar"
        sx={{
          '&&': {
            ...getFrostedGlassBar(muiTheme),
          },
          fontFamily: appleFontStack,
          paddingTop: 'env(safe-area-inset-top, 0px)',
          '& .MuiToolbar-root': {
            backgroundColor: 'transparent',
            minHeight: '3rem',
            paddingLeft: 'max(6px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(6px, env(safe-area-inset-right, 0px))',
            gap: '2px',
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'none',
            [muiTheme.breakpoints.up('sm')]: {
              paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
              gap: 0.5,
            },
          },
          '& .MuiButtonBase-root': {
            marginX: '1px',
            padding: '5px',
            borderRadius: '10px',
            position: 'relative',
            flexShrink: 0,
            ...applePressMixin,
            [muiTheme.breakpoints.up('sm')]: {
              marginX: '3px',
              padding: '6px',
            },
            '@media (pointer: coarse)': {
              minWidth: '36px',
              minHeight: '36px',
              '&::after': {
                content: '""',
                position: 'absolute',
                inset: '-4px',
              },
              [muiTheme.breakpoints.up('sm')]: {
                minWidth: '44px',
                minHeight: '44px',
                '&::after': {
                  content: 'none',
                },
              },
            },
          },
        }}
      >
        <MaterialToolbar>
          {config.map((c, i) => {
            // eslint-disable-next-line @eslint-react/no-array-index-key -- a toolbar built once, never reordered
            return <ToolbarMenuItem key={i} configuration={c} vertical={false} submenuVertical />;
          })}
        </MaterialToolbar>
      </MaterialAppBar>
      {themeDialogOpen && model && (
        <Dialog
          open={themeDialogOpen}
          onClose={() => setThemeDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <ThemeEditor
            closeModal={() => setThemeDialogOpen(false)}
            themeModel={new NodePropertyValueModelBuilder(model.getDesigner()).getThemeModel()}
          />
        </Dialog>
      )}
    </>
  );
};

export default AppBar;
