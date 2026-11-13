/**
 * @file projectPropertiesSignals.ts
 * @module renderer/state/projectPropertiesSignals
 * @description Preact reactive signals store for the Project Properties dialog: its open state, active tab, and the transactional draft (ADR 0024) that every tab edits (Project Title, Map Background Colour, Selection Colour, Project Home, Save Path Mode). Opening the dialog seeds the draft from the committed project state; Apply and OK commit the whole draft to the Project Store in one IPC round trip and set the Project Dirty State; Cancel and Close throw it away. The draft survives tab switches.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link ProjectPropertiesDialog}
 * @see {@link projectPropertiesDraftSignal}
 * @see {@link applyProjectPropertiesEdits}
 * @see {@link ProjectPropertiesPatch}
 */

import { signal, batch, type Signal } from '@preact/signals-react';
import type { ProjectPropertiesPatch } from '@shared/types';
import { logging } from '../../shared/logging';
import {
  hasProjectSignal,
  isProjectDirtySignal,
  projectTitleSignal,
  setProjectTitle,
  mapBackgroundColourSignal,
  setMapBackgroundColour,
  selectionColourSignal,
  setSelectionColour,
  projectFilePathSignal,
  projectHomeSignal,
  projectPathModeSignal,
  setProjectHome,
  setProjectPathMode,
} from './projectSignals';
import {
  DEFAULT_MAP_BACKGROUND_COLOUR,
  DEFAULT_SELECTION_COLOUR,
  DEFAULT_NEW_PROJECT_PATH_MODE,
  type ProjectPathMode,
} from '../../shared/types/project';
import {
  projectFileDirectory,
  resolveEffectiveProjectHome,
  normalizeDirectoryPath,
} from '../../shared/project/projectHome';

/**
 * @typedef {'general'} ProjectPropertiesTabId
 * @description Identifier of a sidebar tab in the Project Properties dialog.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 */
export type ProjectPropertiesTabId = 'general';

/**
 * @typedef {Object} ProjectPropertiesDraft
 * @description In-memory, uncommitted copy of the editable project properties.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @property {string} title - Draft Project Title (`dc:title`).
 * @property {string} backgroundColour - Draft Map Background Colour (opaque CSS colour).
 * @property {string} selectionColour - Draft Selection Colour (CSS colour, alpha allowed).
 * @property {string} home - Draft Project Home as shown in the dialog: the explicit home, or the project file's directory when none is set (empty for an unsaved project).
 * @property {ProjectPathMode} pathMode - Draft Save Path Mode.
 */
export interface ProjectPropertiesDraft {
  title: string;
  backgroundColour: string;
  selectionColour: string;
  home: string;
  pathMode: ProjectPathMode;
}

/**
 * @function createEmptyProjectPropertiesDraft
 * @description Builds a blank draft.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @returns {ProjectPropertiesDraft} Blank draft.
 */
function createEmptyProjectPropertiesDraft(): ProjectPropertiesDraft {
  return {
    title: '',
    backgroundColour: DEFAULT_MAP_BACKGROUND_COLOUR,
    selectionColour: DEFAULT_SELECTION_COLOUR,
    home: '',
    pathMode: DEFAULT_NEW_PROJECT_PATH_MODE,
  };
}

/**
 * @signal isProjectPropertiesOpenSignal
 * @description Modeless visibility toggle signal for the Project Properties dialog.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @type {Signal<boolean>}
 */
export const isProjectPropertiesOpenSignal: Signal<boolean> = signal<boolean>(false);

/**
 * @signal activeProjectPropertiesTabSignal
 * @description Active sidebar tab of the Project Properties dialog. Switching tabs never touches the draft.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @type {Signal<ProjectPropertiesTabId>}
 */
export const activeProjectPropertiesTabSignal: Signal<ProjectPropertiesTabId> =
  signal<ProjectPropertiesTabId>('general');

/**
 * @signal projectPropertiesDraftSignal
 * @description The transactional draft edited by every tab of the Project Properties dialog.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @type {Signal<ProjectPropertiesDraft>}
 */
export const projectPropertiesDraftSignal: Signal<ProjectPropertiesDraft> =
  signal<ProjectPropertiesDraft>(createEmptyProjectPropertiesDraft());

/**
 * @signal projectPropertiesBaselineKeySignal
 * @description Counter bumped every time the draft is (re)seeded from committed state. Embedded controls that hold their own internal state (such as colour pickers) key on it so they re-initialise from the new baseline.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @type {Signal<number>}
 */
export const projectPropertiesBaselineKeySignal: Signal<number> = signal<number>(0);

/**
 * @function beginProjectPropertiesDraft
 * @description Seeds (or re-seeds) the draft from the committed project state. Called when the dialog opens and after a successful Save As so the baseline matches what is on disk.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @returns {void}
 */
export function beginProjectPropertiesDraft(): void {
  batch(() => {
    projectPropertiesDraftSignal.value = {
      title: projectTitleSignal.value ?? '',
      backgroundColour: mapBackgroundColourSignal.value || DEFAULT_MAP_BACKGROUND_COLOUR,
      selectionColour: selectionColourSignal.value || DEFAULT_SELECTION_COLOUR,
      home: resolveEffectiveProjectHome(projectHomeSignal.value, projectFilePathSignal.value) ?? '',
      pathMode: projectPathModeSignal.value,
    };
    projectPropertiesBaselineKeySignal.value += 1;
  });
}

