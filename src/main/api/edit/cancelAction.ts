/**
 * @file cancelAction.ts
 * @module main/api/edit/cancelAction
 * @description Main Process API handler for cancelling active operations and clearing layer tree selections in ProjectStore.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @see {@link setNodeSelection}
 */

import { setNodeSelection } from '../project/layerTreeOperations';
import { logging } from '../../../shared/logging';

/**
 * @description Cancels active operations, clearing node selections in the authoritative ProjectStore.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @returns {void}
 */
export default function cancelAction(): void {
  setNodeSelection([]);
  logging.debug('Cancel action executed', { scope: 'cancelAction' });
}

