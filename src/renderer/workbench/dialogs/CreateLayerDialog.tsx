/**
 * @file CreateLayerDialog.tsx
 * @module renderer/workbench/dialogs/CreateLayerDialog
 * @description Modeless dialog window stub configuring and creating new spatial data layers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-08
 * @since 0.1.0-dev
 * @see {@link Dialog}
 * @see {@link isCreateLayerOpenSignal}
 */

import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import {
  isCreateLayerOpenSignal,
  closeCreateLayerDialog,
} from "@renderer/state/gisSignals";
import { useTranslation } from "@renderer/hooks/useTranslation";
import { Dialog } from "./Dialog";

/**
 * @component CreateLayerDialog
 * @description Renders a modeless dialog stub for authoring and creating new spatial data layers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-08
 * @since 0.1.0-dev
 * @returns {React.ReactElement | null} Create Layer dialog window element or null if closed.
 */
export const CreateLayerDialog: React.FC = () => {
  useSignals();
  const { t } = useTranslation();
  const isOpen = isCreateLayerOpenSignal.value;

  return (
    <Dialog
      name='createLayerWindow'
      title={t("create_layer") || "Create Layer..."}
      icon='file:layers-plus-outline.svg'
      isOpen={isOpen}
      onClose={closeCreateLayerDialog}
      defaultWidth={640}
      defaultHeight={480}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", width: "100%", gap: "8px" }}>
          <button
            type='button'
            className='btn btn-secondary'
            onClick={closeCreateLayerDialog}
            style={{
              padding: "6px 16px",
              backgroundColor: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "4px",
              cursor: "pointer",
            }}>
            Close
          </button>
        </div>
      }>
      <div className='create-layer-dialog-body' style={{ padding: "16px" }}>
        <p>Create layer configuration options will appear here.</p>
      </div>
    </Dialog>
  );
};