/**
 * @function updateProjectPropertiesDraft
 * @description Merges a partial update into the draft without committing anything.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @param {Partial<ProjectPropertiesDraft>} updates - Draft members to change.
 * @returns {void}
 */
export function updateProjectPropertiesDraft(updates: Partial<ProjectPropertiesDraft>): void {
  projectPropertiesDraftSignal.value = {
    ...projectPropertiesDraftSignal.value,
    ...updates,
  };
}

/**
 * @function openProjectPropertiesDialog
 * @description Opens the modeless Project Properties dialog if a project is open, starting a fresh draft from the committed state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @returns {void}
 */
export function openProjectPropertiesDialog(): void {
  if (!hasProjectSignal.value) return;
  batch(() => {
    beginProjectPropertiesDraft();
    isProjectPropertiesOpenSignal.value = true;
  });
  logging.info('Project Properties dialog opened.', { scope: 'projectProperties' });
}

/**
 * @function closeProjectPropertiesDialog
 * @description Closes the Project Properties dialog and discards the draft (total rollback, ADR 0024).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @returns {void}
 */
export function closeProjectPropertiesDialog(): void {
  batch(() => {
    isProjectPropertiesOpenSignal.value = false;
    projectPropertiesDraftSignal.value = createEmptyProjectPropertiesDraft();
  });
  logging.info('Project Properties dialog closed.', { scope: 'projectProperties' });
}

/**
 * @function cancelProjectPropertiesEdits
 * @description Cancel: throws away every draft edit on every tab and closes the dialog.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @returns {void}
 */
export function cancelProjectPropertiesEdits(): void {
  closeProjectPropertiesDialog();
}

/**
 * @function buildProjectPropertiesPatch
 * @description Converts the draft into the patch sent to the Project Store. A Project Home equal to the project file's directory is sent as empty (unset).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @param {ProjectPropertiesDraft} draft - Draft to convert.
 * @returns {ProjectPropertiesPatch} Patch with every editable property.
 */
export function buildProjectPropertiesPatch(draft: ProjectPropertiesDraft): ProjectPropertiesPatch {
  // A home equal to the project file's directory is the default and is stored as "unset".
  const defaultHome = normalizeDirectoryPath(projectFileDirectory(projectFilePathSignal.value));
  const draftHome = normalizeDirectoryPath(draft.home);
  const home = draftHome && draftHome !== defaultHome ? draftHome : '';
  return {
    title: (draft.title ?? '').trim(),
    backgroundColour: (draft.backgroundColour ?? '').trim() || DEFAULT_MAP_BACKGROUND_COLOUR,
    selectionColour: (draft.selectionColour ?? '').trim() || DEFAULT_SELECTION_COLOUR,
    home,
    pathMode: draft.pathMode === 'absolute' ? 'absolute' : 'relative',
  };
}

/**
 * @function applyProjectPropertiesEdits
 * @description Apply: commits the whole draft to the Project Store in one IPC round trip, mirrors it into the renderer signals, and sets the Project Dirty State. The dialog stays open with the committed values as its new baseline.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @returns {Promise<boolean>} True when the draft was committed.
 */
export async function applyProjectPropertiesEdits(): Promise<boolean> {
  if (!hasProjectSignal.value) return false;
  const patch = buildProjectPropertiesPatch(projectPropertiesDraftSignal.value);

  if (window.electronAPI?.updateProjectProperties) {
    try {
      const ok = await window.electronAPI.updateProjectProperties(patch);
      if (!ok) {
        logging.warn('Project Store rejected the project properties patch', { scope: 'projectProperties' });
        return false;
      }
    } catch (err) {
      logging.error('Failed to update project properties via IPC', err, { scope: 'projectProperties' });
      return false;
    }
  }

  batch(() => {
    if (patch.title !== undefined) {
      setProjectTitle(patch.title);
    }
    if (patch.backgroundColour !== undefined) {
      setMapBackgroundColour(patch.backgroundColour);
    }
    if (patch.selectionColour !== undefined) {
      setSelectionColour(patch.selectionColour);
    }
    if (patch.home !== undefined) {
      setProjectHome(patch.home);
    }
    if (patch.pathMode !== undefined) {
      setProjectPathMode(patch.pathMode);
    }
    isProjectDirtySignal.value = true;
    beginProjectPropertiesDraft();
  });
  return true;
}

/**
 * @function commitAndCloseProjectPropertiesDialog
 * @description OK: applies the draft and, on success, closes the dialog.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @returns {Promise<boolean>} True when the draft was committed and the dialog closed.
 */
export async function commitAndCloseProjectPropertiesDialog(): Promise<boolean> {
  const ok = await applyProjectPropertiesEdits();
  if (ok) {
    closeProjectPropertiesDialog();
  }
  return ok;
}

/**
 * @function projectPropertiesAction
 * @description Action handler for `project_properties`: opens the dialog.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @returns {void}
 */
export function projectPropertiesAction(): void {
  openProjectPropertiesDialog();
}
