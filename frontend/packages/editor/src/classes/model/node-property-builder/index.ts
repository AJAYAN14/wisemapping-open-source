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

import { Designer, Topic, Relationship, StrokeStyle, TopicImageValue } from '@wisemapping/mindplot';
import NodeProperty from '../node-property';
import { SwitchValueDirection, fontSizes, getPreviousValue, getNextValue } from '../value-stepper';

/**
 * Value reported by the font size model while nothing is selected. Toolbar
 * widgets read their models on every selection change, including the
 * deselected state, so the getters must stay total.
 */
const DEFAULT_FONT_SIZE = 10;

class NodePropertyBuilder {
  designer: Designer;

  private fontSizeModel: NodeProperty<number> | undefined;
  private fontStyleModel: NodeProperty<string> | undefined;
  private fontColorModel: NodeProperty<string | undefined> | undefined;
  private relationshipColorModel: NodeProperty<string | undefined> | undefined;
  private relationshipStrokeStyleModel: NodeProperty<StrokeStyle> | undefined;
  private relationshipEndArrowModel: NodeProperty<boolean> | undefined;
  private relationshipStartArrowModel: NodeProperty<boolean> | undefined;
  private noteModel: NodeProperty<string | undefined> | undefined;
  private linkModel: NodeProperty<string> | undefined;
  private topicImageModel: NodeProperty<TopicImageValue | undefined> | undefined;

  constructor(designer: Designer) {
    this.designer = designer;
  }

  private selectedTopic(): Topic | undefined {
    return this.designer.getModel().selectedTopic() ?? undefined;
  }

  private selectedRelationship(): Relationship | undefined {
    return this.designer.getModel().selectedRelationship() ?? undefined;
  }

  private getFontSize(): number {
    return this.selectedTopic()?.getFontSize() ?? DEFAULT_FONT_SIZE;
  }

  private uniqueOrUndefined<T>(propertyGetter: (Topic: Topic) => T | undefined): T | undefined {
    const nodes = this.designer.getModel().filterSelectedTopics();
    const [first] = nodes;
    if (first === undefined) return undefined;
    const firstValue = propertyGetter(first);
    return nodes.every((n) => propertyGetter(n) === firstValue) ? firstValue : undefined;
  }

  /**
   *
   * @returns model to and switch font weigth
   */
  fontWeigthModel(): NodeProperty<string | undefined> {
    return {
      getValue: () => String(this.designer.getModel().selectedTopic()?.getFontWeight()),
      switchValue: () => this.designer.changeFontWeight(),
    };
  }

  /**
   *
   * @returns model to and switch font size in both directions. Font sizes used to iterate: [6, 8, 10, 15]
   */
  getFontSizeModel(): NodeProperty<number> {
    if (!this.fontSizeModel)
      this.fontSizeModel = {
        getValue: () => this.getFontSize(),
        switchValue: (direction?) => {
          if (!this.selectedTopic()) {
            return;
          }
          let newValue = this.getFontSize();
          if (direction === SwitchValueDirection.down) {
            newValue = getPreviousValue(fontSizes, this.getFontSize());
          }
          if (direction === SwitchValueDirection.up) {
            newValue = getNextValue(fontSizes, this.getFontSize());
          }
          this.designer.changeFontSize(newValue);
        },
      };
    return this.fontSizeModel;
  }

  getLinkModel(): NodeProperty<string> {
    if (!this.linkModel)
      this.linkModel = {
        getValue: (): string => this.selectedTopic()?.getLinkValue() ?? '',
        setValue: (value: string) => {
          if (value && value.trim() !== '') {
            this.selectedTopic()?.setLinkValue(value);
          } else {
            this.selectedTopic()?.setLinkValue(undefined);
          }
        },
      };
    return this.linkModel;
  }

  getTopicImageModel(): NodeProperty<TopicImageValue | undefined> {
    if (!this.topicImageModel) {
      this.topicImageModel = {
        getValue: () => {
          const topic = this.selectedTopic();
          const url = topic?.getImageUrl();
          if (!url) {
            return undefined;
          }
          const size = topic?.getImageSize();
          return {
            url,
            width: size?.width ?? 130,
            height: size?.height ?? 90,
          };
        },
        setValue: (value: TopicImageValue | undefined) => this.designer.changeTopicImage(value),
      };
    }
    return this.topicImageModel;
  }

  /**
   *
   * @returns model to get and set topic font color
   */
  getFontColorModel(): NodeProperty<string | undefined> {
    if (!this.fontColorModel)
      this.fontColorModel = {
        getValue: () => {
          const variant = this.designer.getThemeVariant();
          return this.uniqueOrUndefined((node) => node.getFontColor(variant));
        },
        setValue: (hex: string | undefined) => this.designer.changeFontColor(hex),
      };
    return this.fontColorModel;
  }

  /**
   *
   * @returns model to get and set topic note
   */
  getNoteModel(): NodeProperty<string | undefined> {
    if (!this.noteModel)
      this.noteModel = {
        getValue: (): string | undefined => {
          const value = this.selectedTopic()?.getNoteValue();
          return value ? value : undefined;
        },
        setValue: (value: string | undefined) => {
          const note = value && value.trim() !== '' ? value : undefined;
          this.selectedTopic()?.setNoteValue(note);
        },
      };
    return this.noteModel;
  }

  /**
   *
   * @returns model to get and switch topic style
   */
  getFontStyleModel(): NodeProperty<string> {
    if (!this.fontStyleModel)
      this.fontStyleModel = {
        getValue: () => this.selectedTopic()?.getFontStyle() ?? 'normal',
        switchValue: () => this.designer.changeFontStyle(),
      };
    return this.fontStyleModel;
  }

  /**
   *
   * @returns model to get and set relationship color
   */
  getRelationshipColorModel(): NodeProperty<string | undefined> {
    if (!this.relationshipColorModel)
      this.relationshipColorModel = {
        getValue: () => this.selectedRelationship()?.getModel().getStrokeColor(),
        setValue: (value: string | undefined) => this.designer.changeRelationshipColor(value),
      };
    return this.relationshipColorModel;
  }

  /**
   *
   * @returns model to get and set relationship stroke style
   */
  getRelationshipStrokeStyleModel(): NodeProperty<StrokeStyle> {
    if (!this.relationshipStrokeStyleModel)
      this.relationshipStrokeStyleModel = {
        getValue: () =>
          this.selectedRelationship()?.getModel().getStrokeStyle() ?? StrokeStyle.DASHED,
        setValue: (value: StrokeStyle) => this.designer.changeRelationshipStrokeStyle(value),
      };
    return this.relationshipStrokeStyleModel;
  }

  /**
   *
   * @returns model to get and set relationship end arrow
   */
  getRelationshipEndArrowModel(): NodeProperty<boolean> {
    if (!this.relationshipEndArrowModel)
      this.relationshipEndArrowModel = {
        getValue: () => this.selectedRelationship()?.getModel().getEndArrow() || false,
        setValue: (value: boolean) => this.designer.changeRelationshipEndArrow(value),
      };
    return this.relationshipEndArrowModel;
  }

  /**
   *
   * @returns model to get and set relationship start arrow
   */
  getRelationshipStartArrowModel(): NodeProperty<boolean> {
    if (!this.relationshipStartArrowModel)
      this.relationshipStartArrowModel = {
        getValue: () => this.selectedRelationship()?.getModel().getStartArrow() || false,
        setValue: (value: boolean) => this.designer.changeRelationshipStartArrow(value),
      };
    return this.relationshipStartArrowModel;
  }
}
export default NodePropertyBuilder;
