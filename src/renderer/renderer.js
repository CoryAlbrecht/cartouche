// Cartouche Renderer Process Script

document.addEventListener('DOMContentLoaded', () => {
  // Update version info from preload bridge
  const electronInfo = document.getElementById('electron-version-info');
  if (window.electronAPI && electronInfo) {
    electronInfo.textContent = `Electron ${window.electronAPI.version || 'v33.x'} (${window.electronAPI.platform || 'linux'})`;
  }

  // Window control buttons (frameless window)
  const minBtn = document.getElementById('win-min');
  const maxBtn = document.getElementById('win-max');
  const closeBtn = document.getElementById('win-close');
  const iconMax = document.getElementById('icon-max');
  const iconRestore = document.getElementById('icon-restore');

  if (window.electronAPI) {
    minBtn?.addEventListener('click', () => {
      window.electronAPI.minimizeWindow();
    });

    maxBtn?.addEventListener('click', () => {
      window.electronAPI.maximizeWindow();
    });

    closeBtn?.addEventListener('click', () => {
      window.electronAPI.closeWindow();
    });

    const menuBar = document.querySelector('.menu-bar');
    menuBar?.addEventListener('dblclick', (e) => {
      if (e.target.closest('.menu-item, .window-controls, button')) return;
      window.electronAPI.maximizeWindow();
    });

    window.electronAPI.onMaximizedState?.((isMaximized) => {
      if (isMaximized) {
        iconMax?.classList.add('hidden');
        iconRestore?.classList.remove('hidden');
      } else {
        iconMax?.classList.remove('hidden');
        iconRestore?.classList.add('hidden');
      }
    });

    // Check initial state
    window.electronAPI.isWindowMaximized?.().then((isMaximized) => {
      if (isMaximized) {
        iconMax?.classList.add('hidden');
        iconRestore?.classList.remove('hidden');
      }
    });
  }

  // Viewport Mouse Tracking / Coordinate calculation demo
  const viewport = document.getElementById('map-viewport');
  const coordStatus = document.getElementById('status-coord');

  if (viewport && coordStatus) {
    viewport.addEventListener('mousemove', (e) => {
      const rect = viewport.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Project mock coordinates centered at (0, 0)
      const lon = (((x - rect.width / 2) / (rect.width / 2)) * 180).toFixed(6);
      const lat = (-((y - rect.height / 2) / (rect.height / 2)) * 85).toFixed(6);

      coordStatus.textContent = `Coordinate: ${lon}°, ${lat}°`;
    });

    viewport.addEventListener('mouseleave', () => {
      coordStatus.textContent = 'Coordinate: 0.000000°, 0.000000°';
    });
  }

  // Toolbar button active state toggling
  const toolButtons = document.querySelectorAll('.toolbar .tool-btn');
  toolButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      // For navigation tools, set single active
      if (['btn-pan', 'btn-zoom-in', 'btn-zoom-out', 'btn-full-extent'].includes(btn.id)) {
        toolButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      }
    });
  });

  // Layer toggle listener
  const layerCheckboxes = document.querySelectorAll('.layer-item input[type="checkbox"]');
  layerCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', (e) => {
      const label = e.target.closest('.layer-item').querySelector('.layer-title').textContent;
      console.log(`Layer '${label}' visibility: ${e.target.checked}`);
    });
  });
});
