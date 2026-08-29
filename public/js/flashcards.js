    // Custom Dropdown Functions
    let currentDifficultyFilter = '';
    let currentTagFilter = '';

    function toggleCustomDropdown(type) {
        const container = document.getElementById(type + 'DropdownContainer');
        const isOpen = container.classList.contains('open');

        // Close all dropdowns first
        document.querySelectorAll('.fc-dropdown').forEach(dd => {
            dd.classList.remove('open');
        });

        // Toggle current dropdown
        if (!isOpen) {
            container.classList.add('open');

            // Close dropdown when clicking outside
            setTimeout(() => {
                document.addEventListener('click', closeDropdownOutside);
            }, 0);
        }
    }

    function closeDropdownOutside(e) {
        if (!e.target.closest('.fc-dropdown')) {
            document.querySelectorAll('.fc-dropdown').forEach(dd => {
                dd.classList.remove('open');
            });
            document.removeEventListener('click', closeDropdownOutside);
        }
    }

    function selectDifficultyFilter(value, label) {
        currentDifficultyFilter = value;
        document.getElementById('difficultyDropdownText').textContent = label;
        document.getElementById('difficultyDropdownContainer').classList.remove('open');
        applyFilters();
    }

    function selectTagFilter(value, label) {
        currentTagFilter = value;
        document.getElementById('tagDropdownText').textContent = label;
        document.getElementById('tagDropdownContainer').classList.remove('open');
        applyFilters();
    }

    // Modal dropdown functions
    function toggleModalDropdown(type) {
        const container = document.getElementById(type + 'DropdownContainer');
        const isOpen = container.classList.contains('open');

        // Close all modal dropdowns first
        document.querySelectorAll('.fc-dropdown').forEach(dd => {
            dd.classList.remove('open');
        });

        // Toggle current dropdown
        if (!isOpen) {
            container.classList.add('open');
        }
    }

    function selectModalDifficulty(type, value, label) {
        // Update hidden input
        document.getElementById(type).value = value;

        // Update button text
        document.getElementById(type + 'DropdownText').textContent = label;

        // Update selected state
        const menu = document.getElementById(type + 'DropdownMenu');
        menu.querySelectorAll('.fc-dropdown-item').forEach(item => {
            item.classList.remove('selected');
        });
        event.target.classList.add('selected');

        // Close dropdown
        document.getElementById(type + 'DropdownContainer').classList.remove('open');
    }

    // Flashcards state
    let flashcards = [];
    let currentFilters = {
        difficulty: '',
        tag: '',
        search: ''
    };

    // API base URL
    const API_BASE = '/api/v1/cards';

    // Helper functions
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function showToast(message, type = 'success') {
        const palette = {
            success: { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857' },
            error: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' }
        };
        const { bg, border, text } = palette[type] || palette.success;

        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            padding: 12px 18px;
            background: ${bg};
            border: 1px solid ${border};
            color: ${text};
            border-radius: 14px;
            font-size: 0.9rem;
            font-weight: 500;
            box-shadow: 0 10px 25px rgba(0,0,0,0.12);
            z-index: 13001;
            max-width: 320px;
            transition: opacity 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function showLoading() {
        document.getElementById('loadingState').style.display = 'block';
        document.getElementById('cardsGrid').style.display = 'none';
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('errorState').style.display = 'none';
    }

    function showError(message) {
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('cardsGrid').style.display = 'none';
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('errorState').style.display = 'block';
        document.getElementById('errorMessage').textContent = message;
    }

    function updateCardsCount() {
        const count = flashcards.length;
        const countEl = document.getElementById('cardsCount');
        const subEl = document.getElementById('cardsSubCount');
        if (countEl) countEl.textContent = String(count);
        if (subEl) subEl.textContent = count + (count === 1 ? ' card' : ' cards');
    }

    function showContent() {
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('errorState').style.display = 'none';
        if (flashcards.length === 0) {
            document.getElementById('cardsGrid').style.display = 'none';
            document.getElementById('emptyState').style.display = 'block';
        } else {
            document.getElementById('cardsGrid').style.display = 'grid';
            document.getElementById('emptyState').style.display = 'none';
        }
        updateCardsCount();
    }

    // API calls
    async function apiRequest(url, options = {}) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async function loadFlashcards() {
        showLoading();
        try {
            const params = new URLSearchParams();
            if (currentFilters.difficulty) params.append('difficulty', currentFilters.difficulty);

            const url = currentFilters.search
                ? `${API_BASE}/search?query=${encodeURIComponent(currentFilters.search)}`
                : `${API_BASE}?${params.toString()}`;

            const response = await apiRequest(url);
            flashcards = response.data.cards || response.data;

            // Apply tag filter on frontend if needed
            if (currentFilters.tag) {
                flashcards = flashcards.filter(card =>
                    card.tags && card.tags.includes(currentFilters.tag)
                );
            }

            await updateTagOptions();
            renderCards();
            showContent();
        } catch (error) {
            showError(error.message || 'Failed to load flashcards');
        }
    }

    async function updateTagOptions() {
        try {
            const response = await apiRequest(`${API_BASE}/tags`);
            const tags = response.data.tags || [];

            const menu = document.getElementById('tagDropdownMenu');
            const currentValue = currentTagFilter;

            menu.innerHTML = '<div class="fc-dropdown-item" onclick="selectTagFilter(\'\', \'All tags\')">All tags</div>';
            tags.forEach(tag => {
                const item = document.createElement('div');
                item.className = 'fc-dropdown-item';
                item.textContent = tag;
                item.onclick = () => selectTagFilter(tag, tag);
                if (tag === currentValue) {
                    item.classList.add('selected');
                }
                menu.appendChild(item);
            });

        } catch (error) {
            console.error('Failed to load tags:', error);
        }
    }

    function renderCards() {
        const grid = document.getElementById('cardsGrid');

        if (flashcards.length === 0) {
            showContent();
            return;
        }

        grid.innerHTML = flashcards.map(card => {
            const difficultyClass = `difficulty-${card.difficulty || 'medium'}`;
            const firstTag = card.tags && card.tags.length > 0 ? card.tags[0] : null;

            return `
                <div class="flashcard" data-id="${card._id}">
                    <div class="card-inner">
                        <!-- Front — question -->
                        <div class="card-face card-front">
                            <div class="card-badges">
                                <span class="difficulty-badge ${difficultyClass}">${card.difficulty || 'medium'}</span>
                                ${firstTag ? `<span class="tag-badge"><i class="fas fa-tag" style="font-size:0.6rem;"></i>${escapeHtml(firstTag)}</span>` : ''}
                                ${card.isAIGenerated ? '<span class="ai-badge"><i class="fas fa-magic" style="font-size:0.6rem;"></i>AI</span>' : ''}
                            </div>
                            <div class="card-content">
                                <p class="question">${escapeHtml(card.title)}</p>
                            </div>
                            <div class="card-actions">
                                <button class="icon-btn pin ${card.isPinned ? 'active' : ''}" onclick="event.stopPropagation(); togglePin('${card._id}')" title="${card.isPinned ? 'Unpin' : 'Pin'}">
                                    <i class="fas fa-thumbtack"></i>
                                </button>
                                <button class="icon-btn favorite ${card.isFavorite ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite('${card._id}')" title="${card.isFavorite ? 'Unfavorite' : 'Favorite'}">
                                    <i class="fas fa-heart"></i>
                                </button>
                                <button class="icon-btn" onclick="event.stopPropagation(); openEditModal('${card._id}')" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="icon-btn delete" onclick="event.stopPropagation(); openDeleteModal('${card._id}')" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                            <div class="card-hint"><i class="fas fa-sync-alt" style="font-size:0.6rem;"></i>Click to reveal answer</div>
                        </div>
                        <!-- Back — answer -->
                        <div class="card-face card-back">
                            <div class="card-badges">
                                <span class="difficulty-badge ${difficultyClass}">${card.difficulty || 'medium'}</span>
                            </div>
                            <div class="card-content">
                                <p class="answer">${escapeHtml(card.content)}</p>
                            </div>
                            <div class="card-hint"><i class="fas fa-undo" style="font-size:0.6rem;"></i>Click to flip back</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add flip listeners
        document.querySelectorAll('#cardsGrid .flashcard').forEach(card => {
            card.addEventListener('click', async (e) => {
                if (!e.target.closest('.card-actions')) {
                    card.classList.toggle('flipped');

                    // Mark as reviewed when flipped
                    if (card.classList.contains('flipped')) {
                        const cardId = card.dataset.id;
                        try {
                            await apiRequest(`${API_BASE}/${cardId}/review`, { method: 'PATCH' });
                        } catch (error) {
                            console.error('Failed to mark as reviewed:', error);
                        }
                    }
                }
            });
        });
    }

    // Filter and search
    function applyFilters() {
        currentFilters.difficulty = currentDifficultyFilter;
        currentFilters.tag = currentTagFilter;
        currentFilters.search = document.getElementById('searchInput').value.trim();
        loadFlashcards();
    }

    // Debounce search
    let searchTimeout;
    function handleSearch() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            applyFilters();
        }, 500);
    }

    // Modal helpers
    function createModal(content) {
        const overlay = document.getElementById('flashcardModalOverlay');
        const container = document.getElementById('flashcardModalContainer');
        if (!overlay || !container) {
            console.error('Modal elements not found');
            return;
        }
        container.innerHTML = content;
        overlay.style.display = 'flex';
        setTimeout(() => overlay.classList.add('active'), 10);

        // Focus first input
        const firstInput = container.querySelector('input, textarea');
        if (firstInput) setTimeout(() => firstInput.focus(), 100);
    }

    function closeModal() {
        const overlay = document.getElementById('flashcardModalOverlay');
        if (!overlay) return;
        overlay.classList.remove('active');
        setTimeout(() => overlay.style.display = 'none', 200);
    }

    // Create modal
    function openCreateModal() {
        const modal = `
            <div class="flashcard-modal">
                <h2><i class="fas fa-plus text-gray-400"></i>Create a flashcard</h2>
                <p class="modal-sub">One idea per card — a question on the front, the answer on the back.</p>
                <form onsubmit="event.preventDefault(); createCard()" style="display:flex; flex-direction:column; gap:1rem;">
                    <div>
                      <label>Question <span style="color:#ef4444;">*</span></label>
                      <textarea id="newTitle" placeholder="What should you be able to recall?" required maxlength="500" rows="2"></textarea>
                      <p class="muted-small">Up to 500 characters</p>
                    </div>

                    <div>
                      <label>Answer <span style="color:#ef4444;">*</span></label>
                      <textarea id="newContent" placeholder="Write the answer in your own words…" required maxlength="2000" rows="3"></textarea>
                      <p class="muted-small">Up to 2000 characters</p>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; align-items:start;">
                      <div>
                        <label>Difficulty</label>
                        <div class="fc-dropdown" id="newDifficultyDropdownContainer">
                            <button type="button" class="fc-dropdown-btn" id="newDifficultyDropdownBtn" onclick="toggleModalDropdown('newDifficulty')">
                                <span id="newDifficultyDropdownText">Medium</span>
                                <i class="fas fa-chevron-down text-xs opacity-60"></i>
                            </button>
                            <div class="fc-dropdown-menu" id="newDifficultyDropdownMenu">
                                <div class="fc-dropdown-item" onclick="selectModalDifficulty('newDifficulty', 'easy', 'Easy')"><span class="fc-dot fc-dot--easy"></span>Easy</div>
                                <div class="fc-dropdown-item selected" onclick="selectModalDifficulty('newDifficulty', 'medium', 'Medium')"><span class="fc-dot fc-dot--medium"></span>Medium</div>
                                <div class="fc-dropdown-item" onclick="selectModalDifficulty('newDifficulty', 'hard', 'Hard')"><span class="fc-dot fc-dot--hard"></span>Hard</div>
                            </div>
                        </div>
                        <input type="hidden" id="newDifficulty" value="medium">
                      </div>
                      <div>
                        <label>Tags</label>
                        <div class="tag-input-container" id="newTagsContainer">
                            <input type="text" class="tag-input" id="newTagInput" placeholder="Type a tag, press Enter" />
                        </div>
                        <p class="muted-small">Up to 10 tags</p>
                      </div>
                    </div>

                    <div class="modal-actions">
                        <button type="button" class="btn-cancel" onclick="closeModal()">Cancel</button>
                        <button type="submit" class="btn-primary">Create card</button>
                    </div>
                </form>
            </div>
        `;
        createModal(modal);
        initializeTagInput('newTagInput', 'newTagsContainer');
    }

    function initializeTagInput(inputId, containerId) {
        const input = document.getElementById(inputId);
        const container = document.getElementById(containerId);
        const tags = [];

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const value = input.value.trim().toLowerCase();
                if (value && !tags.includes(value) && tags.length < 10) {
                    tags.push(value);
                    renderTags();
                    input.value = '';
                }
            }
        });

        function renderTags() {
            const existingTags = container.querySelectorAll('.tag-chip');
            existingTags.forEach(tag => tag.remove());

            tags.forEach((tag, index) => {
                const chip = document.createElement('span');
                chip.className = 'tag-chip';
                chip.innerHTML = `
                    ${escapeHtml(tag)}
                    <button type="button" onclick="this.parentElement.remove(); window.flashcardTags_${inputId}.splice(${index}, 1);">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                container.insertBefore(chip, input);
            });
        }

        // Store tags globally for access
        window[`flashcardTags_${inputId}`] = tags;
    }

    async function createCard() {
        const title = document.getElementById('newTitle').value.trim();
        const content = document.getElementById('newContent').value.trim();
        const difficulty = document.getElementById('newDifficulty').value;
        const tags = window.flashcardTags_newTagInput || [];

        if (!title || !content) {
            showToast('Title and content are required', 'error');
            return;
        }

        if (title.length > 500) {
            showToast('Title cannot exceed 500 characters', 'error');
            return;
        }

        if (content.length > 2000) {
            showToast('Content cannot exceed 2000 characters', 'error');
            return;
        }

        try {
            await apiRequest(API_BASE, {
                method: 'POST',
                body: JSON.stringify({
                    title,
                    content,
                    difficulty,
                    tags
                })
            });

            showToast('Flashcard created successfully!');
            closeModal();
            loadFlashcards();
        } catch (error) {
            showToast(error.message || 'Failed to create flashcard', 'error');
        }
    }

    // Edit modal
    function openEditModal(id) {
        const card = flashcards.find(c => c._id === id);
        if (!card) return;

        const modal = `
            <div class="flashcard-modal">
                <h2><i class="fas fa-edit text-gray-400"></i>Edit flashcard</h2>
                <p class="modal-sub">Refine the question or the answer.</p>
                <form onsubmit="event.preventDefault(); updateCard('${id}')" style="display:flex; flex-direction:column; gap:1rem;">
                    <div>
                      <label>Question <span style="color:#ef4444;">*</span></label>
                      <textarea id="editTitle" required maxlength="500" rows="2">${escapeHtml(card.title)}</textarea>
                    </div>

                    <div>
                      <label>Answer <span style="color:#ef4444;">*</span></label>
                      <textarea id="editContent" required maxlength="2000" rows="3">${escapeHtml(card.content)}</textarea>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; align-items:start;">
                      <div>
                        <label>Difficulty</label>
                        <div class="fc-dropdown" id="editDifficultyDropdownContainer">
                            <button type="button" class="fc-dropdown-btn" id="editDifficultyDropdownBtn" onclick="toggleModalDropdown('editDifficulty')">
                                <span id="editDifficultyDropdownText">${card.difficulty.charAt(0).toUpperCase() + card.difficulty.slice(1)}</span>
                                <i class="fas fa-chevron-down text-xs opacity-60"></i>
                            </button>
                            <div class="fc-dropdown-menu" id="editDifficultyDropdownMenu">
                                <div class="fc-dropdown-item ${card.difficulty === 'easy' ? 'selected' : ''}" onclick="selectModalDifficulty('editDifficulty', 'easy', 'Easy')"><span class="fc-dot fc-dot--easy"></span>Easy</div>
                                <div class="fc-dropdown-item ${card.difficulty === 'medium' ? 'selected' : ''}" onclick="selectModalDifficulty('editDifficulty', 'medium', 'Medium')"><span class="fc-dot fc-dot--medium"></span>Medium</div>
                                <div class="fc-dropdown-item ${card.difficulty === 'hard' ? 'selected' : ''}" onclick="selectModalDifficulty('editDifficulty', 'hard', 'Hard')"><span class="fc-dot fc-dot--hard"></span>Hard</div>
                            </div>
                        </div>
                        <input type="hidden" id="editDifficulty" value="${card.difficulty}">
                      </div>
                      <div>
                        <label>Tags</label>
                        <div class="tag-input-container" id="editTagsContainer">
                            <input type="text" class="tag-input" id="editTagInput" placeholder="Type a tag, press Enter" />
                        </div>
                      </div>
                    </div>

                    <div class="modal-actions">
                        <button type="button" class="btn-cancel" onclick="closeModal()">Cancel</button>
                        <button type="submit" class="btn-primary">Save changes</button>
                    </div>
                </form>
            </div>
        `;
        createModal(modal);

        // Initialize with existing tags
        window.flashcardTags_editTagInput = card.tags || [];
        initializeTagInput('editTagInput', 'editTagsContainer');

        // Render existing tags
        const container = document.getElementById('editTagsContainer');
        const input = document.getElementById('editTagInput');
        (card.tags || []).forEach((tag, index) => {
            const chip = document.createElement('span');
            chip.className = 'tag-chip';
            chip.innerHTML = `
                ${escapeHtml(tag)}
                <button type="button" onclick="this.parentElement.remove(); window.flashcardTags_editTagInput.splice(${index}, 1);">
                    <i class="fas fa-times"></i>
                </button>
            `;
            container.insertBefore(chip, input);
        });
    }

    async function updateCard(id) {
        const title = document.getElementById('editTitle').value.trim();
        const content = document.getElementById('editContent').value.trim();
        const difficulty = document.getElementById('editDifficulty').value;
        const tags = window.flashcardTags_editTagInput || [];

        if (!title || !content) {
            showToast('Title and content are required', 'error');
            return;
        }

        try {
            await apiRequest(`${API_BASE}/${id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    title,
                    content,
                    difficulty,
                    tags
                })
            });

            showToast('Flashcard updated successfully!');
            closeModal();
            loadFlashcards();
        } catch (error) {
            showToast(error.message || 'Failed to update flashcard', 'error');
        }
    }

    // Delete modal
    function openDeleteModal(id) {
        const card = flashcards.find(c => c._id === id);
        if (!card) return;

        const modal = `
            <div class="flashcard-modal">
                <h2><i class="fas fa-trash text-gray-400"></i>Delete flashcard</h2>
                <p class="modal-sub">This action cannot be undone.</p>
                <div style="background:#f9fafb; border:1px solid #e5e7eb; padding:1rem; border-radius:1rem; margin-bottom:0.5rem;">
                    <p style="font-weight:600; color:#1f2937; margin-bottom:0.35rem;">
                        ${escapeHtml(card.title)}
                    </p>
                    <p style="font-size:0.8125rem; color:#6b7280;">
                        Difficulty: ${card.difficulty || 'medium'}
                    </p>
                </div>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="closeModal()">Cancel</button>
                    <button class="btn-danger" onclick="deleteCard('${id}')">Delete</button>
                </div>
            </div>
        `;
        createModal(modal);
    }

    async function deleteCard(id) {
        try {
            await apiRequest(`${API_BASE}/${id}`, { method: 'DELETE' });
            showToast('Flashcard deleted successfully!');
            closeModal();
            loadFlashcards();
        } catch (error) {
            showToast(error.message || 'Failed to delete flashcard', 'error');
        }
    }

    // Toggle functions
    async function togglePin(id) {
        try {
            await apiRequest(`${API_BASE}/${id}/pin`, { method: 'PATCH' });
            loadFlashcards();
        } catch (error) {
            showToast(error.message || 'Failed to toggle pin', 'error');
        }
    }

    async function toggleFavorite(id) {
        try {
            await apiRequest(`${API_BASE}/${id}/favorite`, { method: 'PATCH' });
            loadFlashcards();
        } catch (error) {
            showToast(error.message || 'Failed to toggle favorite', 'error');
        }
    }

    // AI Generate modal
    async function openAIGenerateModal() {
        // First, fetch user's notes
        showLoading();
        try {
            const response = await fetch('/api/v1/notes');
            const data = await response.json();
            const notes = data.data.notes || [];

            if (notes.length === 0) {
                showContent();
                showToast('No notes found. Create some notes first!', 'error');
                return;
            }

            showContent();

            const modal = `
                <div class="flashcard-modal">
                    <h2><i class="fas fa-magic text-purple-500"></i>Generate flashcards</h2>
                    <p class="modal-sub">Pick a note and AI will turn it into a set of flashcards.</p>

                    <label>Select a note <span style="color:#dc2626;">*</span></label>
                    <div id="notesList" style="max-height: 380px; overflow-y: auto; margin-top:0.5rem;">
                        ${notes.map(note => `
                            <div class="note-item" onclick="selectNote('${note._id}')">
                                <div class="note-title">${escapeHtml(note.title || 'Untitled')}</div>
                                <div class="note-preview">${escapeHtml((note.plainText || '').substring(0, 100))}…</div>
                            </div>
                        `).join('')}
                    </div>

                    <div class="modal-actions">
                        <button type="button" class="btn-cancel" onclick="closeModal()">Cancel</button>
                        <button type="button" class="btn-primary" id="generateBtn" disabled onclick="generateFlashcardsFromNote()">
                            <i class="fas fa-magic"></i>Generate flashcards
                        </button>
                    </div>
                </div>
            `;
            createModal(modal);
        } catch (error) {
            showError(error.message || 'Failed to load notes');
            showToast('Failed to load notes', 'error');
        }
    }

    let selectedNoteId = null;

    function selectNote(noteId) {
        selectedNoteId = noteId;

        // Update UI
        document.querySelectorAll('.note-item').forEach(item => {
            item.classList.remove('selected');
        });
        event.currentTarget.classList.add('selected');

        // Enable generate button
        document.getElementById('generateBtn').disabled = false;
    }

    async function generateFlashcardsFromNote() {
        if (!selectedNoteId) {
            showToast('Please select a note first', 'error');
            return;
        }

        const btn = document.getElementById('generateBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>Generating…';

        try {
            const response = await apiRequest(`${API_BASE}/ai`, {
                method: 'POST',
                body: JSON.stringify({ noteId: selectedNoteId })
            });

            const count = response.data.numberOfCards || response.data.cards?.length || 0;
            showToast(`Successfully generated ${count} flashcards!`);
            closeModal();

            // Wait a bit for backend to save cards, then reload
            setTimeout(() => loadFlashcards(), 1000);
        } catch (error) {
            showToast(error.message || 'Failed to generate flashcards', 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-magic"></i>Generate flashcards';
        }
    }

    // Make functions globally accessible
    window.openCreateModal = openCreateModal;
    window.openEditModal = openEditModal;
    window.openDeleteModal = openDeleteModal;
    window.openAIGenerateModal = openAIGenerateModal;
    window.createCard = createCard;
    window.updateCard = updateCard;
    window.deleteCard = deleteCard;
    window.togglePin = togglePin;
    window.toggleFavorite = toggleFavorite;
    window.generateFlashcardsFromNote = generateFlashcardsFromNote;
    window.selectNote = selectNote;
    window.closeModal = closeModal;
    window.loadFlashcards = loadFlashcards;

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', () => {
        loadFlashcards();

        // Add event listeners
        document.getElementById('searchInput').addEventListener('input', handleSearch);

        // Close modal on overlay click
        const modalOverlay = document.getElementById('flashcardModalOverlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target.id === 'flashcardModalOverlay') closeModal();
            });
        }
    });

    // Reload flashcards when navigating to flashcards section
    if (window.navigationManager) {
        const originalNavigate = window.navigationManager.navigateTo;
        window.navigationManager.navigateTo = function(index) {
            originalNavigate.call(this, index);
            if (index === 3) { // Flashcards section is index 3
                loadFlashcards();
            }
        };
    }