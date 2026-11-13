/**
 * @file ProjectDefaultStylesTab.tsx
 * @module renderer/workbench/dialogs/ProjectDefaultStylesTab
 * @description Default Styles tab of the Project Properties dialog: Point, Line and Polygon sections, each with a "Use application default" checkbox (checked when no Project Default Style is set) and, when unchecked, the reusable StyleEditor bound to the draft for that geometry family. Unchecking seeds the editor with a generated default; checking again clears the slot on Apply. Defaults apply only to layers added afterwards.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link StyleEditor}
 * @see {@link setDraftUseApplicationDefault}
 * @see {@link resolveNewLayerStyleContent}
 */

import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { t } from "@renderer/state/i18nSignals";
import {
  projectPropertiesDraftSignal,
  setDraftUseApplicationDefault,
  updateDraftDefaultStyle,
} from "@renderer/state/projectPropertiesSignals";
import {
  DEFAULT_STYLE_SLOTS,
  DEFAULT_STYLE_SLOT_GEOMETRY,
  type DefaultStyleSlot,
} from "@shared/styles/projectDefaultStyles";
import { StyleEditor } from "./StyleEditor";

/**
 * @component ProjectDefaultStylesTab
 * @description Renders the three Project Default Style sections bound to the draft.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {Object} props - Component properties (none).
 * @returns {JSX.Element} The Default Styles tab pane.
 */
export const ProjectDefaultStylesTab: React.FC = () => {
  useSignals();
  const slots = projectPropertiesDraftSignal.value.defaultStyles ?? { point: null, line: null, polygon: null };

  return (
    <div
      className='project-properties-tab-pane default-styles'
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {DEFAULT_STYLE_SLOTS.map((slot: DefaultStyleSlot) => {
        const value = slots[slot];
        return (
          <fieldset
            key={slot}
            className={`preference-group-box project-default-style ${slot}`}
            data-slot={slot}>
            <legend className='preference-group-legend'>
              {t(`project_properties_default_style_${slot}`)}
            </legend>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
              <input
                type='checkbox'
                id={`project-prop-default-style-${slot}-app`}
                checked={!value}
                onChange={(e) => setDraftUseApplicationDefault(slot, e.target.checked)}
              />
              {t("project_properties_default_style_use_app")}
            </label>
            {value && (
              <StyleEditor
                value={value}
                geometryKind={DEFAULT_STYLE_SLOT_GEOMETRY[slot]}
                idPrefix={`project-default-${slot}`}
                exportBaseName={`project-default-${slot}`}
                historyResetKey={`project-default-${slot}`}
                onChange={(patch) => updateDraftDefaultStyle(slot, patch)}
              />
            )}
          </fieldset>
        );
      })}
    </div>
  );
};

export default ProjectDefaultStylesTab;
