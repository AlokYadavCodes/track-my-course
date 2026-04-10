// --- DOM references ---
const stepSelect = document.getElementById("step-select");
const stepPreview = document.getElementById("step-preview");
const stepResult = document.getElementById("step-result");
const stepError = document.getElementById("step-error");

const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("import-file-input");
const fileNameEl = document.getElementById("file-name");
const previewSummaryEl = document.getElementById("preview-summary");
const courseListEl = document.getElementById("course-list");
const confirmBtn = document.getElementById("confirm-btn");
const resultIconEl = document.getElementById("result-icon");
const resultMessageEl = document.getElementById("result-message");
const errorMessageEl = document.getElementById("error-message");

let pendingImportData = null;

// --- step management ---
function showStep(step) {
    [stepSelect, stepPreview, stepResult, stepError].forEach((el) => el.classList.add("hidden"));
    step.classList.remove("hidden");
}

// --- file selection ---
fileInput.addEventListener("change", (e) => {
    if (e.target.files[0]) processFile(e.target.files[0]);
});

// clicking the drop zone (outside the browse button) also triggers file input
dropZone.addEventListener("click", (e) => {
    if (e.target.closest(".browse-btn")) return; // label already handles it
    fileInput.click();
});

// drag and drop
dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
});

// --- file processing ---
function processFile(file) {
    if (!file.name.endsWith(".json")) {
        showError("Please select a .json file.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const parsed = JSON.parse(event.target.result);
            const validationError = validateImportData(parsed);
            if (validationError) {
                showError(validationError);
                return;
            }
            pendingImportData = parsed.data;
            showPreview(file.name, parsed.data);
        } catch {
            showError("Invalid JSON file. Please select a valid TrackMyCourse backup.");
        }
    };
    reader.readAsText(file);
}

function validateImportData(parsed) {
    if (!parsed || typeof parsed !== "object") {
        return "Invalid file format.";
    }
    if (!parsed.version || !parsed.data || typeof parsed.data !== "object") {
        return "This file doesn't look like a TrackMyCourse backup.";
    }
    return null;
}

// --- preview ---
async function showPreview(fileName, importData) {
    fileNameEl.textContent = fileName;

    const existingData = await getFromStorage(null);
    const importCourses = getCourseEntries(importData);
    const importNoteEl = document.getElementById("import-note");

    let newCount = 0;
    let existsCount = 0;

    // First pass: count new vs existing
    for (const [key] of importCourses) {
        if (existingData[key]) existsCount++;
        else newCount++;
    }

    const isMixed = newCount > 0 && existsCount > 0;

    // Second pass: build the course list
    courseListEl.innerHTML = "";
    for (const [key, value] of importCourses) {
        const exists = Boolean(existingData[key]);

        const li = document.createElement("li");
        li.className = "course-item";

        const name = document.createElement("span");
        name.className = "course-name";
        name.textContent = value.courseName || "Untitled Course";

        li.append(name);

        // Only show badges when there's a mix of new + existing
        if (isMixed && exists) {
            const badge = document.createElement("span");
            badge.className = "badge badge-exists";
            badge.textContent = "already tracked";
            li.append(badge);
        }

        courseListEl.append(li);
    }

    if (importCourses.length === 0) {
        previewSummaryEl.textContent = "No courses found in this backup.";
        importNoteEl.textContent = "";
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Nothing to Import";
    } else if (newCount === 0) {
        previewSummaryEl.textContent = `${existsCount} course${existsCount > 1 ? "s" : ""} found, all already tracked.`;
        importNoteEl.textContent = "No new courses to add from this backup.";
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Nothing to Import";
    } else {
        previewSummaryEl.textContent =
            existsCount > 0
                ? `${importCourses.length} courses found: ${newCount} to import, ${existsCount} already tracked.`
                : `${newCount} course${newCount > 1 ? "s" : ""} found in this backup.`;
        importNoteEl.textContent = "Already tracked courses won't be modified or deleted.";
        confirmBtn.disabled = false;
        confirmBtn.textContent = `Import ${newCount} Course${newCount > 1 ? "s" : ""}`;
    }

    showStep(stepPreview);
}

// --- import ---
confirmBtn.addEventListener("click", async () => {
    if (!pendingImportData) return;
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Importing...";

    try {
        const existingData = await getFromStorage(null);
        const importEntries = getCourseEntries(pendingImportData);

        let newCount = 0;
        const dataToSave = {};

        for (const [key, value] of importEntries) {
            if (!existingData[key]) {
                dataToSave[key] = value;
                newCount++;
            }
        }

        // import focusMode if user doesn't have one set (if already set, don't overwrite)
        if (pendingImportData.focusMode !== undefined && existingData.focusMode === undefined) {
            dataToSave.focusMode = pendingImportData.focusMode;
        }

        if (newCount > 0) {
            await saveToStorage(dataToSave);
        }

        resultIconEl.className = "result-icon success-icon";
        resultIconEl.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>`;
        resultMessageEl.textContent = `Imported ${newCount} course${newCount > 1 ? "s" : ""} successfully!`;
        showStep(stepResult);
    } catch {
        showError("Something went wrong during import. Please try again.");
    }

    pendingImportData = null;
});

// --- error ---
function showError(message) {
    errorMessageEl.textContent = message;
    showStep(stepError);
}

// --- navigation ---
document.getElementById("cancel-btn").addEventListener("click", resetToSelect);
document.getElementById("import-another-btn").addEventListener("click", resetToSelect);
document.getElementById("try-again-btn").addEventListener("click", resetToSelect);
document.getElementById("close-tab-btn").addEventListener("click", () => window.close());

function resetToSelect() {
    pendingImportData = null;
    fileInput.value = "";
    confirmBtn.disabled = false;
    showStep(stepSelect);
}
