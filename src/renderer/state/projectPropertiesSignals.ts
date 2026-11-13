/**
 * @file projectPropertiesSignals.ts
 * @module renderer/state/projectPropertiesSignals
 * @description Preact reactive signals store for the Project Properties dialog: its open state, active tab, and the transactional draft (ADR 0024) that every tab edits (Project Title, Map Background Colour, Selection Colour, Project Home, Save Path Mode, measurement units and Scale Calculation, Time Filter Enabled / From / To / Step / Unit, Project CRS / No CRS and the Recently Used CRSs, Project Default Styles). Opening the dialog seeds the draft from the committed project state; Apply and OK commit the whole draft to the Project Store in one IPC round trip and set the Project Dirty State; Cancel and Close throw it away. The draft survives tab switches.
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
import type { ProjectPropertiesPatch, TimeFilterUnit, ProjectCrs } from '@shared/types';
import {
  isTimeFilterActiveSignal,
  timeFilterRangeStartSignal,
  timeFilterRangeEndSignal,
  timeFilterStepSignal,
  timeFilterUnitSignal,
  setTimeFilterActive,
  setTimeFilterRange,
  setTimeFilterStep,
} from './timeFilterSignals';
import { MIN_TIME_FILTER_STEP } from '../map/timeFilterMath';
import { logging } from '../../shared/logging';
import {
  currentProjectSignal,
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
  measurementSettingsSignal,
  setMeasurementSettings,
  projectLayersSignal,
  projectTreeSignal,
  findItemInTree,
  setProjectCrs,
  projectCrsSignal,
  projectRecentCrsSignal,
  setProjectRecentCrs,
} from './projectSignals';
import { findCrsCatalogueEntry } from './crsCatalogueSignals';
import { MAX_RECENT_CRS, addToRecentCrsIfMissing } from '../../shared/types/crs';
import {
  DEFAULT_STYLE_SLOTS,
  DEFAULT_STYLE_SLOT_GEOMETRY,
  getProjectDefaultStyles,
  setProjectDefaultStyles,
  type DefaultStyleSlot,
} from '../../shared/styles/projectDefaultStyles';
import { createDefaultCartoucheLayerStyleJson } from '../../shared/styles/defaultLayerStyles';
import { convertStyleFormat } from '../../shared/styles/flatStyleConverter';
import type { StyleEditorValue } from '../../shared/styles/styleFormatSwitch';
import {
  DEFAULT_MAP_BACKGROUND_COLOUR,
  DEFAULT_SELECTION_COLOUR,
  DEFAULT_NEW_PROJECT_PATH_MODE,
  DEFAULT_MEASUREMENT_SETTINGS,
  PROJECT_DISTANCE_UNITS,
  PROJECT_AREA_UNITS,
  SCALE_CALCULATION_METHODS,
  type ProjectPathMode,
  type ProjectDistanceUnit,
  type ProjectAreaUnit,
  type ScaleCalculationMethod,
} from '../../shared/types/project';
import {
  projectFileDirectory,
  resolveEffectiveProjectHome,
  normalizeDirectoryPath,
} from '../../shared/project/projectHome';

/**
 * @typedef {'general' | 'measurements' | 'crs' | 'default_styles' | 'time_filter'} ProjectPropertiesTabId
 * @description Identifier of a sidebar tab in the Project Properties dialog.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 */
export type ProjectPropertiesTabId = 'general' | 'measurements' | 'crs' | 'default_styles' | 'time_filter';

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
 * @property {ProjectDistanceUnit} distanceUnit - Draft Units for Distance.
 * @property {ProjectAreaUnit} areaUnit - Draft Units for Area.
 * @property {ScaleCalculationMethod} scaleMethod - Draft Scale Calculation method.
 * @property {boolean} timeFilterEnabled - Draft Time Filter Enabled flag.
 * @property {number} timeFilterFrom - Draft Time Filter range start (From) in UTC epoch ms.
 * @property {number} timeFilterTo - Draft Time Filter range end (To) in UTC epoch ms.
 * @property {number} timeFilterStep - Draft Time Filter step magnitude.
 * @property {TimeFilterUnit} timeFilterUnit - Draft Time Filter step unit.
 * @property {boolean} crsNone - Draft "No CRS" flag.
 * @property {string} crsAuthId - Draft selected Project CRS (`AUTH:code`), empty when none is chosen.
 * @property {string[]} recentCrs - Draft Recently Used CRS ids, most recent first (trimmed to 20 on Apply).
 * @property {Record<DefaultStyleSlot, StyleEditorValue | null>} defaultStyles - Draft Project Default Styles; null means "Use application default".
 */
