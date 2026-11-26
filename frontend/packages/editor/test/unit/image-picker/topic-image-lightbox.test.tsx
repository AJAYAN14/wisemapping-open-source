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
import { fireEvent, render, screen } from '@testing-library/react';
import TopicImageLightbox from '../../../src/components/topic-image-lightbox';
import {
  scaleTopicImageCardSize,
  scaleTopicImageUploadSize,
} from '../../../src/utils/imageAssetUtils';

describe('scaleTopicImageUploadSize & TopicImageLightbox', () => {
  it('keeps card thumbnails compact while preserving up to 1280px for upload preview', () => {
    expect(scaleTopicImageCardSize(2560, 1440)).toEqual({ width: 150, height: 84 });
    expect(scaleTopicImageUploadSize(2560, 1440)).toEqual({ width: 1280, height: 720 });
    expect(scaleTopicImageUploadSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('renders nothing when preview is null', () => {
    const { container } = render(<TopicImageLightbox preview={null} onClose={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders image preview with zoom controls and closes on click', () => {
    const onClose = jest.fn();
    render(
      <TopicImageLightbox
        preview={{ url: 'https://example.com/part.webp', title: '零件示意图' }}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('零件示意图')).toBeTruthy();
    const img = screen.getByAltText('零件示意图') as HTMLImageElement;
    expect(img.src).toBe('https://example.com/part.webp');
    expect(screen.getByText('100%')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '放大' }));
    expect(screen.getByText('150%')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '重置大小' }));
    expect(screen.getByText('100%')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
