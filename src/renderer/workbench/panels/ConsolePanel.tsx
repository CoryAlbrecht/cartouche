import React from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { consoleLogsSignal, addConsoleLog } from '@renderer/state/gisSignals';

export const ConsolePanel: React.FC = () => {
  useSignals();
  const logs = consoleLogsSignal.value;

  const handleClear = () => {
    consoleLogsSignal.value = [];
  };

  const handleTestLog = () => {
    addConsoleLog('info', `Spatial index recomputed for current extent at ${new Date().toLocaleTimeString()}`, 'SpatialIndex');
  };

  return (
    <div className="console-panel">
      <div className="panel-toolbar">
        <span className="panel-subtitle">Output & Execution Logs ({logs.length})</span>
        <div className="panel-toolbar-actions">
          <button className="small-action-btn" onClick={handleTestLog}>
            + Run Task
          </button>
          <button className="small-action-btn" onClick={handleClear}>
            Clear
          </button>
        </div>
      </div>

      <div className="console-log-list">
        {logs.length === 0 ? (
          <div className="console-empty">No console output recorded.</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className={`console-entry level-${log.level}`}>
              <span className="log-time">{log.timestamp}</span>
              {log.source && <span className="log-source">[{log.source}]</span>}
              <span className={`log-badge badge-${log.level}`}>{log.level.toUpperCase()}</span>
              <span className="log-message">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
