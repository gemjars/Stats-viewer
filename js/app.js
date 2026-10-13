// Main entry point: app state, tab switching, storage controls, init.

let players = [];

async function persistAndRefresh() {
  try {
    await DataStore.save(players);
    showToast("Saved.");
  } catch (e) {
    console.error(e);
    showToast(
      "Could not save to the connected folder. Changes are kept in this browser only.",
      true,
    );
  }
  renderPlayersList();
  renderComparePicker();
  renderCompareTable();
}

function showToast(message, isError) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.toggle("error", !!isError);
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.hidden = true;
  }, 3000);
}

function renderStorageStatus() {
  const status = document.getElementById("storage-status");
  const connectBtn = document.getElementById("btn-connect-folder");
  const help = document.getElementById("storage-help");

  if (!DataStore.supportsFileSystemAccess) {
    status.textContent = "Using browser storage (use Export/Import to back up)";
    connectBtn.hidden = true;
    help.hidden = true;
    return;
  }

  connectBtn.hidden = false;
  if (DataStore.isConnected) {
    status.textContent = `Saving to folder "${DataStore.folderName}"`;
    connectBtn.textContent = "Change Folder";
    help.hidden = true;
  } else if (DataStore.needsReconnect) {
    status.textContent = "Folder connection needs to be reconfirmed";
    connectBtn.textContent = "Reconnect Folder";
    help.hidden = false;
    help.textContent =
      'Click "Reconnect Folder" and allow access again - browsers forget folder permission after a restart.';
  } else {
    status.textContent = "Using browser storage only";
    connectBtn.textContent = "Connect Folder";
    help.hidden = false;
    help.textContent =
      'Your data is already saved automatically in this browser. "Connect Folder" is optional: it also saves a players-data.json file to a folder you choose, so you can back it up or move it to another computer. Pick an empty folder for your data - not this app\'s own folder.';
  }
}

function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".tab-btn")
        .forEach((b) => b.classList.remove("active"));
      document
        .querySelectorAll(".tab-panel")
        .forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });
}

function setupStorageControls() {
  document
    .getElementById("btn-connect-folder")
    .addEventListener("click", async () => {
      try {
        if (DataStore.needsReconnect) {
          const ok = await DataStore.reconnectFolder();
          if (!ok) {
            throw new Error(
              "Permission to that folder was denied. Click the button again and allow access, or use Export/Import instead.",
            );
          }
        } else {
          await DataStore.connectFolder();
        }
        players = await DataStore.load();
        renderStorageStatus();
        await persistAndRefresh();
      } catch (e) {
        if (e.name === "AbortError") return; // user closed the folder picker - not an error
        console.error(e);
        showToast(e.message || "Could not connect folder.", true);
      }
    });

  document.getElementById("btn-export").addEventListener("click", () => {
    DataStore.exportJson(players);
  });

  document.getElementById("btn-import").addEventListener("click", () => {
    document.getElementById("input-import").click();
  });

  document
    .getElementById("input-import")
    .addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        players = await DataStore.importJson(file);
        await persistAndRefresh();
        showToast("Import successful.");
      } catch (err) {
        console.error(err);
        showToast("Could not import that file. Is it valid JSON?", true);
      }
      e.target.value = "";
    });
}

async function init() {
  await DataStore.init();
  players = await DataStore.load();

  setupTabs();
  setupStorageControls();
  setupPlayersTab();
  setupCompareTab();

  renderStorageStatus();
  renderPlayersList();
  renderComparePicker();
  renderCompareTable();
}

document.addEventListener("DOMContentLoaded", init);