export interface ProjectPropertiesDraft {
  title: string;
  backgroundColour: string;
  selectionColour: string;
  home: string;
  pathMode: ProjectPathMode;
  distanceUnit: ProjectDistanceUnit;
  areaUnit: ProjectAreaUnit;
  scaleMethod: ScaleCalculationMethod;
  timeFilterEnabled: boolean;
  timeFilterFrom: number;
  timeFilterTo: number;
  timeFilterStep: number;
  timeFilterUnit: TimeFilterUnit;
  crsNone: boolean;
  crsAuthId: string;
  recentCrs: string[];
  defaultStyles: Record<DefaultStyleSlot, StyleEditorValue | null>;
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
    ...DEFAULT_MEASUREMENT_SETTINGS,
    timeFilterEnabled: false,
    timeFilterFrom: 0,
    timeFilterTo: 0,
    timeFilterStep: 1,
    timeFilterUnit: 'Days',
    crsNone: false,
    crsAuthId: '',
    recentCrs: [],
    defaultStyles: { point: null, line: null, polygon: null },
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
      ...measurementSettingsSignal.value,
      timeFilterEnabled: isTimeFilterActiveSignal.value,
      timeFilterFrom: timeFilterRangeStartSignal.value,
      timeFilterTo: timeFilterRangeEndSignal.value,
      timeFilterStep: timeFilterStepSignal.value,
      timeFilterUnit: timeFilterUnitSignal.value,
      crsNone: Boolean(projectCrsSignal.value?.none),
      crsAuthId: projectCrsSignal.value?.none ? '' : projectCrsSignal.value?.authId ?? '',
      recentCrs: projectRecentCrsSignal.value.map((c) => c.authId),
      defaultStyles: seedDefaultStylesDraft(),
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
    distanceUnit: PROJECT_DISTANCE_UNITS.includes(draft.distanceUnit) ? draft.distanceUnit : DEFAULT_MEASUREMENT_SETTINGS.distanceUnit,
    areaUnit: PROJECT_AREA_UNITS.includes(draft.areaUnit) ? draft.areaUnit : DEFAULT_MEASUREMENT_SETTINGS.areaUnit,
    scaleMethod: SCALE_CALCULATION_METHODS.includes(draft.scaleMethod) ? draft.scaleMethod : DEFAULT_MEASUREMENT_SETTINGS.scaleMethod,
    ...buildCrsPatch(draft),
  };
}

/**
 * @function describeCrs
 * @description Builds a stored CRS record for an `AUTH:code`, naming it from the CRS Catalogue (or the committed Project CRS / Recently Used entry) when known.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} authId - CRS id.
 * @returns {ProjectCrs} CRS record.
 */
function describeCrs(authId: string): ProjectCrs {
  const key = authId.toUpperCase();
  const known =
    findCrsCatalogueEntry(authId)?.name
    ?? projectRecentCrsSignal.value.find((c) => c.authId.toUpperCase() === key)?.description
    ?? (projectCrsSignal.value?.authId?.toUpperCase() === key ? projectCrsSignal.value?.description : undefined);
  return { authId, ...(known ? { description: known } : {}) };
}

/**
 * @function buildCrsPatch
 * @description CRS tab part of the patch: the Project CRS only when the selection changed (so an adopted CRS keeps its proj4 definition), and the Recently Used list trimmed to 20 by dropping the oldest.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {ProjectPropertiesDraft} draft - Draft.
 * @returns {Pick<ProjectPropertiesPatch, 'crs' | 'recentCrs'>} Patch members.
 */
export function buildCrsPatch(draft: ProjectPropertiesDraft): Pick<ProjectPropertiesPatch, 'crs' | 'recentCrs'> {
  const committed = projectCrsSignal.value;
  const patch: Pick<ProjectPropertiesPatch, 'crs' | 'recentCrs'> = {
    recentCrs: (draft.recentCrs ?? []).slice(0, MAX_RECENT_CRS).map(describeCrs),
  };
  if (draft.crsNone) {
    if (!committed?.none) patch.crs = { authId: '', none: true };
  } else if (draft.crsAuthId) {
    const same = !committed?.none && committed?.authId?.toUpperCase() === draft.crsAuthId.toUpperCase();
    if (!same) patch.crs = describeCrs(draft.crsAuthId);
  }
  return patch;
}

/**
 * @function styleEditorValueFor
 * @description Wraps Cartouche Symbology JSON as a style editor value.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} content - Cartouche JSON.
 * @returns {StyleEditorValue} Editor value.
 */
