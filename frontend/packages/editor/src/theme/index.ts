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
import { createTheme, PaletteMode, Theme } from '@mui/material/styles';
import { createDialogComponents } from './dialog';

const createEditorTheme = (mode: PaletteMode): Theme => {
  const isLight = mode === 'light';

  return createTheme({
    palette: {
      mode,
      primary: {
        light: isLight ? '#5AC8F5' : '#409CFF',
        main: isLight ? '#007AFF' : '#0A84FF',
        dark: isLight ? '#0040DD' : '#007AFF',
        contrastText: '#FFFFFF',
      },
      secondary: {
        light: '#AEAEB2',
        main: '#8E8E93',
        dark: '#636366',
        contrastText: '#FFFFFF',
      },
      error: {
        main: isLight ? '#FF3B30' : '#FF453A',
      },
      background: {
        paper: isLight ? '#FFFFFF' : '#1C1C1E',
        default: isLight ? '#FFFFFF' : '#000000',
      },
      text: {
        primary: isLight ? '#000000' : '#FFFFFF',
        secondary: isLight ? 'rgba(60, 60, 67, 0.60)' : 'rgba(235, 235, 245, 0.60)',
      },
      divider: isLight ? 'rgba(84, 84, 86, 0.20)' : '#38383A',
      action: {
        hover: isLight ? 'rgba(120, 120, 128, 0.12)' : 'rgba(120, 120, 128, 0.24)',
        selected: isLight ? 'rgba(0, 122, 255, 0.12)' : 'rgba(10, 132, 255, 0.22)',
        disabled: isLight ? 'rgba(60, 60, 67, 0.30)' : 'rgba(235, 235, 245, 0.30)',
        disabledBackground: isLight ? 'rgba(120, 120, 128, 0.12)' : 'rgba(120, 120, 128, 0.20)',
      },
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            boxShadow: `0 1px 3px ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.4)'}`,
          }),
        },
      },
      MuiToolbar: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
          }),
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: '8px',
          },
        },
        variants: [
          {
            props: { variant: 'contained', color: 'primary' },
            style: ({ theme }) => ({
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              boxShadow: 'none',
              '&:hover': {
                backgroundColor: theme.palette.primary.dark,
                boxShadow: 'none',
              },
            }),
          },
        ],
      },
      MuiIconButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            color: theme.palette.text.primary,
            '&:hover': {
              backgroundColor: isLight ? 'rgba(120, 120, 128, 0.12)' : 'rgba(120, 120, 128, 0.24)',
            },
            '&.Mui-disabled': {
              color: theme.palette.text.disabled,
            },
            '&[aria-pressed="true"]': {
              backgroundColor: isLight ? 'rgba(0, 122, 255, 0.12)' : 'rgba(10, 132, 255, 0.22)',
            },
            '& svg': {
              color: 'inherit',
            },
          }),
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: () => ({
            backgroundColor: isLight ? '#1C1C1E' : '#2C2C2E',
            color: '#FFFFFF',
          }),
        },
      },
      ...createDialogComponents(isLight),
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            transition: 'background-color 0.25s ease-in-out, color 0.25s ease-in-out',
          },
        },
      },
    },
  });
};

export { createEditorTheme };
