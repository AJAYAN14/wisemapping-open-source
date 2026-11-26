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
import type { Meta, StoryObj } from '@storybook/react-vite';
import TopicImagePicker from './index';
import NodeProperty from '../../../../classes/model/node-property';
import type { TopicImageValue } from '@wisemapping/mindplot';

const TopicImagePickerWithActions = (props: {
  triggerClose: () => void;
  initialImage?: TopicImageValue;
  onImageChange?: (image: TopicImageValue | undefined) => void;
}): React.ReactElement => {
  const { onImageChange } = props;
  const [image, setImage] = React.useState<TopicImageValue | undefined>(props.initialImage);

  const topicImageModel: NodeProperty<TopicImageValue | undefined> = React.useMemo(
    () => ({
      getValue: () => image,
      setValue: (v: TopicImageValue | undefined) => {
        setImage(v);
        onImageChange?.(v);
      },
    }),
    [image, onImageChange],
  );

  return <TopicImagePicker triggerClose={props.triggerClose} topicImageModel={topicImageModel} />;
};

const meta: Meta<typeof TopicImagePickerWithActions> = {
  title: 'Editor/TopicImagePicker',
  component: TopicImagePickerWithActions,
  parameters: {
    layout: 'centered',
    chromatic: { disableSnapshot: true },
  },
  argTypes: {
    triggerClose: { action: 'triggerClose' },
    onImageChange: { action: 'onImageChange' },
  },
};

export default meta;
type Story = StoryObj<typeof TopicImagePickerWithActions>;

export const Default: Story = {
  args: {},
};
