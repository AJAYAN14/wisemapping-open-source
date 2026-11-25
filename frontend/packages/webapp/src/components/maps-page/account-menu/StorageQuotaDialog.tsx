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
import React, { use, useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import CleaningServicesRoundedIcon from '@mui/icons-material/CleaningServicesRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import { AssetCleanupResult, AssetStorageStats } from '../../../classes/client';
import { ClientContext } from '../../../classes/provider/client-context';
import { appleColors, isDarkTheme } from '../appleDesign';

const FREE_DB_LIMIT_BYTES = 500 * 1024 * 1024;
const FREE_STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

type StorageQuotaDialogProps = {
  open: boolean;
  onClose: () => void;
};

const StorageQuotaDialog = ({ open, onClose }: StorageQuotaDialogProps): React.ReactElement => {
  const client = use(ClientContext);
  const [stats, setStats] = useState<AssetStorageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cleanupResult, setCleanupResult] = useState<AssetCleanupResult | null>(null);

  const loadStats = useCallback(async () => {
    if (!client.fetchAssetStorageStats) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await client.fetchAssetStorageStats();
      setStats(data);
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'msg' in err && typeof err.msg === 'string'
          ? err.msg
          : '无法获取存储空间统计信息。';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (open) {
      setCleanupResult(null);
      void loadStats();
    }
  }, [open, loadStats]);

  const handleCleanup = async () => {
    if (!client.cleanupOrphanedAssets) {
      return;
    }
    setCleaning(true);
    setError(null);
    setCleanupResult(null);
    try {
      const res = await client.cleanupOrphanedAssets();
      setCleanupResult(res);
      await loadStats();
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'msg' in err && typeof err.msg === 'string'
          ? err.msg
          : '清理未引用图片失败，请确认服务端已配置 Storage 密钥。';
      setError(msg);
    } finally {
      setCleaning(false);
    }
  };

  const dbPercent = stats
    ? Math.min(100, Math.max(0.5, (stats.db.totalXmlBytes / FREE_DB_LIMIT_BYTES) * 100))
    : 0;
  const storagePercent = stats
    ? Math.min(100, Math.max(0.5, (stats.storage.totalBytes / FREE_STORAGE_LIMIT_BYTES) * 100))
    : 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: (theme) => {
            const c = appleColors(isDarkTheme(theme));
            return {
              borderRadius: '20px',
              border: `1px solid ${c.hairline}`,
              boxShadow: c.shadowFloat,
              backgroundColor: c.headerGlass,
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            };
          },
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StorageRoundedIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            存储空间管理
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="关闭">
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {loading && !stats ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={26} />
          </Box>
        ) : stats ? (
          <>
            <Box
              sx={(theme) => ({
                p: 1.5,
                borderRadius: '14px',
                border: `1px solid ${theme.palette.divider}`,
              })}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  数据库文本 (PostgreSQL)
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatBytes(stats.db.totalXmlBytes)} / 500 MB
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={dbPercent}
                sx={{ height: 6, borderRadius: 999, mb: 0.75 }}
              />
              <Typography variant="caption" color="text.secondary">
                导图 {stats.db.mapCount} 份 · 历史快照 {stats.db.historyCount} 条
                {stats.db.mapsWithInlineImages > 0
                  ? ` · 仍有 ${stats.db.mapsWithInlineImages} 份导图含内嵌图`
                  : ' · 已全部外置轻量化'}
              </Typography>
            </Box>

            <Box
              sx={(theme) => ({
                p: 1.5,
                borderRadius: '14px',
                border: `1px solid ${theme.palette.divider}`,
              })}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  云端图床 (Storage · {stats.storage.bucket})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatBytes(stats.storage.totalBytes)} / 1 GB
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                color="success"
                value={storagePercent}
                sx={{ height: 6, borderRadius: 999, mb: 0.75 }}
              />
              <Typography variant="caption" color="text.secondary">
                {stats.storage.configured
                  ? `已存储 ${stats.storage.objectCount} 张去重图片（相同图片全库只占 1 份）`
                  : '后端未配置 SUPABASE_SERVICE_ROLE_KEY，暂无法统计图床'}
              </Typography>
            </Box>
          </>
        ) : null}

        {cleanupResult && (
          <Alert severity="success" sx={{ borderRadius: '12px' }}>
            扫描 {cleanupResult.scannedCount} 个文件：
            {cleanupResult.deletedCount > 0
              ? `已安全清理 ${cleanupResult.deletedCount} 个无人引用的废弃图片，释放 ${formatBytes(cleanupResult.freedBytes)}。`
              : '没有可清理的废弃图片，所有图片都在使用中。'}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ borderRadius: '12px' }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 0.5, justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={
            cleaning ? <CircularProgress size={14} /> : <CleaningServicesRoundedIcon fontSize="small" />
          }
          disabled={cleaning || loading || !stats?.storage.configured}
          onClick={() => void handleCleanup()}
          sx={{ borderRadius: '10px' }}
        >
          {cleaning ? '清理中...' : '清理未引用图片'}
        </Button>
        <Button variant="contained" size="small" onClick={onClose} sx={{ borderRadius: '10px' }}>
          完成
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StorageQuotaDialog;
