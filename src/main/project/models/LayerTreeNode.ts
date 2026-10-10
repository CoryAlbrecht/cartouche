/**
 * @file LayerTreeNode.ts
 * @module main/project/models/LayerTreeNode
 * @description Abstract base class for the ProjectStore runtime layer hierarchy.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-07
 * @updated 2026-10-09
 * @since 0.1.0-dev
 */

import { randomUUID } from 'node:crypto';
import type { LayerGroup } from './LayerGroup';

/**
 * @class LayerTreeNode
 * @description Abstract base class representing a generic node in the project layer hierarchy.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-07
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @property {string} id - Unique identifier.
 * @property {LayerGroup | null} parent - Parent group container.
 * @property {boolean} visible - Visibility rendering toggle.
 * @property {boolean} selected - Whether the node is selected in the UI.
 */
export abstract class LayerTreeNode {
  public readonly id: string;
  protected _name: string;
  public parent: LayerGroup | null = null;
  public visible: boolean = true;
  public selected: boolean = false;

  /**
   * @description Constructs a new LayerTreeNode.
   * @param {string} name - The initial name of the node.
   * @param {string} [id] - Optional ID. If not provided, a UUID is generated.
   */
  constructor(name: string, id?: string) {
    this.id = id || randomUUID();
    this._name = name;
  }

  /**
   * @description Gets the node's display name.
   * @returns {string} Node name.
   */
  get name(): string {
    return this._name;
  }

  /**
   * @description Sets the node's display name.
   * @param {string} val - New name.
   */
  set name(val: string) {
    this._name = val;
  }
}
