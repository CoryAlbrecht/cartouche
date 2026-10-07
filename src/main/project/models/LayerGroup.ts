/**
 * @file LayerGroup.ts
 * @module main/project/models/LayerGroup
 * @description Structural container representing a folder of layers or nested groups.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-07
 * @updated 2026-10-07
 * @since 0.1.0-dev
 */

import { LayerTreeNode } from './LayerTreeNode';

/**
 * @class LayerGroup
 * @description Manages a collection of child LayerTreeNodes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-07
 * @updated 2026-10-07
 * @since 0.1.0-dev
 * @extends LayerTreeNode
 */
export class LayerGroup extends LayerTreeNode {
  private _children: Array<LayerTreeNode> = [];
  public expanded: boolean = true;

  /**
   * @description Constructs a new LayerGroup.
   * @param {string} name - Group name.
   * @param {string} [id] - Optional ID.
   */
  constructor(name: string, id?: string) {
    super(name, id);
  }

  /**
   * @description Gets all child nodes.
   * @returns {Array<LayerTreeNode>} Array of children.
   */
  public getAllChildren(): Array<LayerTreeNode> {
    return [...this._children];
  }

  /**
   * @description Returns the number of direct children in this group.
   * @returns {number} Child count.
   */
  public getChildCount(): number {
    return this._children.length;
  }

  /**
   * @description Gets the child at the specified index, supporting negative indices.
   * @param {number} index - 0-based index or negative to count from the end.
   * @returns {LayerTreeNode | undefined} Child node or undefined if out of bounds.
   */
  public getChildAt(index: number): LayerTreeNode | undefined {
    const targetIndex = index < 0 ? this._children.length + index : index;
    if (targetIndex >= 0 && targetIndex < this._children.length) {
      return this._children[targetIndex];
    }
    return undefined;
  }

  /**
   * @description Adds a child node to the group.
   * @param {LayerTreeNode} child - Node to add.
   * @param {number} [position] - Optional 0-based insertion index. Appends if omitted or invalid.
   */
  public addChild(child: LayerTreeNode, position?: number): void {
    if (child.parent) {
      child.parent.removeChild(child);
    }
    
    child.parent = this;

    if (position !== undefined && position >= 0 && position <= this._children.length) {
      this._children.splice(position, 0, child);
    } else {
      this._children.push(child);
    }
  }

  /**
   * @description Removes a specific child node from the group.
   * @param {LayerTreeNode} child - Node to remove.
   */
  public removeChild(child: LayerTreeNode): void {
    const index = this._children.indexOf(child);
    if (index !== -1) {
      this._children.splice(index, 1);
      child.parent = null;
    }
  }

  /**
   * @description Implements explicit resource management to dispose of all children recursively.
   */
  [Symbol.dispose](): void {
    for (const child of this._children) {
      if (Symbol.dispose in child && typeof (child as any)[Symbol.dispose] === 'function') {
        (child as any)[Symbol.dispose]();
      }
    }
    this._children = [];
  }
}
