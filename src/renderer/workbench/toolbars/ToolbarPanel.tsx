import React, { useState, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import Icon from '@renderer/components/common/MdiIcon';
import {
  mdiFileOutline,
  mdiFolderOpenOutline,
  mdiContentSaveOutline,
  mdiHandBackRightOutline,
  mdiPencilOutline,
  mdiMapMarkerPlusOutline,
  mdiVectorPolyline,
  mdiVectorPolygon,
  mdiMagnet,
  mdiVectorPoint,
  mdiVectorLine,
  mdiDragVertical,
  mdiDragHorizontal,
  mdiCheck
} from '@mdi/js';
import {
  type ToolbarZone,
  type ToolbarId,
  visibleToolbarsSignal,
  toolbarOrderSignal,
  hasProjectSignal,
  activeToolSignal,
  snappingEnabledSignal,
  createNewProject,
  openProjectAction,
  saveProjectAction,
  moveToolbar,
  toggleToolbar
} from '@renderer/state/gisSignals';

interface ToolbarPanelProps {
  zone: ToolbarZone;
}

export const ToolbarPanel: React.FC<ToolbarPanelProps> = ({ zone }) => {
  useSignals();

  const isVertical = zone === 'left' || zone === 'right';
  const toolbarOrder = toolbarOrderSignal.value[zone] || [];
  const visibleMap = visibleToolbarsSignal.value;
  const activeToolbars = toolbarOrder.filter((id) => visibleMap[id]);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Close context menu on window click or blur
  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = () => setContextMenu(null);
    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
    };
  }, [contextMenu]);

  // Context menu trigger when right-clicking the toolbar panel
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleDragStart = (e: React.DragEvent, id: ToolbarId) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnPanel = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') as ToolbarId;
    if (id && visibleMap[id] !== undefined) {
      moveToolbar(id, zone);
    }
  };

  const handleDropOnItem = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData('text/plain') as ToolbarId;
    if (id && visibleMap[id] !== undefined) {
      moveToolbar(id, zone, targetIndex);
    }
  };

  // If this toolbar panel has no visible toolbars, collapse / hide completely
  if (activeToolbars.length === 0) {
    return null;
  }

  return (
    <>
      <div
        className={`toolbar-panel toolbar-panel-${zone}`}
        onContextMenu={handleContextMenu}
        onDragOver={handleDragOver}
        onDrop={handleDropOnPanel}
      >
        {activeToolbars.map((toolbarId, index) => {
          return (
            <div
              key={toolbarId}
              className={`toolbar-item toolbar-item-${isVertical ? 'vertical' : 'horizontal'}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropOnItem(e, index)}
            >
              {/* Toolbar Drag Handle */}
              <div
                className="toolbar-drag-handle"
                draggable
                onDragStart={(e) => handleDragStart(e, toolbarId)}
                title="Drag to rearrange toolbar"
              >
                <Icon
                  path={isVertical ? mdiDragHorizontal : mdiDragVertical}
                  size="14px"
                />
              </div>

              {/* Toolbar Buttons */}
              <div className="toolbar-buttons-group">
                {toolbarId === 'basic' && (
                  <>
                    <button
                      className="toolbar-btn"
                      title="New Project (Blank)"
                      onClick={createNewProject}
                      aria-label="New Project"
                    >
                      <Icon path={mdiFileOutline} size="16px" />
                    </button>
                    <button
                      className="toolbar-btn"
                      title="Open Project..."
                      onClick={openProjectAction}
                      aria-label="Open Project"
                    >
                      <Icon path={mdiFolderOpenOutline} size="16px" />
                    </button>
                    <button
                      className="toolbar-btn"
                      title="Save Project"
                      disabled={!hasProjectSignal.value}
                      onClick={saveProjectAction}
                      aria-label="Save Project"
                    >
                      <Icon path={mdiContentSaveOutline} size="16px" />
                    </button>
                    <button
                      className={`toolbar-btn ${activeToolSignal.value === 'pan' ? 'active' : ''}`}
                      title="Drag Map Canvas (Pan)"
                      onClick={() => {
                        activeToolSignal.value = 'pan';
                      }}
                      aria-label="Drag Map Canvas"
                    >
                      <Icon path={mdiHandBackRightOutline} size="16px" />
                    </button>
                  </>
                )}

                {toolbarId === 'digitizing' && (
                  <>
                    <button
                      className="toolbar-btn"
                      title="Toggle Editing"
                      onClick={() => {}}
                      aria-label="Toggle Editing"
                    >
                      <Icon path={mdiPencilOutline} size="16px" />
                    </button>
                    <button
                      className="toolbar-btn"
                      title="Add Point Feature"
                      onClick={() => {
                        activeToolSignal.value = 'point';
                      }}
                      aria-label="Add Point Feature"
                    >
                      <Icon path={mdiMapMarkerPlusOutline} size="16px" />
                    </button>
                    <button
                      className="toolbar-btn"
                      title="Add Line Feature"
                      onClick={() => {
                        activeToolSignal.value = 'line';
                      }}
                      aria-label="Add Line Feature"
                    >
                      <Icon path={mdiVectorPolyline} size="16px" />
                    </button>
                    <button
                      className="toolbar-btn"
                      title="Add Polygon Feature"
                      onClick={() => {
                        activeToolSignal.value = 'polygon';
                      }}
                      aria-label="Add Polygon Feature"
                    >
                      <Icon path={mdiVectorPolygon} size="16px" />
                    </button>
                  </>
                )}

                {toolbarId === 'snapping' && (
                  <>
                    <button
                      className={`toolbar-btn ${snappingEnabledSignal.value ? 'active' : ''}`}
                      title="Enable Snapping"
                      onClick={() => {
                        snappingEnabledSignal.value = !snappingEnabledSignal.value;
                      }}
                      aria-label="Enable Snapping"
                    >
                      <Icon path={mdiMagnet} size="16px" />
                    </button>
                    <button
                      className="toolbar-btn"
                      title="Snap to Vertex"
                      onClick={() => {}}
                      aria-label="Snap to Vertex"
                    >
                      <Icon path={mdiVectorPoint} size="16px" />
                    </button>
                    <button
                      className="toolbar-btn"
                      title="Snap to Segment"
                      onClick={() => {}}
                      aria-label="Snap to Segment"
                    >
                      <Icon path={mdiVectorLine} size="16px" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Toolbar Context Menu (Right-Clicking Empty Area) */}
      {contextMenu && (
        <div
          className="toolbar-context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 9999
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-title">Toolbars</div>
          <div className="context-menu-separator" />
          <div
            className="context-menu-item"
            onClick={() => {
              toggleToolbar('digitizing');
              setContextMenu(null);
            }}
          >
            <span className="context-menu-check">
              {visibleMap.digitizing && <Icon path={mdiCheck} size="14px" />}
            </span>
            <span>Digitizing</span>
          </div>
          <div
            className="context-menu-item"
            onClick={() => {
              toggleToolbar('snapping');
              setContextMenu(null);
            }}
          >
            <span className="context-menu-check">
              {visibleMap.snapping && <Icon path={mdiCheck} size="14px" />}
            </span>
            <span>Snapping</span>
          </div>
          <div
            className="context-menu-item"
            onClick={() => {
              toggleToolbar('basic');
              setContextMenu(null);
            }}
          >
            <span className="context-menu-check">
              {visibleMap.basic && <Icon path={mdiCheck} size="14px" />}
            </span>
            <span>Basic</span>
          </div>
        </div>
      )}
    </>
  );
};
