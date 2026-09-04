    // Helper function to get cookie - Define early for use throughout
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    // Initialize Quill Editor
    var quill = new Quill("#editor", {
        theme: "snow",
        placeholder: "Start writing your notes...",
        modules: {
            toolbar: [
                // Text Formatting
                ["bold", "italic", "underline", "strike"],

                // Headers and Structure
                [
                    { header: 1 },
                    { header: 2 },
                    { header: [1, 2, 3, 4, 5, 6, false] },
                ],

                // Lists and Indentation
                [{ list: "ordered" }, { list: "bullet" }],
                [{ indent: "-1" }, { indent: "+1" }],

                // Text Style and Formatting
                [{ size: ["small", false, "large", "huge"] }],
                [{ font: [] }],
                [{ color: [] }, { background: [] }],

                // Alignment and Direction
                [{ align: [] }],
                [{ direction: "rtl" }],

                // Special Elements
                ["blockquote", "code-block"],
                [{ script: "sub" }, { script: "super" }],

                // Media and Links
                ["link", "image", "video"],

                // Clean
                ["clean"],
            ],
        },
    });

    /*********************************
     * Local Storage + Save Handling *
     *********************************/
    const LS_KEY = "retroNotes";
    const NOTE_DEFAULTS = {
        tags: [],
        category: "General",
        color: "#ffffff",
        isPinned: false,
        isFavorite: false,
    };
    let currentNoteId = null; // Track the note currently being edited
    let noteToastTimeout;

    function showNoteToast(message, variant = "info") {
        const palette = {
            success: { bg: "#ecfdf5", border: "#6ee7b7", text: "#047857" },
            error: { bg: "#fef2f2", border: "#fecaca", text: "#b91c1c" },
            info: { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
        };
        const { bg, border, text } = palette[variant] || palette.info;
        let toast = document.getElementById("noteToast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "noteToast";
            toast.style.cssText =
                "position:fixed;bottom:24px;right:24px;padding:12px 18px;border-radius:14px;font-size:0.9rem;font-weight:500;box-shadow:0 10px 25px rgba(0,0,0,0.12);z-index:2200;pointer-events:none;transition:opacity 0.3s ease;";
            document.body.appendChild(toast);
        }
        toast.style.background = bg;
        toast.style.border = "1px solid " + border;
        toast.style.color = text;
        toast.textContent = message;
        toast.style.opacity = "1";
        clearTimeout(noteToastTimeout);
        noteToastTimeout = setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }

    function getStoredNotes() {
        try {
            return JSON.parse(localStorage.getItem(LS_KEY)) || [];
        } catch (e) {
            console.warn("Failed to parse notes from localStorage", e);
            return [];
        }
    }

    function storeNotes(notes) {
        localStorage.setItem(LS_KEY, JSON.stringify(notes));
    }

    function generateId() {
        return (
            "note_" +
            Date.now() +
            "_" +
            Math.random().toString(36).slice(2, 8)
        );
    }

    function stripHtml(html) {
        const div = document.createElement("div");
        div.innerHTML = html;
        return div.textContent || div.innerText || "";
    }

    function renderNotesList() {
        const notes = getStoredNotes();
        const list = document.getElementById("notesList");
        list.innerHTML = "";
        notes
            .sort(
                (a, b) =>
                    new Date(b.updatedAt || b.createdAt) -
                    new Date(a.updatedAt || a.createdAt),
            )
            .forEach((note) => {
                const item = document.createElement("div");
                    item.dataset.noteId = note.id;
                    item.className =
                        "note-item flex flex-col bg-white rounded-3xl cursor-pointer transform transition-all duration-200 hover:-translate-y-1 hover:shadow-xl";
                    item.onclick = () => openNote(note.id);
                const dateStr = new Date(
                    note.updatedAt || note.createdAt,
                ).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                });
                const snippet =
                    stripHtml(note.html).slice(0, 160) +
                    (stripHtml(note.html).length > 160 ? "…" : "");
                item.innerHTML = `
          <div class="px-6 py-6">
            <div class="grid items-center justify-center w-full grid-cols-1 text-left">
              <div>
                <h3 class="text-lg font-medium tracking-tighter text-gray-800 mb-2">${
                    note.title || "Untitled Note"
                }</h3>
                <p class="text-sm text-gray-500 leading-relaxed">${
                    snippet || "No content yet."
                }</p>
              </div>
              <div class="mt-4 flex items-center justify-between">
                <div class="flex items-center">
                  <div class="flex items-center text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full">
                    <i class="fas fa-calendar text-purple-500 mr-2"></i>
                    <span class="font-medium">${dateStr}</span>
                  </div>
                </div>
                <div class="flex items-center space-x-2">
                  <button class="tooltip flex items-center justify-center w-8 h-8 text-center text-red-500 duration-200 bg-red-50 border-2 border-red-50 rounded-full hover:bg-transparent hover:border-red-500 hover:text-red-600 focus:outline-none text-xs" data-tooltip="Delete note" onclick="deleteNote(event, '${note.id}')">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>`;
                list.appendChild(item);
            });
    }

    function openNote(id) {
        const notes = getStoredNotes();
        const note = notes.find((n) => n.id === id);
        if (!note) return;
        currentNoteId = note.id;
        document.getElementById("noteTitle").value = note.title || "";
        try {
            if (note.delta) {
                quill.setContents(note.delta);
            } else {
                quill.root.innerHTML = note.html || "";
            }
        } catch (e) {
            quill.root.innerHTML = note.html || "";
        }
        showNotesEditor();
    }

    // Mobile master-detail: show the full-screen editor, hide the list.
    // Desktop is unaffected (the class is only styled under 768px).
    function showNotesEditor() {
        const layout = document.querySelector(".notes-layout");
        if (layout) layout.classList.add("notes-show-editor");
    }

    function backToNotesList() {
        const layout = document.querySelector(".notes-layout");
        if (layout) layout.classList.remove("notes-show-editor");
        toggleNotesActions(false);
    }

    // Mobile "Note actions" (✦) sheet — same handlers as the desktop buttons.
    function toggleNotesActions(force) {
        const sheet = document.getElementById("notesActionsSheet");
        const btn = document.getElementById("notesActionsBtn");
        if (!sheet || !btn) return;
        const show =
            typeof force === "boolean"
                ? force
                : !sheet.classList.contains("open");
        sheet.classList.toggle("open", show);
        btn.setAttribute("aria-expanded", show ? "true" : "false");
    }

    function notesMenuAction(kind) {
        toggleNotesActions(false);
        if (kind === "enhance") enhanceWithRetro();
        else if (kind === "sync") syncNotes();
        else if (kind === "save") saveNote();
        else if (kind === "read") openReadMode();
    }

    // Dismiss the sheet on outside tap / Escape.
    document.addEventListener("click", function (e) {
        const sheet = document.getElementById("notesActionsSheet");
        if (!sheet || !sheet.classList.contains("open")) return;
        if (
            e.target.closest("#notesActionsSheet") ||
            e.target.closest("#notesActionsBtn")
        )
            return;
        toggleNotesActions(false);
    });

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") toggleNotesActions(false);
    });

    async function saveNote(skipIfEmpty = false) {
        const titleInput = document.getElementById("noteTitle");
        const rawTitle = titleInput.value.trim();
        const safeTitle = rawTitle || "Untitled Note";
        const html = quill.root.innerHTML.trim();
        const plain = stripHtml(html).trim();
        const deltaPayload = JSON.parse(JSON.stringify(quill.getContents()));
        if (!Array.isArray(deltaPayload.ops) || deltaPayload.ops.length === 0) {
            deltaPayload.ops = [{ insert: "\n" }];
        }
        if (skipIfEmpty && !rawTitle && !plain) {
            return;
        }
        if (!rawTitle && !plain) {
            return;
        }
        if (!rawTitle) {
            titleInput.value = safeTitle;
        }
        const notes = getStoredNotes();
        let note = currentNoteId ? notes.find((n) => n.id === currentNoteId) : null;
        const now = new Date().toISOString();
        const isExistingNote = !!note;
        if (note) {
            note.title = safeTitle;
            note.html = html;
            note.delta = deltaPayload;
            note.updatedAt = now;
            note.tags = Array.isArray(note.tags) ? note.tags : NOTE_DEFAULTS.tags.slice();
            note.category = note.category || NOTE_DEFAULTS.category;
            note.color = note.color || NOTE_DEFAULTS.color;
            note.isPinned = typeof note.isPinned === "boolean" ? note.isPinned : NOTE_DEFAULTS.isPinned;
            note.isFavorite = typeof note.isFavorite === "boolean" ? note.isFavorite : NOTE_DEFAULTS.isFavorite;
        } else {
            note = {
                id: generateId(),
                title: safeTitle,
                html,
                delta: deltaPayload,
                createdAt: now,
                updatedAt: now,
                tags: NOTE_DEFAULTS.tags.slice(),
                category: NOTE_DEFAULTS.category,
                color: NOTE_DEFAULTS.color,
                isPinned: NOTE_DEFAULTS.isPinned,
                isFavorite: NOTE_DEFAULTS.isFavorite,
            };
            notes.push(note);
            currentNoteId = note.id;
        }
        storeNotes(notes);

        // Prepare payload for server
        const payload = {
            title: note.title,
            content: note.delta,
            tags: note.tags || [],
            category: note.category || "General",
            color: note.color || "#ffffff",
            isPinned: !!note.isPinned,
            isFavorite: !!note.isFavorite,
        };

        try {
            const headers = { "Content-Type": "application/json" };
            const token = localStorage.getItem("accessToken") || getCookie("accessToken");
            if (token) {
                headers["Authorization"] = "Bearer " + token;
            }

            // Determine if we need to create or update
            const hasRemoteId = !!note.remoteId;
            const url = hasRemoteId ? `/api/v1/notes/${note.remoteId}` : "/api/v1/notes";
            const method = hasRemoteId ? "PUT" : "POST";

            const response = await fetch(url, {
                method: method,
                headers,
                credentials: "include",
                body: JSON.stringify(payload),
            });

            let result = {};
            try {
                result = await response.json();
            } catch (parseErr) {
                result = {};
            }

            if (!response.ok) {
                const message = result && result.message ? result.message : "Failed to save note";
                throw new Error(message);
            }

            const responseData = result && result.data ? result.data : {};
            note.remoteId = responseData._id || note.remoteId;
            note.syncedAt = new Date().toISOString();
            storeNotes(notes);
            renderNotesList();
            showNoteToast(hasRemoteId ? "Note updated successfully." : "Note created successfully.", "success");
        } catch (err) {
            console.warn("Error sending note to server", err);
            renderNotesList();
            showNoteToast((err && err.message) || "Unable to sync note", "error");
        }
    }

    function createNewNote() {
        saveNote(true);
        currentNoteId = null;
        document.getElementById("noteTitle").value = "";
        quill.setContents([]);
        quill.focus();
        showNotesEditor();
    }

    window.saveNote = saveNote;

    async function enhanceWithRetro() {

        // Save note first to ensure we have a remote ID
        await saveNote(false);

        const titleInput = document.getElementById("noteTitle");
        const title = titleInput.value.trim() || "Untitled Note";

        if (!title || title === "Untitled Note") {
            showNoteToast("Please add a title to your note before enhancing", "error");
            return;
        }

        // Get the note from local storage to get remoteId
        const notes = getStoredNotes();
        const note = currentNoteId ? notes.find(n => n.id === currentNoteId) : null;

        if (!note || !note.remoteId) {
            showNoteToast("Please save the note to the server first before enhancing", "error");
            return;
        }

        // Check if note has content
        const content = quill.getText().trim();
        if (!content || content.length < 10) {
            showNoteToast("Note content is too short to enhance. Add at least 10 characters.", "error");
            return;
        }

        let overlay = document.getElementById("enhance-overlay");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "enhance-overlay";
            overlay.style.cssText = `position:fixed;inset:0;background:rgba(255,255,255,0.75);backdrop-filter:saturate(180%) blur(4px);display:flex;align-items:center;justify-content:center;z-index:2000;`;
            overlay.innerHTML = `<div style="text-align:center;font-family:'Space Grotesk',sans-serif;">
          <div class="animate-spin" style="width:54px;height:54px;border:5px solid #ddd;border-top-color:#7e22ce;border-radius:50%;margin:0 auto 1.25rem"></div>
          <h3 style="margin:0 0 .5rem;font-size:1.15rem;color:#333;font-weight:600;">Enhancing note…</h3>
          <p style="margin:0;color:#555;font-size:.9rem;max-width:360px;">Polishing wording while preserving your voice. This usually takes a few seconds.</p>
      </div>`;
            document.body.appendChild(overlay);
        }

        try {
            const headers = { "Content-Type": "application/json" };
            // No need to add Authorization header - HTTP-only cookie is sent automatically

            const requestBody = { noteId: note.remoteId };

            const response = await fetch("/api/v1/notes/enhance", {
                method: "POST",
                headers: headers,
                credentials: "include",
                body: JSON.stringify(requestBody),
            });


            if (!response.ok) {
                console.error("Response not OK. Status:", response.status);
                const errorText = await response.text();
                console.error("Error response body:", errorText);

                if (response.status === 401) {
                    // User is not authenticated - redirect to login
                    showNoteToast("Please login to use AI enhancement", "error");
                    setTimeout(() => {
                        if (confirm("You need to be logged in to use AI enhancement. Would you like to login now?")) {
                            window.location.href = "/login";
                        }
                    }, 1000);
                    return;
                } else if (response.status === 403) {
                    throw new Error("You don't have permission to enhance this note.");
                } else if (response.status === 404) {
                    throw new Error("Note not found. Please save the note first.");
                } else {
                    let errorData = {};
                    try {
                        errorData = JSON.parse(errorText);
                    } catch (e) {
                        console.error("Failed to parse error response:", e);
                    }
                    throw new Error(errorData.message || "Enhancement failed");
                }
            }

            const data = await response.json();

            if (!data || !data.success) {
                throw new Error(data?.message || "Invalid enhance response");
            }

            const md = data.enhancedMarkdown || "";

            // Parse markdown and update editor
            try {
                const rendered = marked.parse(md);
                quill.root.innerHTML = rendered;

                // Save the enhanced note
                await saveNote(false);

                // Show success message with improvements
                const improvements = data.improvements || [];
                const improvementText = improvements.length > 0
                    ? `Improvements: ${improvements.join(", ")}`
                    : "Note enhanced successfully";
                showNoteToast(improvementText, "success");

            } catch (e) {
                console.warn("Markdown render failed, fallback to text", e);
                quill.setText(md);
                await saveNote(false);
                showNoteToast("Note enhanced successfully", "success");
            }
        } catch (err) {
            console.error("=== ENHANCE ERROR ===");
            console.error("Error type:", err.constructor.name);
            console.error("Error message:", err.message);
            console.error("Error stack:", err.stack);
            console.error("Full error:", err);

            const errorMessage = err.message || "Unknown error occurred";
            showNoteToast("Enhancement failed: " + errorMessage, "error");
        } finally {
            if (overlay) overlay.remove();
        }
    }

    // Make enhanceWithRetro globally available for onclick handler
    window.enhanceWithRetro = enhanceWithRetro;

    async function syncNotes() {
        showNoteToast("Syncing notes...", "info");

        try {
            const headers = { "Content-Type": "application/json" };
            const token = localStorage.getItem("accessToken") || getCookie("accessToken");
            if (token) {
                headers["Authorization"] = "Bearer " + token;
            }

            const response = await fetch("/api/v1/notes", {
                method: "GET",
                headers,
                credentials: "include",
            });

            let result = {};
            try {
                result = await response.json();
            } catch (parseErr) {
                result = {};
            }

            if (!response.ok) {
                const message = result && result.message ? result.message : "Failed to sync notes";
                throw new Error(message);
            }

            const serverNotes = result && result.data && result.data.notes ? result.data.notes : [];
            const localNotes = getStoredNotes();

            // Merge server notes with local notes
            serverNotes.forEach(serverNote => {
                const existingNote = localNotes.find(n => n.remoteId === serverNote._id);

                if (existingNote) {
                    // Update existing note with server data
                    existingNote.title = serverNote.title;
                    existingNote.delta = serverNote.content;
                    existingNote.html = extractHtmlFromDelta(serverNote.content);
                    existingNote.tags = serverNote.tags || [];
                    existingNote.category = serverNote.category || "General";
                    existingNote.color = serverNote.color || "#ffffff";
                    existingNote.isPinned = !!serverNote.isPinned;
                    existingNote.isFavorite = !!serverNote.isFavorite;
                    existingNote.updatedAt = serverNote.updatedAt || serverNote.lastEditedAt;
                    existingNote.syncedAt = new Date().toISOString();
                } else {
                    // Add new note from server
                    const newNote = {
                        id: generateId(),
                        remoteId: serverNote._id,
                        title: serverNote.title,
                        delta: serverNote.content,
                        html: extractHtmlFromDelta(serverNote.content),
                        tags: serverNote.tags || [],
                        category: serverNote.category || "General",
                        color: serverNote.color || "#ffffff",
                        isPinned: !!serverNote.isPinned,
                        isFavorite: !!serverNote.isFavorite,
                        createdAt: serverNote.createdAt,
                        updatedAt: serverNote.updatedAt || serverNote.lastEditedAt,
                        syncedAt: new Date().toISOString(),
                    };
                    localNotes.push(newNote);
                }
            });

            storeNotes(localNotes);
            renderNotesList();
            showNoteToast(`Successfully synced ${serverNotes.length} notes`, "success");
        } catch (err) {
            console.warn("Error syncing notes", err);
            showNoteToast((err && err.message) || "Unable to sync notes", "error");
        }
    }

    // Helper function to extract HTML from Delta format
    function extractHtmlFromDelta(delta) {
        if (!delta || !delta.ops) return "";
        const tempQuill = new Quill(document.createElement("div"));
        tempQuill.setContents(delta);
        return tempQuill.root.innerHTML;
    }

    function deleteNote(event, noteId) {
        event.stopPropagation();

        const noteItem = event.target.closest(".note-item");
        if (!noteItem) {
            console.error("Note item not found");
            return;
        }

        const noteTitle = noteItem.querySelector("h3")
            ? noteItem.querySelector("h3").textContent
            : "Untitled Note";

        const modal = document.createElement("div");
        modal.className = "profile-modal active";
        modal.style.cssText = "display:flex;";

        const modalContent = document.createElement("div");
        modalContent.className = "profile-modal-content retro-dossier";
        modalContent.style.cssText = "max-width:420px;";

        modalContent.innerHTML = `
      <div class="dossier-topbar" style="padding:0.85rem 1.15rem;">
        <div class="dossier-eyebrow" style="font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-muted);display:flex;align-items:center;gap:0.45rem;">
          <span style="width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;"></span>
          RETRO <span style="opacity:0.4;">·</span> DELETE
        </div>
        <button id="close-delete-note-top" style="width:32px;height:32px;border-radius:9px;border:1.5px solid var(--border-color);background:var(--bg-secondary);display:grid;place-items:center;color:var(--text-secondary);cursor:pointer;">
          <i class="fas fa-times" style="font-size:0.85rem;"></i>
        </button>
      </div>
      <div style="padding:1.4rem 1.35rem 1.1rem; text-align:left;">
        <div style="display:flex;gap:0.9rem;align-items:flex-start;margin-bottom:1rem;">
          <div style="width:40px;height:40px;border-radius:10px;background:rgba(239,68,68,0.10);border:1px solid rgba(239,68,68,0.18);display:grid;place-items:center;flex-shrink:0;color:#ef4444;">
            <i class="fas fa-trash" style="font-size:1rem;"></i>
          </div>
          <div style="min-width:0;flex:1;">
            <h2 style="margin:0;font-family:'Space Grotesk',sans-serif;font-size:1.12rem;font-weight:700;letter-spacing:-0.02em;color:var(--text-primary);line-height:1.2;">Delete note?</h2>
            <p style="margin:0.3rem 0 0 0;font-size:0.88rem;line-height:1.5;color:var(--text-secondary);">This will permanently remove the note. This cannot be undone.</p>
          </div>
        </div>
        <div style="background:var(--bg-tertiary);border:1px solid var(--border-color);border-left:3px solid #ef4444;border-radius:10px;padding:0.85rem 1rem;display:flex;align-items:center;gap:0.6rem;">
          <i class="fas fa-file-alt" style="color:var(--text-muted);font-size:0.9rem;flex-shrink:0;"></i>
          <strong style="font-family:'Space Grotesk',sans-serif;font-size:0.92rem;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(noteTitle)}</strong>
        </div>
      </div>
      <div style="display:flex;gap:0.7rem;padding:0.95rem 1.15rem;border-top:1.5px solid var(--border-color);background:var(--bg-secondary);">
        <button id="cancel-delete-note" style="flex:1;padding:0.7rem 1rem;border-radius:999px;border:1.5px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-family:'Space Grotesk',sans-serif;font-size:0.88rem;font-weight:600;cursor:pointer;transition:all 0.15s;">
          Cancel
        </button>
        <button id="confirm-delete-note" style="flex:1;padding:0.7rem 1rem;border-radius:999px;border:1.5px solid #ef4444;background:#ef4444;color:white;font-family:'Space Grotesk',sans-serif;font-size:0.88rem;font-weight:700;cursor:pointer;transition:all 0.15s;display:inline-flex;align-items:center;justify-content:center;gap:0.45rem;">
          <i class="fas fa-trash" style="font-size:0.8rem;"></i>
          Delete
        </button>
      </div>
    `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        document
            .getElementById("cancel-delete-note")
            .addEventListener("click", () => {
                document.body.removeChild(modal);
            });

        document
            .getElementById("confirm-delete-note")
            .addEventListener("click", async () => {
                // Get the note ID from the noteItem's data attribute or find it
                const noteId = noteItem.dataset.noteId;
                if (!noteId) {
                    console.error("Note ID not found");
                    document.body.removeChild(modal);
                    return;
                }

                // Delete from localStorage
                const notes = getStoredNotes();
                const noteIndex = notes.findIndex(n => n.id === noteId);

                if (noteIndex === -1) {
                    console.error("Note not found in localStorage");
                    document.body.removeChild(modal);
                    return;
                }

                const note = notes[noteIndex];

                // Remove from localStorage
                notes.splice(noteIndex, 1);
                storeNotes(notes);

                // Animate removal from UI
                noteItem.style.transition = "opacity 0.3s ease, transform 0.3s ease";
                noteItem.style.opacity = "0";
                noteItem.style.transform = "translateX(-20px)";

                setTimeout(() => {
                    noteItem.remove();
                }, 300);

                document.body.removeChild(modal);

                // Delete from server if it has a remoteId
                if (note.remoteId) {
                    try {
                        const headers = { "Content-Type": "application/json" };
                        const token = localStorage.getItem("accessToken") || getCookie("accessToken");
                        if (token) {
                            headers["Authorization"] = "Bearer " + token;
                        }

                        const response = await fetch(`/api/v1/notes/${note.remoteId}`, {
                            method: "DELETE",
                            headers,
                            credentials: "include",
                        });

                        if (!response.ok) {
                            console.warn("Failed to delete note from server");
                            showNoteToast("Note deleted locally but failed to delete from server", "error");
                        } else {
                            showNoteToast("Note deleted successfully", "success");
                        }
                    } catch (err) {
                        console.warn("Error deleting note from server", err);
                        showNoteToast("Note deleted locally but failed to delete from server", "error");
                    }
                } else {
                    showNoteToast("Note deleted successfully", "success");
                }

                // If the deleted note was currently open, clear the editor
                if (currentNoteId === noteId) {
                    currentNoteId = null;
                    document.getElementById("noteTitle").value = "";
                    quill.setContents([]);
                    backToNotesList();
                }
            });

        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });

        const cancelBtn = document.getElementById("cancel-delete-note");
        const confirmBtn = document.getElementById("confirm-delete-note");
        const topClose = document.getElementById("close-delete-note-top");
        if (topClose) topClose.addEventListener("click", () => { if (document.body.contains(modal)) document.body.removeChild(modal); });

        // subtle hover — keep contrast
        cancelBtn.addEventListener("mouseenter", () => { cancelBtn.style.transform = "translateY(-1px)"; });
        cancelBtn.addEventListener("mouseleave", () => { cancelBtn.style.transform = "none"; });
        confirmBtn.addEventListener("mouseenter", () => { confirmBtn.style.background = "#dc2626"; confirmBtn.style.borderColor = "#dc2626"; confirmBtn.style.transform = "translateY(-1px)"; });
        confirmBtn.addEventListener("mouseleave", () => { confirmBtn.style.background = "#ef4444"; confirmBtn.style.borderColor = "#ef4444"; confirmBtn.style.transform = "none"; });
    }

    function openReadMode() {
        const modal = document.getElementById("readModal");
        const titleInput = document.getElementById("noteTitle");
        const title = titleInput.value.trim() || titleInput.placeholder;
        const readModeHeaderTitle = document.getElementById(
            "readModeHeaderTitle",
        );
        const readModeContent =
            document.getElementById("readModeContent");

        readModeHeaderTitle.textContent = title;

        const content = quill.root.innerHTML;
        readModeContent.innerHTML = content;

        modal.classList.add("active");
        document.body.style.overflow = "hidden";
    }

    function closeReadMode() {
        const modal = document.getElementById("readModal");
        modal.classList.remove("active");
        document.body.style.overflow = "hidden";
    }

    // Make closeReadMode globally available for navigation system
    window.closeReadMode = closeReadMode;

    const readModal = document.getElementById("readModal");
    if (readModal) {
        readModal.addEventListener("click", function (e) {
            if (e.target === this) {
                closeReadMode();
            }
        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") {
                closeReadMode();
            }
        });
    }

    // Search functionality
    document
        .getElementById("searchInput")
        .addEventListener("input", function (e) {
            const searchTerm = e.target.value.toLowerCase();
            const noteItems = document.querySelectorAll(".note-item");

            noteItems.forEach((item) => {
                const titleElement = item.querySelector("h3");
                const contentElement = item.querySelector("p");

                if (titleElement && contentElement) {
                    const title =
                        titleElement.textContent.toLowerCase();
                    const content =
                        contentElement.textContent.toLowerCase();

                    if (
                        title.includes(searchTerm) ||
                        content.includes(searchTerm)
                    ) {
                        item.style.display = "block";
                    } else {
                        item.style.display = "none";
                    }
                }
            });
        });

    // Auto-save functionality
    let autoSaveTimeout;
    quill.on("text-change", function () {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(function () {
            if (currentNoteId) {
                saveNote(true);
            }
        }, 2000);
    });



    // Initial load of stored notes on page ready
    window.addEventListener("DOMContentLoaded", () => {
        renderNotesList();
    });