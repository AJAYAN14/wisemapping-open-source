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
import { ReactElement, useEffect } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { FormattedMessage } from 'react-intl';

import NodeProperty from '../../../../classes/model/node-property';
import { DesignerKeyboard, TopicImageValue } from '@wisemapping/mindplot';
import ImageUploadTab from './image-upload-tab';
import type { UploadTopicImageFn } from '../../../../hooks/useEditor';
import { PaneCard, PaneCloseButton, PaneSectionTitle } from '../shared/StyledPane';

type TopicImagePickerProp = {
  triggerClose: () => void;
  topicImageModel?: NodeProperty<TopicImageValue | undefined> | undefined;
  onUploadTopicImage?: UploadTopicImageFn | undefined;
};

const TopicImagePicker = ({
  triggerClose,
  topicImageModel,
  onUploadTopicImage,
}: TopicImagePickerProp): ReactElement => {
  useEffect(() => {
    DesignerKeyboard.pause();
    return () => {
      DesignerKeyboard.resume();
    };
  }, []);

  return (
    <PaneCard sx={{ p: 0, pt: 1.75 }}>
      <PaneCloseButton onClick={triggerClose} aria-label="Close">
        <CloseRoundedIcon />
      </PaneCloseButton>
      <PaneSectionTitle variant="subtitle2" sx={{ px: 2, mb: 0 }}>
        <FormattedMessage
          id="editor-panel.tooltip-add-topic-image"
          defaultMessage="Add Topic Image"
        />
      </PaneSectionTitle>
      <ImageUploadTab
        topicImageModel={topicImageModel}
        onUploadTopicImage={onUploadTopicImage}
        onImageApplied={triggerClose}
      />
    </PaneCard>
  );
};
export default TopicImagePicker;
