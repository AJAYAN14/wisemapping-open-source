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

import cloneDeep from 'lodash/cloneDeep';
import FeatureModelFactory from '../../model/FeatureModelFactory';
import type INodeModel from '../../model/INodeModel';
import Mindmap from '../../model/Mindmap';
import type NodeModel from '../../model/NodeModel';

/**
 * Extracts a topic and all of its descendant branches into a standalone Mindmap
 * whose central topic is a detached clone of `rootTopic`.
 *
 * The source mindmap and its live UI models are never mutated. Relationships are
 * preserved only when both endpoints belong to the extracted subtree.
 */
export const extractSubtreeMindmap = (sourceMindmap: Mindmap, rootTopic: INodeModel): Mindmap => {
  const subtreeMap = new Mindmap(sourceMindmap.getId(), sourceMindmap.getVersion());
  subtreeMap.setTheme(sourceMindmap.getTheme());
  subtreeMap.setDescription(sourceMindmap.getDescription());
  const canvasStyle = sourceMindmap.getCanvasStyle();
  if (canvasStyle) {
    subtreeMap.setCanvasStyle(cloneDeep(canvasStyle));
  }

  const includedNodeIds = new Set<number>();

  const cloneBranch = (sourceNode: INodeModel, isRoot: boolean): NodeModel => {
    const nodeType = isRoot ? 'CentralTopic' : sourceNode.getType();
    const cloned = subtreeMap.createNode(nodeType, sourceNode.getId());

    sourceNode.getPropertiesKeys().forEach((key) => {
      if (key === 'id' || key === 'type') {
        return;
      }
      if (isRoot && (key === 'order' || key === 'shrunken' || key === 'position')) {
        return;
      }
      cloned.putProperty(key, cloneDeep(sourceNode.getProperty(key)));
    });

    sourceNode.getFeatures().forEach((feature) => {
      const clonedFeature = FeatureModelFactory.createModel(
        feature.getType(),
        feature.getAttributes(),
      );
      clonedFeature.setId(feature.getId());
      cloned.addFeature(clonedFeature);
    });

    const nodeId = sourceNode.getId();
    if (Number.isFinite(nodeId)) {
      includedNodeIds.add(nodeId);
    }

    sourceNode.getChildren().forEach((child) => {
      cloned.append(cloneBranch(child, false));
    });

    return cloned;
  };

  const clonedRoot = cloneBranch(rootTopic, true);
  subtreeMap.addBranch(clonedRoot);

  sourceMindmap.getRelationships().forEach((rel) => {
    const fromId = rel.getFromNode();
    const toId = rel.getToNode();
    if (!includedNodeIds.has(fromId) || !includedNodeIds.has(toId)) {
      return;
    }

    const clonedRel = subtreeMap.createRelationship(fromId, toId);
    clonedRel.setStartArrow(rel.getStartArrow());
    clonedRel.setEndArrow(rel.getEndArrow());
    clonedRel.setStrokeColor(rel.getStrokeColor());
    clonedRel.setStrokeStyle(rel.getStrokeStyle());
    const srcCtrl = rel.getSrcCtrlPoint();
    if (srcCtrl) {
      clonedRel.setSrcCtrlPoint({ ...srcCtrl });
    }
    const destCtrl = rel.getDestCtrlPoint();
    if (destCtrl) {
      clonedRel.setDestCtrlPoint({ ...destCtrl });
    }
    subtreeMap.addRelationship(clonedRel);
  });

  return subtreeMap;
};