export function styleEditorValueFor(content: string): StyleEditorValue {
  return {
    styleFormat: 'cartouche',
    sldVersion: '1.0.0',
    styleContent: content,
    styleValidationError: null,
    formatCache: { cartouche: content },
  };
}

/**
 * @function seedDefaultStylesDraft
 * @description Draft Project Default Styles from the committed shared styles (null for unset slots).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @returns {Record<DefaultStyleSlot, StyleEditorValue | null>} Draft slots.
 */
function seedDefaultStylesDraft(): Record<DefaultStyleSlot, StyleEditorValue | null> {
  const committed = getProjectDefaultStyles(currentProjectSignal.value?.styles);
  const result = { point: null, line: null, polygon: null } as Record<DefaultStyleSlot, StyleEditorValue | null>;
  for (const slot of DEFAULT_STYLE_SLOTS) {
    if (committed[slot]) result[slot] = styleEditorValueFor(committed[slot] as string);
  }
  return result;
}

/**
 * @function setDraftUseApplicationDefault
 * @description "Use application default" checkbox of a Default Styles section: checking clears the slot (removed on Apply); unchecking seeds the editor with a generated default for that geometry.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {DefaultStyleSlot} slot - Geometry family.
 * @param {boolean} useApplicationDefault - Checkbox state.
 * @returns {void}
 */
export function setDraftUseApplicationDefault(slot: DefaultStyleSlot, useApplicationDefault: boolean): void {
  const current = projectPropertiesDraftSignal.value.defaultStyles ?? { point: null, line: null, polygon: null };
  updateProjectPropertiesDraft({
    defaultStyles: {
      ...current,
      [slot]: useApplicationDefault ? null : styleEditorValueFor(createDefaultCartoucheLayerStyleJson(DEFAULT_STYLE_SLOT_GEOMETRY[slot])),
    },
  });
}

/**
 * @function updateDraftDefaultStyle
 * @description Merges a style editor patch into a Default Styles slot of the draft.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {DefaultStyleSlot} slot - Geometry family.
 * @param {Partial<StyleEditorValue>} patch - Editor patch.
 * @returns {void}
 */
export function updateDraftDefaultStyle(slot: DefaultStyleSlot, patch: Partial<StyleEditorValue>): void {
  const current = projectPropertiesDraftSignal.value.defaultStyles;
  const value = current?.[slot];
  if (!value) return;
  updateProjectPropertiesDraft({ defaultStyles: { ...current, [slot]: { ...value, ...patch } } });
}

/**
 * @function resolveDefaultStylesPatch
 * @description Converts the draft Default Styles into Cartouche JSON per slot (null for "Use application default"), converting OpenLayers / SLD drafts to Cartouche. Throws when a slot has a validation error.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {Record<DefaultStyleSlot, StyleEditorValue | null> | undefined} slots - Draft slots.
 * @returns {Promise<Record<DefaultStyleSlot, string | null>>} Patch slots.
 * @throws {Error} When a slot's style is invalid.
 */
export async function resolveDefaultStylesPatch(
  slots: Record<DefaultStyleSlot, StyleEditorValue | null> | undefined
): Promise<Record<DefaultStyleSlot, string | null>> {
  const result = { point: null, line: null, polygon: null } as Record<DefaultStyleSlot, string | null>;
  for (const slot of DEFAULT_STYLE_SLOTS) {
    const value = slots?.[slot];
    if (!value) continue;
    if (value.styleValidationError) {
      throw new Error(`Default ${slot} style is invalid: ${value.styleValidationError}`);
    }
    result[slot] =
      value.styleFormat === 'cartouche' ?
        value.styleContent
      : await convertStyleFormat(value.styleContent, {
          fromFormat: value.styleFormat,
          fromVersion: value.sldVersion,
          toFormat: 'cartouche',
          geometryKind: DEFAULT_STYLE_SLOT_GEOMETRY[slot],
        });
  }
  return result;
}

/**
 * @function selectDraftCrs
 * @description Selects a CRS on the CRS tab. Selecting from the Predefined list also adds it to the top of the draft Recently Used list when it is not already there; selecting from Recently Used only selects it.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} authId - Selected CRS.
 * @param {'recent' | 'predefined'} source - List the selection came from.
 * @returns {void}
 */
export function selectDraftCrs(authId: string, source: 'recent' | 'predefined'): void {
  const draft = projectPropertiesDraftSignal.value;
  updateProjectPropertiesDraft({
    crsAuthId: authId,
    ...(source === 'predefined' ? { recentCrs: addToRecentCrsIfMissing(draft.recentCrs, authId) } : {}),
  });
}

