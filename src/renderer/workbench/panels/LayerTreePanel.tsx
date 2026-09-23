import React from "react";
import type { IDockviewPanelProps } from "dockview-react";
import { LayerTreeWidget } from "../widgets/LayerTreeWidget";

export const LayerTreePanel: React.FC<Partial<IDockviewPanelProps>> = (
  props,
) => {
  const handleClose = () => {
    if (props?.api) {
      props.api.close();
    }
  };

  return <LayerTreeWidget onClose={handleClose} />;
};

LayerTreePanel.displayName = "LayerTreePanel";
