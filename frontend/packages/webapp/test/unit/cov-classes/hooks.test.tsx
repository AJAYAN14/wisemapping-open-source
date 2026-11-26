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
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Client, { MapMetadata } from '../../../src/classes/client';
import { ClientContext } from '../../../src/classes/provider/client-context';
import {
  useFetchAccount,
  useFetchMapById,
  useFetchMapMetadata,
} from '../../../src/classes/middleware';

const wrapperFor = (client: Partial<Client>) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }): React.ReactElement => (
    <QueryClientProvider client={queryClient}>
      <ClientContext value={client as Client}>{children}</ClientContext>
    </QueryClientProvider>
  );
  return Wrapper;
};

const account = {
  firstname: 'Ana',
  lastname: 'Li',
  email: 'ana@x.y',
  authenticationType: 'GOOGLE_OAUTH2',
  isAdmin: true,
};

// The account is only fetched on private pages; '/' itself counts as a public one.
beforeEach(() => {
  window.history.pushState({}, '', '/c/maps');
});

afterAll(() => {
  window.history.pushState({}, '', '/');
});

describe('useFetchMapById', () => {
  it('fills the MapInfo defaults for metadata without the extended fields', async () => {
    const fetchMapMetadata = jest.fn().mockResolvedValue({
      id: 3,
      title: 'Bare',
      creatorFullName: 'Ana Li',
      role: 'viewer',
    } as MapMetadata);
    const { result } = renderHook(() => useFetchMapById(3), {
      wrapper: wrapperFor({ fetchMapMetadata }),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toEqual({
      id: 3,
      title: 'Bare',
      starred: false,
      labels: [],
      createdBy: 'Ana Li',
      creationTime: '',
      lastModificationBy: '',
      lastModificationTime: '',
      description: '',
      folderId: null,
      folderPath: '',
      public: false,
      role: 'viewer',
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('copies the extended metadata fields', async () => {
    const fetchMapMetadata = jest.fn().mockResolvedValue({
      id: 3,
      title: 'Full',
      creatorFullName: 'Ana Li',
      createdBy: 'ana@x.y',
      creationTime: 'c',
      lastModificationBy: 'bo@x.y',
      lastModificationTime: 'm',
      description: 'd',
      starred: true,
      public: true,
      role: 'owner',
    });
    const { result } = renderHook(() => useFetchMapById(3), {
      wrapper: wrapperFor({ fetchMapMetadata }),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toMatchObject({
      createdBy: 'ana@x.y',
      creationTime: 'c',
      lastModificationBy: 'bo@x.y',
      lastModificationTime: 'm',
      description: 'd',
      starred: true,
      public: true,
    });
  });

  it('does not fetch an invalid id', () => {
    const fetchMapMetadata = jest.fn();
    const { result } = renderHook(() => useFetchMapById(Number.NaN), {
      wrapper: wrapperFor({ fetchMapMetadata }),
    });

    expect(fetchMapMetadata).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it('fetches map 0, a valid id', async () => {
    const fetchMapMetadata = jest.fn().mockResolvedValue({ id: 0, title: 'Zero', role: 'owner' });
    const { result } = renderHook(() => useFetchMapById(0), {
      wrapper: wrapperFor({ fetchMapMetadata }),
    });

    await waitFor(() => expect(result.current.data?.title).toBe('Zero'));
    expect(fetchMapMetadata).toHaveBeenCalledWith(0);
  });

  it('reports the client error', async () => {
    const error = { msg: 'Gone', status: 404 };
    const { result } = renderHook(() => useFetchMapById(3), {
      wrapper: wrapperFor({ fetchMapMetadata: jest.fn().mockRejectedValue(error) }),
    });

    await waitFor(() => expect(result.current.error).toEqual(error));
    expect(result.current.data).toBeUndefined();
  });
});

describe('useFetchMapMetadata', () => {
  it('returns the raw metadata', async () => {
    const metadata = { id: 9, title: 'Raw', jsonProps: '{}' };
    const fetchMapMetadata = jest.fn().mockResolvedValue(metadata);
    const { result } = renderHook(() => useFetchMapMetadata(9), {
      wrapper: wrapperFor({ fetchMapMetadata }),
    });

    await waitFor(() => expect(result.current.data).toEqual(metadata));
    expect(fetchMapMetadata).toHaveBeenCalledWith(9);
  });
});

describe('account hooks', () => {
  it('useFetchAccount returns the signed-in account', async () => {
    const fetchAccountInfo = jest.fn().mockResolvedValue(account);
    const { result } = renderHook(() => useFetchAccount(), {
      wrapper: wrapperFor({ fetchAccountInfo }),
    });

    await waitFor(() => expect(result.current).toEqual(account));
  });

  it('does not ask for the account on public pages', () => {
    window.history.pushState({}, '', '/c/login');
    const fetchAccountInfo = jest.fn();

    const { result } = renderHook(() => useFetchAccount(), {
      wrapper: wrapperFor({ fetchAccountInfo }),
    });

    expect(fetchAccountInfo).not.toHaveBeenCalled();
    expect(result.current).toBeUndefined();
  });
});