/**
 * @function applyTimeFilterDraft
 * @description Commits the draft Time Filter settings (Enabled, From, To, Step, Unit) to the time filter signals that drive the TimeFilterWidget and the map, exactly as the widget's own controls do. The playhead (`current` frame) is never written; it only moves if the range setter has to clamp it inside the new range. The committed values are mirrored into the current project model so the next save persists them.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {ProjectPropertiesDraft} draft - Draft whose time filter members are committed.
 * @returns {void}
 */
export function applyTimeFilterDraft(draft: ProjectPropertiesDraft): void {
  const step = Number.isFinite(draft.timeFilterStep) && draft.timeFilterStep >= MIN_TIME_FILTER_STEP ?
    draft.timeFilterStep
  : timeFilterStepSignal.value;
  batch(() => {
    if (isTimeFilterActiveSignal.value !== Boolean(draft.timeFilterEnabled)) {
      setTimeFilterActive(Boolean(draft.timeFilterEnabled));
    }
    if (
      timeFilterRangeStartSignal.value !== draft.timeFilterFrom
      || timeFilterRangeEndSignal.value !== draft.timeFilterTo
    ) {
      setTimeFilterRange(draft.timeFilterFrom, draft.timeFilterTo);
    }
    if (timeFilterStepSignal.value !== step || timeFilterUnitSignal.value !== draft.timeFilterUnit) {
      setTimeFilterStep(step, draft.timeFilterUnit);
    }
    const project = currentProjectSignal.value;
    if (project) {
      project.timeFilter = {
        ...(project.timeFilter || {}),
        enabled: Boolean(draft.timeFilterEnabled),
        from: draft.timeFilterFrom,
        to: draft.timeFilterTo,
        step,
        unit: draft.timeFilterUnit,
      };
    }
  });
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
  try {
    patch.defaultStyles = await resolveDefaultStylesPatch(projectPropertiesDraftSignal.value.defaultStyles);
  } catch (err) {
    logging.warn('Project Default Styles not applied', err, { scope: 'projectProperties' });
    return false;
  }

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
    setMeasurementSettings({
      distanceUnit: patch.distanceUnit,
      areaUnit: patch.areaUnit,
      scaleMethod: patch.scaleMethod,
    });
    applyTimeFilterDraft(projectPropertiesDraftSignal.value);
    if (patch.crs !== undefined) {
      setProjectCrs(patch.crs);
    }
    if (patch.recentCrs !== undefined) {
      setProjectRecentCrs(patch.recentCrs);
    }
    if (patch.defaultStyles && currentProjectSignal.value) {
      currentProjectSignal.value.styles = setProjectDefaultStyles(currentProjectSignal.value.styles, patch.defaultStyles);
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
 * @function setProjectCrsFromLayerAction
 * @description "Set Project CRS from Layer": adopts a layer's CRS as the explicit Project CRS, commits it to the Project Store, sets the Project Dirty State, and lets the map redraw in it (camera kept in place). Layers without a declared CRS are refused because the EPSG:3857 assumption is never saved.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string | null | undefined} layerId - Layer whose CRS is adopted.
 * @returns {Promise<boolean>} True when the Project CRS was set.
 */
export async function setProjectCrsFromLayerAction(layerId: string | null | undefined): Promise<boolean> {
  if (!layerId || !hasProjectSignal.value) return false;
  const layerCrs =
    projectLayersSignal.value.find((l) => l.id === layerId)?.crs
    ?? (findItemInTree(projectTreeSignal.value, layerId) as { crs?: ProjectCrs } | null)?.crs;
  if (!layerCrs?.authId) {
    logging.warn('Layer has no CRS to adopt as the Project CRS', { scope: 'projectProperties', layerId });
    return false;
  }
  const crs: ProjectCrs = {
    authId: layerCrs.authId,
    ...(layerCrs.description ? { description: layerCrs.description } : {}),
    ...(layerCrs.proj4 ? { proj4: layerCrs.proj4 } : {}),
  };
  if (window.electronAPI?.updateProjectProperties) {
    try {
      const ok = await window.electronAPI.updateProjectProperties({ crs });
      if (!ok) return false;
    } catch (err) {
      logging.error('Failed to set Project CRS from layer', err, { scope: 'projectProperties', layerId });
      return false;
    }
  }
  batch(() => {
    setProjectCrs(crs);
    isProjectDirtySignal.value = true;
  });
  return true;
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
