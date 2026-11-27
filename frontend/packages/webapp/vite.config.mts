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
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { resolveBootstrapConfig } from './src/utils/bootstrap-config-source';
import { createRequire } from 'module';

const requireJson = createRequire(import.meta.url);

const htmlTemplatePlugin = (data: Record<string, unknown>) => ({
  name: 'html-template',
  transformIndexHtml(html: string) {
    return html.replace(/<%= (\w+) %>/g, (_, key) => String(data[key] ?? ''));
  },
});

const wxmlLoader = () => {
  return {
    name: 'wxml-loader',
    transform(code: string, id: string) {
      if (id.endsWith('.wxml')) {
        return {
          code: `export default ${JSON.stringify(code)};`,
          map: null,
        };
      }
    },
  };
};

export default defineConfig(({ mode }) => {
  // Load env files (.env, .env.local, .env.[mode])
  const loadedEnv = loadEnv(mode, process.cwd(), '');
  const env = { ...process.env, ...loadedEnv };

  const bootstrapConfig = resolveBootstrapConfig({
    env,
    production: mode === 'production',
    readJson: requireJson,
    warn: (message) => console.warn(`\n⚠ ${message}\n`),
  });
  const pkgJson = requireJson('./package.json') as { version?: string };
  const appVersion = pkgJson.version ?? '6.0.2';
  const buildTimeParts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const partMap = Object.fromEntries(buildTimeParts.map((p) => [p.type, p.value]));
  const buildTime = `${partMap.month}-${partMap.day} ${partMap.hour}:${partMap.minute}`;

  return {
    plugins: [
      react(),
      wxmlLoader(),
      htmlTemplatePlugin({}),
    ],
    resolve: {
      tsconfigPaths: true,
      dedupe: [
        'react',
        'react-dom',
        'react-intl',
        'react-router',
        '@emotion/react',
        '@emotion/styled',
        '@mui/material',
        '@mui/icons-material',
      ],
      alias: [
        {
          find: /^@wisemapping\/editor\/src\/(.*)/,
          replacement: path.resolve(import.meta.dirname, '../editor/src/$1'),
        },
        {
          // An editor module imported by path (`@wisemapping/editor/theme/dialog`), as tsconfig
          // and jest resolve it. The barrel can not be tree-shaken: importing anything from it
          // pulls in the whole editor and mindplot, so code outside the editor page imports by path.
          find: /^@wisemapping\/editor\/(.+)/,
          replacement: path.resolve(import.meta.dirname, '../editor/src/$1'),
        },
        {
          find: /^@wisemapping\/editor$/,
          replacement: path.resolve(import.meta.dirname, '../editor/src/index.ts'),
        },
        {
          find: /^@wisemapping\/mindplot\/src\/(.*)/,
          replacement: path.resolve(import.meta.dirname, '../mindplot/src/$1'),
        },
        {
          find: /^@wisemapping\/mindplot\/(.+)/,
          replacement: path.resolve(import.meta.dirname, '../mindplot/src/$1'),
        },
        {
          find: /^@wisemapping\/mindplot$/,
          replacement: path.resolve(import.meta.dirname, '../mindplot/src/index.ts'),
        },
        {
          find: /^@wisemapping\/web2d\/src\/(.*)/,
          replacement: path.resolve(import.meta.dirname, '../web2d/src/$1'),
        },
        {
          find: /^@wisemapping\/web2d$/,
          replacement: path.resolve(import.meta.dirname, '../web2d/src/index.ts'),
        },
      ],
    },
    define: {
      VITE_BOOTSTRAP_CONFIG: JSON.stringify(bootstrapConfig),
      VITE_APP_VERSION: JSON.stringify(appVersion),
      VITE_BUILD_TIME: JSON.stringify(buildTime),
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        '@emotion/react',
        '@emotion/react/jsx-dev-runtime',
        '@emotion/styled',
        '@mui/material',
        '@mui/icons-material',
        'react-router',
        'react-intl',
        '@tanstack/react-query',
        'lodash',
      ],
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
        '/oauth2': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      minify: 'esbuild', // Vite uses esbuild by default which is faster, but we can be explicit
      chunkSizeWarningLimit: 2000, // Adjust as needed based on webpack performance hints
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) {
              return undefined;
            }
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router/') ||
              id.includes('/react-intl/') ||
              id.includes('/@tanstack/react-query/')
            ) {
              return 'react-vendor';
            }
            if (id.includes('/@mui/') || id.includes('/@emotion/')) {
              return 'mui-vendor';
            }
            return undefined;
          },
        },
      },
    },
    // Mimic webpack's production mode optimization where appropriate
    // Vite handles minification and tree-shaking automatically in build mode
  };
});
