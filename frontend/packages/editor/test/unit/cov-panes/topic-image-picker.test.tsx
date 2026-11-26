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

/**
 * @jest-environment jsdom
 */
import { fireEvent, screen } from '@testing-library/react';
import type { TopicImageValue } from '@wisemapping/mindplot';
import TopicImagePicker from '../../../src/components/action-widget/pane/topic-image-picker';
import { property, renderPane } from './helpers';

const pause = jest.fn();
const resume = jest.fn();
jest.mock('@wisemapping/mindplot', () => ({
  DesignerKeyboard: {
    pause: () => pause(),
    resume: () => resume(),
  },
}));

beforeEach(() => {
  pause.mockClear();
  resume.mockClear();
});

describe('TopicImagePicker', () => {
  it('pauses the map keyboard while open and resumes on unmount', () => {
    const { unmount } = renderPane(
      <TopicImagePicker
        triggerClose={jest.fn()}
        topicImageModel={property<TopicImageValue | undefined>(undefined)}
      />,
    );

    expect(pause).toHaveBeenCalledTimes(1);
    unmount();
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('renders the image upload dropzone directly without icon or emoji tabs', () => {
    renderPane(
      <TopicImagePicker
        triggerClose={jest.fn()}
        topicImageModel={property<TopicImageValue | undefined>(undefined)}
      />,
    );

    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByRole('button', { name: '选择或拖拽图片上传' })).toBeTruthy();
  });

  it('closes from the close button', () => {
    const triggerClose = jest.fn();
    renderPane(
      <TopicImagePicker
        triggerClose={triggerClose}
        topicImageModel={property<TopicImageValue | undefined>(undefined)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(triggerClose).toHaveBeenCalledTimes(1);
  });
});
