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

import React, { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import { appleColors, isDarkTheme, APPLE_FONT_STACK, applePressMixin } from '../appleDesign';

export type ImportStage = 'reading' | 'parsing' | 'saving' | 'success' | 'error';

export interface ImportProgressDialogProps {
  open: boolean;
  fileName: string;
  stage: ImportStage;
  error?: string | null;
  progressPercent?: number; // 0-100 or undefined for indeterminate
  detailText?: string;
  isBatch?: boolean;
  totalCount?: number;
  currentCount?: number;
  currentPath?: string;
  successCount?: number;
  skippedCount?: number;
  onClose: () => void;
  onRetry?: () => void;
}

const STAGE_TITLES: Record<ImportStage, string> = {
  reading: '正在读取文件',
  parsing: '正在解析导图',
  saving: '正在同步云端',
  success: '导入完成',
  error: '导入失败',
};

const STAGE_DESCRIPTIONS: Record<ImportStage, string> = {
  reading: '正在校验并载入本地思维导图数据',
  parsing: '正在提取主题分支、关联关系与图文素材',
  saving: '正在存入云端数据库并准备画布',
  success: '数据已安全同步，即将进入编辑界面',
  error: '导入过程中遇到问题，请检查文件格式后重试',
};

export const ImportProgressDialog: React.FC<ImportProgressDialogProps> = ({
  open,
  fileName,
  stage,
  error,
  progressPercent,
  detailText,
  isBatch,
  totalCount = 0,
  currentCount = 0,
  currentPath,
  successCount = 0,
  skippedCount = 0,
  onClose,
  onRetry,
}) => {
  const theme = useTheme();
  const isDark = isDarkTheme(theme);
  const colors = appleColors(isDark);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isError = stage === 'error';
  const isSuccess = stage === 'success';

  useEffect(() => {
    if (!open || isError || isSuccess) {
      if (!open) {
        setElapsedSeconds(0);
      }
      return undefined;
    }
    const startedAt = Date.now();
    setElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, isError, isSuccess]);

  const titleText = isBatch
    ? isSuccess
      ? '批量导入完成'
      : isError
      ? '导入遇到问题'
      : `正在导入导图 (${currentCount}/${totalCount})`
    : STAGE_TITLES[stage];

  const descText =
    isBatch && isSuccess
      ? `已成功导入 ${successCount} 个思维导图${
          skippedCount > 0 ? `，${skippedCount} 个文件跳过` : ''
        }。已按目录归类呈现在列表中。`
      : STAGE_DESCRIPTIONS[stage];

  const displayPath = currentPath || fileName;

  return (
    <Dialog
      open={open}
      onClose={(_event, reason) => {
        if (!isError && reason === 'escapeKeyDown') {
          return;
        }
        if (isError) {
          onClose();
        }
      }}
      maxWidth={false}
      slotProps={{
        paper: {
          elevation: 0,
          sx: {
            borderRadius: '22px',
            width: 'calc(100% - 32px)',
            maxWidth: 420,
            m: 2,
            background: isDark ? 'rgba(32, 32, 36, 0.88)' : 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(40px) saturate(200%)',
            WebkitBackdropFilter: 'blur(40px) saturate(200%)',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.08)'}`,
            boxShadow: isDark
              ? '0 24px 50px -10px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.28), inset 0 1px 1px 0 rgba(255, 255, 255, 0.16)'
              : '0 20px 48px -12px rgba(0, 0, 0, 0.16), 0 2px 8px rgba(0, 0, 0, 0.05), inset 0 1px 1px 0 rgba(255, 255, 255, 1)',
            overflow: 'hidden',
            fontFamily: APPLE_FONT_STACK,
            animation: 'appleCardSpring 360ms cubic-bezier(0.16, 1, 0.3, 1)',
            '@keyframes appleCardSpring': {
              '0%': { opacity: 0, transform: 'scale(0.92) translateY(8px)' },
              '100%': { opacity: 1, transform: 'scale(1) translateY(0)' },
            },
          },
        },
        backdrop: {
          sx: {
            background: isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.22)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            transition: 'all 240ms ease-out',
          },
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          px: 3.5,
          pt: 3.5,
          pb: 3,
        }}
      >
        {/* Apple-grade Squircle Emblem Badge */}
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: '15px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
            transition: 'all 280ms cubic-bezier(0.16, 1, 0.3, 1)',
            background: isError
              ? 'linear-gradient(135deg, #F87171 0%, #EF4444 100%)'
              : isSuccess
              ? 'linear-gradient(135deg, #34D399 0%, #10B981 100%)'
              : 'linear-gradient(135deg, #FFB340 0%, #F59E0B 100%)',
            boxShadow: isError
              ? '0 6px 16px -2px rgba(239, 68, 68, 0.38)'
              : isSuccess
              ? '0 6px 16px -2px rgba(16, 185, 129, 0.38)'
              : '0 6px 16px -2px rgba(245, 158, 11, 0.38)',
            color: '#FFFFFF',
          }}
        >
          {isError ? (
            <ErrorOutlineRoundedIcon sx={{ fontSize: 27 }} />
          ) : isSuccess ? (
            <CheckRoundedIcon sx={{ fontSize: 29, stroke: '#FFFFFF', strokeWidth: 0.5 }} />
          ) : (
            <SyncRoundedIcon
              sx={{
                fontSize: 27,
                animation: 'appleSpin 1.4s infinite cubic-bezier(0.4, 0, 0.2, 1)',
                '@keyframes appleSpin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' },
                },
              }}
            />
          )}
        </Box>

        {/* Title */}
        <Typography
          variant="h6"
          sx={{
            fontFamily: APPLE_FONT_STACK,
            fontWeight: 600,
            fontSize: '18px',
            color: colors.textPrimary,
            letterSpacing: '-0.022em',
            lineHeight: 1.3,
            mb: 1.2,
          }}
        >
          {titleText}
        </Typography>

        {/* Subtle File/Path Capsule */}
        {displayPath && (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.6,
              px: 1.2,
              py: 0.35,
              borderRadius: '7px',
              background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'}`,
              maxWidth: '90%',
              mb: 1.8,
            }}
          >
            {currentPath ? (
              <FolderRoundedIcon
                sx={{ fontSize: 13, color: isDark ? '#A1A1A6' : '#6E6E73', flexShrink: 0 }}
              />
            ) : (
              <InsertDriveFileRoundedIcon
                sx={{ fontSize: 13, color: isDark ? '#A1A1A6' : '#6E6E73', flexShrink: 0 }}
              />
            )}
            <Typography
              variant="caption"
              sx={{
                fontFamily: APPLE_FONT_STACK,
                fontWeight: 500,
                fontSize: '12px',
                color: isDark ? '#A1A1A6' : '#6E6E73',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.3,
              }}
            >
              {displayPath}
            </Typography>
          </Box>
        )}

        {/* Delicate Inset Progress Bar (Apple HIG §16: contained, restrained) */}
        {!isError && (
          <Box sx={{ width: '100%', px: 0.5, mb: 1.6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <LinearProgress
                variant={progressPercent !== undefined ? 'determinate' : 'indeterminate'}
                value={progressPercent}
                sx={{
                  flex: 1,
                  height: 5,
                  borderRadius: '999px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.06)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: '999px',
                    transition: 'transform 220ms ease-out',
                    background: isSuccess
                      ? 'linear-gradient(90deg, #10B981, #34D399)'
                      : 'linear-gradient(90deg, #F59E0B, #FBBF24)',
                  },
                }}
              />
              {progressPercent !== undefined && (
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: APPLE_FONT_STACK,
                    fontSize: '11.5px',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    color: colors.textSecondary,
                    minWidth: 34,
                    textAlign: 'right',
                  }}
                >
                  {Math.round(progressPercent)}%
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {/* Status Text or Inline Error Box */}
        {isError ? (
          <Box
            sx={{
              width: '100%',
              boxSizing: 'border-box',
              px: 2,
              py: 1.5,
              borderRadius: '12px',
              background: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(254, 242, 242, 0.95)',
              border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.28)' : 'rgba(239, 68, 68, 0.2)'}`,
              color: isDark ? '#FCA5A5' : '#B91C1C',
              fontSize: '13px',
              fontFamily: APPLE_FONT_STACK,
              lineHeight: 1.55,
              mt: 0.5,
              mb: 2.5,
              textAlign: 'left',
              wordBreak: 'break-word',
            }}
          >
            {error || '导入过程中发生错误，请检查文件格式是否有效。'}
          </Box>
        ) : (
          <Box sx={{ minHeight: 38, px: 0.5 }}>
            <Typography
              variant="body2"
              sx={{
                fontFamily: APPLE_FONT_STACK,
                fontSize: '13px',
                fontWeight: 500,
                color: colors.textSecondary,
                lineHeight: 1.45,
              }}
            >
              {detailText || descText}
            </Typography>
            {!isSuccess && elapsedSeconds >= 2 && (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mt: 0.6,
                  fontFamily: APPLE_FONT_STACK,
                  fontSize: '11.5px',
                  fontVariantNumeric: 'tabular-nums',
                  color: isDark ? '#787880' : '#86868B',
                }}
              >
                已用时 {elapsedSeconds} 秒 · 图片正在并发上传，请勿关闭页面
              </Typography>
            )}
          </Box>
        )}

        {/* Batch Success Action */}
        {isBatch && isSuccess && (
          <Box sx={{ display: 'flex', width: '100%', mt: 2.2 }}>
            <Button
              fullWidth
              variant="contained"
              onClick={onClose}
              sx={{
                ...applePressMixin,
                borderRadius: '11px',
                background: colors.textPrimary,
                color: colors.surface,
                fontFamily: APPLE_FONT_STACK,
                fontSize: '13.5px',
                fontWeight: 600,
                textTransform: 'none',
                py: 0.9,
                boxShadow: 'none',
                '&:hover': {
                  background: colors.textPrimary,
                  opacity: 0.92,
                },
              }}
            >
              完成
            </Button>
          </Box>
        )}

        {/* Tactile Actions (Error state only) */}
        {isError && (
          <Box sx={{ display: 'flex', gap: 1.5, width: '100%', mt: 0.5 }}>
            {onRetry && (
              <Button
                fullWidth
                variant="outlined"
                onClick={onRetry}
                sx={{
                  ...applePressMixin,
                  borderRadius: '11px',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
                  color: colors.textPrimary,
                  fontFamily: APPLE_FONT_STACK,
                  fontSize: '13.5px',
                  fontWeight: 600,
                  textTransform: 'none',
                  py: 0.9,
                  '&:hover': {
                    borderColor: colors.textSecondary,
                    background: colors.hoverFill,
                  },
                }}
              >
                重新选择
              </Button>
            )}
            <Button
              fullWidth
              variant="contained"
              onClick={onClose}
              sx={{
                ...applePressMixin,
                borderRadius: '11px',
                background: colors.textPrimary,
                color: colors.surface,
                fontFamily: APPLE_FONT_STACK,
                fontSize: '13.5px',
                fontWeight: 600,
                textTransform: 'none',
                py: 0.9,
                boxShadow: 'none',
                '&:hover': {
                  background: colors.textPrimary,
                  opacity: 0.92,
                },
              }}
            >
              关闭
            </Button>
          </Box>
        )}
      </Box>
    </Dialog>
  );
};

export default ImportProgressDialog;
