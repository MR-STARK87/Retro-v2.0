    // Greeting messages pool
    const greetings = [
    "Hi {name}, ready to build something meaningful?",
    "Welcome back, {name}. Let’s get into flow.",
    "Hey {name}, what shall we explore today?",
    "Good to see you, {name}. Let's create something amazing.",
    "{name}, your ideas are safe here — let’s begin.",
    "Hi {name}, what’s on your mind right now?",
    "Welcome, {name}. Let’s make today productive and calm.",
    "Hey {name}, shall we craft something great?",
    "{name}, ready to dive in? I’m here.",
    "Hi {name}, let’s shape something brilliant.",
    "Welcome back, {name}. Your workspace is ready.",
    "Hello {name}, let’s turn thoughts into progress.",
    "Hey {name}, let's spark something new today.",
    "Hi {name}, ready for a clean, focused session?",
    "{name}, let’s create with intention.",
    "Hello {name}, your next idea starts here.",
    "Good to have you here, {name}. Let’s begin.",
    "Hi {name}, the canvas is yours.",
    "Welcome {name}, let’s bring clarity to your ideas.",
    "Hey {name}, another step toward something great.",
    "{name}, let’s get into the zone.",
    "Hello {name}, let’s build something you’ll be proud of.",
    "Hi {name}, where shall we go today?",
    "Welcome back, {name}. Let’s make progress together.",
    "Hey {name}, your creativity belongs here.",
];


    // Escape HTML to prevent XSS - Define globally
    function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    // Safe markdown renderer for assistant messages.
    // Input is escaped FIRST, then formatted - untrusted text can never inject HTML.
    function renderMarkdown(text) {
        const escaped = escapeHtml(text);

        // Pull out fenced code blocks so their contents get no further formatting
        const codeBlocks = [];
        const src = escaped.replace(/```(?:[a-zA-Z0-9+-]*)\n?([\s\S]*?)```/g, (m, code) => {
            codeBlocks.push(`<pre class="md-pre"><code>${code.replace(/\n$/, "")}</code></pre>`);
            return `\u0000CB${codeBlocks.length - 1}\u0000`;
        });

        const inline = (s) =>
            s
                .replace(/`([^`\n]+)`/g, '<code class="md-code">$1</code>')
                .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
                .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
                .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

        const lines = src.split("\n");
        const out = [];
        let listType = null;

        const closeList = () => {
            if (listType) {
                out.push(`</${listType}>`);
                listType = null;
            }
        };

        // Table helpers (GitHub-style: header | separator | rows)
        const isTableSeparator = (s) => s.includes("-") && /^\|?[\s:|-]+\|?$/.test(s);
        const splitRow = (row) =>
            row.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

        let i = 0;
        while (i < lines.length) {
            const rawLine = lines[i];
            const line = rawLine.trimEnd();
            const stripped = line.trim();

            // Table: current line has pipes and the next non-blank line
            // is a |---|---| separator (some models pad rows with blank lines)
            if (stripped.includes("|")) {
                let sep = i + 1;
                while (sep < lines.length && !lines[sep].trim()) sep++;
                if (sep < lines.length && isTableSeparator(lines[sep].trim())) {
                    closeList();
                    const headerCells = splitRow(stripped);
                    i = sep + 1;
                    const bodyRows = [];
                    while (i < lines.length) {
                        const row = lines[i].trim();
                        if (!row) {
                            // Blank line: keep the table alive only if the next
                            // non-blank line is another pipe row
                            let j = i + 1;
                            while (j < lines.length && !lines[j].trim()) j++;
                            if (j < lines.length && lines[j].trim().includes("|")) {
                                i = j;
                                continue;
                            }
                            break;
                        }
                        if (!row.includes("|")) break;
                        bodyRows.push(splitRow(row));
                        i++;
                    }
                    const thead = headerCells.map((c) => `<th>${inline(c)}</th>`).join("");
                    const tbody = bodyRows
                        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
                        .join("");
                    out.push(
                        `<div class="md-table-wrap"><table class="md-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>`,
                    );
                    continue;
                }
            }

            if (/^\u0000CB\d+\u0000$/.test(stripped)) {
                closeList();
                out.push(stripped);
                i++;
                continue;
            }
            if (!stripped) {
                closeList();
                i++;
                continue;
            }

            const heading = stripped.match(/^(#{1,3})\s+(.*)$/);
            if (heading) {
                closeList();
                const level = heading[1].length + 2;
                out.push(`<h${level} class="md-heading">${inline(heading[2])}</h${level}>`);
                i++;
                continue;
            }
            if (/^(-{3,}|\*{3,})$/.test(stripped)) {
                closeList();
                out.push('<hr class="md-hr">');
                i++;
                continue;
            }
            const quote = stripped.match(/^&gt;\s?(.*)$/);
            if (quote) {
                closeList();
                out.push(`<blockquote class="md-quote">${inline(quote[1])}</blockquote>`);
                i++;
                continue;
            }
            const ulItem = stripped.match(/^[-*]\s+(.*)$/);
            if (ulItem) {
                if (listType !== "ul") {
                    closeList();
                    out.push('<ul class="md-list">');
                    listType = "ul";
                }
                out.push(`<li>${inline(ulItem[1])}</li>`);
                i++;
                continue;
            }
            const olItem = stripped.match(/^\d+[.)]\s+(.*)$/);
            if (olItem) {
                if (listType !== "ol") {
                    closeList();
                    out.push('<ol class="md-list">');
                    listType = "ol";
                }
                out.push(`<li>${inline(olItem[1])}</li>`);
                i++;
                continue;
            }
            closeList();
            out.push(`<p class="md-p">${inline(stripped)}</p>`);
            i++;
        }
        closeList();

        return out
            .join("\n")
            .replace(/\u0000CB(\d+)\u0000/g, (m, i) => codeBlocks[Number(i)]);
    }

    // Scroll helpers
    function isNearBottom(el, threshold = 120) {
        return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    }

    function scrollToBottom(el, smooth = false) {
        el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    }

    // Copy message text with clipboard fallback
    function fallbackCopyText(text, done) {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand("copy");
            done();
        } catch (err) {
            /* clipboard unavailable */
        }
        ta.remove();
    }

    function copyMessageText(btn, rawText) {
        const done = () => {
            const icon = btn.querySelector("i");
            icon.className = "fas fa-check";
            btn.classList.add("copied");
            setTimeout(() => {
                icon.className = "far fa-copy";
                btn.classList.remove("copied");
            }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(rawText).then(done).catch(() => fallbackCopyText(rawText, done));
        } else {
            fallbackCopyText(rawText, done);
        }
    }

    // Typing indicator - a random "activity" word that keeps shuffling
    const TYPING_WORDS = [
        "thinking",
        "reasoning",
        "wandering",
        "pondering",
        "musing",
        "contemplating",
        "reflecting",
        "daydreaming",
        "canoodling",
        "deliberating",
    ];

    // Toast notifications
    function showToast(message, type = "error") {
        const container = document.getElementById("toastContainer");
        if (!container) return;
        const icons = {
            error: "fa-exclamation-circle",
            success: "fa-check-circle",
            info: "fa-info-circle",
        };
        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="fas ${icons[type] || icons.error}"></i><span>${escapeHtml(message)}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add("leaving");
            setTimeout(() => toast.remove(), 250);
        }, 3500);
    }

    // Copy buttons for markdown code blocks
    function addCodeBlockCopyButtons(scope) {
        scope.querySelectorAll(".md-pre").forEach((pre) => {
            if (pre.querySelector(".md-copy-btn")) return;
            const btn = document.createElement("button");
            btn.className = "md-copy-btn";
            btn.setAttribute("aria-label", "Copy code");
            btn.title = "Copy code";
            btn.innerHTML = '<i class="far fa-copy"></i>';
            btn.addEventListener("click", function () {
                copyMessageText(this, pre.querySelector("code").textContent);
            });
            pre.appendChild(btn);
        });
    }

    // Auto-title a session from its first user message (fire and forget)
    async function maybeAutoTitleSession(sessionId, firstMessage) {
        const trimmed = firstMessage.trim();
        if (!sessionId || !trimmed) return;
        const title = trimmed.slice(0, 40) + (trimmed.length > 40 ? "..." : "");
        try {
            await fetch(`/api/v1/chat-sessions/${sessionId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ title }),
            });
        } catch (error) {
            // Non-critical - the session just keeps its default title
        }
    }

    const TYPING_BAR_CELLS = 12;

    function createTypingIndicator() {
        const el = document.createElement("div");
        el.className = "flex justify-start message-fade-in";
        el.innerHTML = `
            <div class="typing-indicator">
                <span class="typing-prompt">&gt;</span><span class="typing-word">thinking</span><span class="typing-bar">${"░".repeat(TYPING_BAR_CELLS)}</span>
            </div>
        `;

        const wordEl = el.querySelector(".typing-word");
        const barEl = el.querySelector(".typing-bar");

        let lastIndex = 0;
        const wordTimer = setInterval(() => {
            let next;
            do {
                next = Math.floor(Math.random() * TYPING_WORDS.length);
            } while (next === lastIndex);
            lastIndex = next;
            wordEl.textContent = TYPING_WORDS[next];
        }, 1300 + Math.random() * 700);

        // ASCII progress bar - fills cell by cell, holds when full, restarts
        let ticks = 0;
        const cycle = TYPING_BAR_CELLS + 8;
        const barTimer = setInterval(() => {
            const step = ticks % cycle;
            const filled = Math.min(step, TYPING_BAR_CELLS);
            barEl.textContent = "█".repeat(filled) + "░".repeat(TYPING_BAR_CELLS - filled);
            ticks++;
        }, 90);

        el._stopTyping = () => {
            clearInterval(wordTimer);
            clearInterval(barTimer);
        };

        return el;
    }

    function removeTypingIndicator(loadingId) {
        const el = document.getElementById(`loading-${loadingId}`);
        if (el) {
            if (el._stopTyping) el._stopTyping();
            el.remove();
        }
    }

    // Get random greeting
    function getRandomGreeting(name) {
        const randomIndex = Math.floor(Math.random() * greetings.length);
        return greetings[randomIndex].replace('{name}', name);
    }

    // Load and display user greeting
    async function loadUserGreeting() {
        const greetingElement = document.getElementById('userGreeting');
        const greetingText = greetingElement.querySelector('.greeting-text');

        try {
            const response = await fetch('/api/v1/auth/me', {
                method: 'GET',
                credentials: 'include'
            });

            let firstName = 'Friend';
            if (response.ok) {
                const data = await response.json();
                const fullFirstName = data.user && data.user.firstName ? data.user.firstName : 'Friend';
                firstName = fullFirstName.split(' ')[0];
            }

            greetingText.textContent = getRandomGreeting(firstName);
            greetingElement.style.display = 'flex';
            greetingElement.style.zIndex = '10';
        } catch (error) {
            console.error('Failed to load user data:', error);
            greetingText.textContent = getRandomGreeting('Friend');
            greetingElement.style.display = 'flex';
        }
    }

    // Hide greeting with animation
    function hideGreeting() {
        const greetingElement = document.getElementById('userGreeting');
        if (greetingElement && greetingElement.style.display !== 'none') {
            // Hide immediately by reducing z-index so messages show through
            greetingElement.style.zIndex = '-1';
            greetingElement.classList.add('fade-out');
            setTimeout(() => {
                greetingElement.style.display = 'none';
                greetingElement.classList.remove('fade-out');
                greetingElement.style.zIndex = '10'; // Reset for next time
            }, 500);
        }
    }

    // Helper function to reset greeting (for testing)
    window.resetGreeting = function() {
        // Clear the chat thread
        const chatThread = document.querySelector('.chat-thread');
        if (chatThread) {
            chatThread.innerHTML = '';
        }
        // Reload the page to show greeting
        window.location.reload();
    };

    // Track if user has sent first message - using localStorage to persist across refreshes
    // We'll check if there are any messages in the chat thread instead
    let hasUserSentMessage = false;

    // Utility functions - Define globally before DOMContentLoaded
    function extractPlainTextFromDelta(delta) {
        if (!delta || !delta.ops) return '';
        return delta.ops.map(op => {
            if (typeof op.insert === 'string') {
                return op.insert;
            }
            return '';
        }).join('');
    }

    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    // Attached Note State - Define globally
    let attachedNote = null;

    // Chat Session State - Define globally
    let currentChatSessionId = null;
    let chatSessions = [];

    // Append message function - Define globally so it's accessible everywhere
    function appendMessage(message, isUser, timestamp) {
        const chatMessages = document.querySelector(".chat-messages .chat-thread");
        const messagesContainer = document.querySelector(".chat-messages");

        const ts = timestamp ? new Date(timestamp) : new Date();
        const timeLabel = ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        const body = isUser
            ? `<p>${escapeHtml(message)}</p>`
            : `<div class="md-body">${renderMarkdown(message)}</div>`;

        const messageElement = document.createElement("div");
        messageElement.classList.add("flex", "message-fade-in", isUser ? "justify-end" : "justify-start");

        messageElement.innerHTML = `
            <div class="bubble-wrap">
                <div class="bg-${isUser ? "gray-100" : "black"} rounded-3xl text-${isUser ? "gray-800" : "white"} chat-bubble chat-bubble--${isUser ? "user" : "assistant"}">
                    ${body}
                    <div class="msg-meta">
                        <span class="msg-timestamp">${timeLabel}</span>
                        ${isUser ? "" : '<button class="msg-copy-btn" aria-label="Copy message" title="Copy message"><i class="far fa-copy"></i></button>'}
                    </div>
                </div>
            </div>
        `;

        if (!isUser) {
            messageElement.querySelector(".msg-copy-btn")?.addEventListener("click", function () {
                copyMessageText(this, message);
            });
            addCodeBlockCopyButtons(messageElement);
        }

        // Only auto-scroll if the user is near the bottom (or just sent a message)
        const nearBottom = messagesContainer ? isNearBottom(messagesContainer) : true;
        const scrollBtn = document.getElementById("scrollToBottomBtn");
        if (!nearBottom && !isUser && scrollBtn) {
            scrollBtn.classList.add("has-new");
        }

        chatMessages.appendChild(messageElement);
        if (nearBottom || isUser) {
            scrollToBottom(messagesContainer);
        }
    }

    // Streaming variant: builds the same DOM as appendMessage but with an
    // empty body that gets filled chunk by chunk. finalize() wires the copy
    // button to the full raw text once the stream completes.
    function createStreamingMessage() {
        const ts = new Date();
        const timeLabel = ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        const messageElement = document.createElement("div");
        messageElement.classList.add("flex", "message-fade-in", "justify-start");
        messageElement.innerHTML = `
            <div class="bubble-wrap">
                <div class="bg-black rounded-3xl text-white chat-bubble chat-bubble--assistant">
                    <div class="md-body"></div>
                    <div class="msg-meta">
                        <span class="msg-timestamp">${timeLabel}</span>
                        <button class="msg-copy-btn" aria-label="Copy message" title="Copy message"><i class="far fa-copy"></i></button>
                    </div>
                </div>
            </div>
        `;

        const bodyEl = messageElement.querySelector(".md-body");
        const finalize = (rawText) => {
            messageElement.querySelector(".msg-copy-btn")?.addEventListener("click", function () {
                copyMessageText(this, rawText);
            });
            addCodeBlockCopyButtons(messageElement);
        };

        return { element: messageElement, bodyEl, finalize };
    }

    // Read a paced text/plain chunked response and render it as a smooth
    // retro typewriter: network chunks silently fill a buffer while a rAF
    // loop reveals characters at a steady pace (catching up if it lags),
    // so text flows in letter by letter instead of arriving in bursts.
    async function readStreamedAnswer(response, loadingId, isFirstMessage, firstUserMessage) {
        const chatThread = document.querySelector(".chat-messages .chat-thread");
        const messagesContainer = document.querySelector(".chat-messages");
        const streamMsg = createStreamingMessage();
        chatThread.appendChild(streamMsg.element);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        let networkDone = false;
        let indicatorRemoved = false;

        const removeIndicatorOnce = () => {
            if (!indicatorRemoved) {
                removeTypingIndicator(loadingId);
                indicatorRemoved = true;
            }
        };

        // Network side: keep the buffer topped up, never touch the DOM here
        const readPromise = (async () => {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                removeIndicatorOnce();
                accumulated += decoder.decode(value, { stream: true });
            }
            accumulated += decoder.decode(); // flush any pending bytes
            removeIndicatorOnce();
        })();
        readPromise.finally(() => { networkDone = true; });

        // Typewriter reveal: steady base pace, speeds up so it never trails
        // the buffer by more than ~1.2s (long answers don't crawl)
        await new Promise((resolve) => {
            const BASE_CPS = 220;        // relaxed typing pace (chars/sec)
            const CATCHUP_SECONDS = 1.2;
            const CARET = "\u258C";
            let displayed = 0;
            let last = performance.now();

            const frame = (now) => {
                const dt = Math.min((now - last) / 1000, 0.1);
                last = now;

                const backlog = accumulated.length - displayed;
                if (backlog > 0) {
                    const cps = Math.max(BASE_CPS, backlog / CATCHUP_SECONDS);
                    displayed = Math.min(accumulated.length, displayed + cps * dt);
                    const partial = accumulated.slice(0, Math.floor(displayed));
                    streamMsg.bodyEl.innerHTML = renderMarkdown(partial + CARET);
                    if (messagesContainer && isNearBottom(messagesContainer)) {
                        scrollToBottom(messagesContainer);
                    }
                }

                if (networkDone && displayed >= accumulated.length) {
                    resolve();
                    return;
                }
                requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
        });

        // Final render without the caret
        streamMsg.bodyEl.innerHTML = renderMarkdown(accumulated || "...");
        streamMsg.finalize(accumulated);

        if (messagesContainer && isNearBottom(messagesContainer)) {
            scrollToBottom(messagesContainer);
        }

        // Surface network errors thrown mid-stream (partial text stays up)
        await readPromise;

        // Title the session from its first exchange
        if (isFirstMessage) {
            maybeAutoTitleSession(currentChatSessionId, firstUserMessage);
        }
    }

    // Chat History Sidebar Functions
    function toggleSidebar() {
        const sidebar = document.getElementById('chatHistorySidebar');
        const overlay = document.getElementById('sidebarOverlay');
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');

        if (sidebar.classList.contains('open')) {
            loadChatSessions();
        }
    }

    function closeSidebar() {
        const sidebar = document.getElementById('chatHistorySidebar');
        const overlay = document.getElementById('sidebarOverlay');
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
    }

    async function loadChatSessions() {
        const sessionsList = document.getElementById('chatSessionsList');
        sessionsList.innerHTML = '<div class="sessions-loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

        try {
            const response = await fetch('/api/v1/chat-sessions', {
                method: 'GET',
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to load chat sessions');
            }

            chatSessions = await response.json();

            if (chatSessions.length === 0) {
                sessionsList.innerHTML = '<div class="sessions-empty"><i class="fas fa-comments" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.3;"></i><br>No chat history yet</div>';
                return;
            }

            sessionsList.innerHTML = '';
            chatSessions.forEach(session => {
                const sessionItem = document.createElement('div');
                sessionItem.className = 'chat-session-item';
                if (session._id === currentChatSessionId) {
                    sessionItem.classList.add('active');
                }

                const title = session.title || 'New Chat';
                const preview = session.messages && session.messages.length > 0
                    ? session.messages[session.messages.length - 1].content.substring(0, 50)
                    : 'No messages yet';

                sessionItem.innerHTML = `
                    <div class="chat-session-title">${escapeHtml(title)}</div>
                    <div class="chat-session-preview">${escapeHtml(preview)}</div>
                    <button class="chat-session-delete" onclick="deleteChatSession(event, '${session._id}')" aria-label="Delete session">
                        <i class="fas fa-trash"></i>
                    </button>
                `;

                sessionItem.onclick = (e) => {
                    if (!e.target.closest('.chat-session-delete')) {
                        loadChatSession(session._id);
                    }
                };

                sessionsList.appendChild(sessionItem);
            });

        } catch (error) {
            console.error('Error loading chat sessions:', error);
            sessionsList.innerHTML = '<div class="sessions-empty text-red-500"><i class="fas fa-exclamation-triangle"></i><br>Failed to load sessions</div>';
        }
    }

    async function findEmptySession() {
        try {
            const response = await fetch('/api/v1/chat-sessions', {
                method: 'GET',
                credentials: 'include',
            });

            if (!response.ok) return null;

            const sessions = await response.json();
            // Find first session with no messages
            return sessions.find(session => !session.messages || session.messages.length === 0);
        } catch (error) {
            console.error('Error finding empty session:', error);
            return null;
        }
    }

    async function createNewChatSession() {
        try {
            // First, check if there's an empty session we can reuse
            const emptySession = await findEmptySession();

            if (emptySession) {
                currentChatSessionId = emptySession._id;
            } else {
                // Create new session only if no empty one exists
                const response = await fetch('/api/v1/chat-sessions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({ title: 'New Chat' }),
                });

                if (!response.ok) {
                    throw new Error('Failed to create chat session');
                }

                const newSession = await response.json();
                currentChatSessionId = newSession._id;
            }

            // Clear chat
            const chatThread = document.querySelector('.chat-thread');
            chatThread.innerHTML = '';

            // Show greeting
            hasUserSentMessage = false;
            loadUserGreeting();

            closeSidebar();
            return { _id: currentChatSessionId };

        } catch (error) {
            console.error('Error creating chat session:', error);
            showToast("Couldn't start a new chat", "error");
        }
    }

    async function loadChatSession(sessionId) {
        try {
            const response = await fetch(`/api/v1/chat-sessions/${sessionId}`, {
                method: 'GET',
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to load chat session');
            }

            const session = await response.json();
            currentChatSessionId = session._id;

            // Clear and load messages
            const chatThread = document.querySelector('.chat-thread');
            chatThread.innerHTML = '';

            // Hide or show greeting based on messages
            const userGreeting = document.getElementById('userGreeting');

            if (session.messages && session.messages.length > 0) {
                hasUserSentMessage = true;
                if (userGreeting) {
                    userGreeting.style.display = 'none';
                }
                session.messages.forEach(msg => {
                    appendMessage(msg.content, msg.sender === 'user', msg.createdAt);
                });
            } else {
                hasUserSentMessage = false;
                if (userGreeting) {
                    userGreeting.style.display = 'flex';
                }
                loadUserGreeting();
            }

            closeSidebar();

        } catch (error) {
            console.error('Error loading chat session:', error);
            showToast("Couldn't load that chat", "error");
        }
    }

    // Delete confirmation modal state
    let sessionToDelete = null;

    function showDeleteConfirmModal(sessionId) {
        sessionToDelete = sessionId;
        const modal = document.getElementById('deleteConfirmModal');
        modal.classList.add('active');
        modal.style.display = 'block';
    }

    function hideDeleteConfirmModal() {
        const modal = document.getElementById('deleteConfirmModal');
        modal.classList.remove('active');
        modal.style.display = 'none';
        sessionToDelete = null;
    }

    async function deleteChatSession(event, sessionId) {
        event.stopPropagation();
        showDeleteConfirmModal(sessionId);
    }

    async function confirmDelete() {
        if (!sessionToDelete) return;

        const sessionId = sessionToDelete;
        hideDeleteConfirmModal();

        try {
            const response = await fetch(`/api/v1/chat-sessions/${sessionId}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to delete chat session');
            }

            // If deleted session was current, create new one
            if (sessionId === currentChatSessionId) {
                await createNewChatSession();
            }

            // Reload sessions list
            loadChatSessions();

        } catch (error) {
            console.error('Error deleting chat session:', error);
            showToast("Couldn't delete that chat", "error");
        }
    }

    // Make functions globally available
    window.toggleSidebar = toggleSidebar;
    window.closeSidebar = closeSidebar;
    window.deleteChatSession = deleteChatSession;

    // Chat Functionality
    document.addEventListener("DOMContentLoaded", async () => {
        // Set up sidebar event listeners
        document.getElementById('chatHistoryToggle')?.addEventListener('click', toggleSidebar);
        document.getElementById('closeSidebar')?.addEventListener('click', closeSidebar);
        document.getElementById('sidebarOverlay')?.addEventListener('click', closeSidebar);
        document.getElementById('newChatBtn')?.addEventListener('click', createNewChatSession);

        // Set up delete confirmation modal listeners
        document.getElementById('confirmDeleteBtn')?.addEventListener('click', confirmDelete);
        document.getElementById('cancelDeleteBtn')?.addEventListener('click', hideDeleteConfirmModal);
        // Close modal when clicking outside
        document.getElementById('deleteConfirmModal')?.addEventListener('click', function(e) {
            if (e.target === this) {
                hideDeleteConfirmModal();
            }
        });

        const textarea = document.querySelector(".chat-textarea");
        const sendBtn = document.querySelector(".chat-send-btn");
        const chatMessages = document.querySelector(".chat-messages .chat-thread");

        // Check if there are any existing messages in the chat
        const hasExistingMessages = chatMessages && chatMessages.children.length > 0;
        hasUserSentMessage = hasExistingMessages;

        // Initialize chat session on page load - reuse empty session if available
        if (!currentChatSessionId) {
            const emptySession = await findEmptySession();
            if (emptySession) {
                currentChatSessionId = emptySession._id;
            } else {
                await createNewChatSession();
            }
        }

        // Load user greeting only if chat is empty
        if (!hasExistingMessages) {
            loadUserGreeting();
        }

        // Auto-resize textarea
        const autosize = () => {
            textarea.style.height = "auto";
            const max = parseInt(getComputedStyle(textarea).maxHeight || 160, 10);
            textarea.style.height = Math.min(textarea.scrollHeight, max) + "px";

            // Toggle button state
            const hasText = textarea.value.trim().length > 0;
            if (sendBtn) {
                sendBtn.toggleAttribute("disabled", !hasText);
                sendBtn.classList.toggle("is-active", hasText);
            }
        };

        // Initialize height and state
        autosize();
        if (textarea) {
            textarea.addEventListener("input", autosize);

            // Enter sends, Shift+Enter inserts a newline
            textarea.addEventListener("keydown", (e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
                    e.preventDefault();
                    if (sendBtn && !sendBtn.disabled) {
                        sendBtn.click();
                    }
                }
            });
        }

        // Suggestion chips: send the prompt straight away
        document.querySelectorAll(".suggestion-chip").forEach((chip) => {
            chip.addEventListener("click", () => {
                textarea.value = chip.dataset.prompt;
                textarea.dispatchEvent(new Event("input"));
                if (sendBtn && !sendBtn.disabled) {
                    sendBtn.click();
                }
            });
        });

        // Ensure the latest messages are visible on load
        const messagesContainer = document.querySelector(".chat-messages");
        const scrollBtn = document.getElementById("scrollToBottomBtn");
        if (messagesContainer) {
            scrollToBottom(messagesContainer);

            // Scroll-to-bottom button: show when scrolled away from the latest messages
            messagesContainer.addEventListener("scroll", () => {
                const show = !isNearBottom(messagesContainer, 160);
                if (scrollBtn) {
                    scrollBtn.style.display = show ? "flex" : "none";
                    if (!show) {
                        scrollBtn.classList.remove("has-new");
                    }
                }
            });
            scrollBtn?.addEventListener("click", () => {
                scrollToBottom(messagesContainer, true);
                scrollBtn.classList.remove("has-new");
            });
        }

        // appendMessage is now defined globally above

        // Send message
        sendBtn?.addEventListener("click", async () => {
            const message = textarea.value.trim();
            if (!message) return;

            // Create session if none exists
            if (!currentChatSessionId) {
                const newSession = await createNewChatSession();
                if (!newSession) {
                    showToast("Couldn't start a chat session. Try again.", "error");
                    return;
                }
            }

            // Hide greeting on first message
            const isFirstMessageInSession = !hasUserSentMessage;
            if (!hasUserSentMessage) {
                hideGreeting();
                hasUserSentMessage = true;
            }

            appendMessage(message, true);
            const currentAttachedNote = attachedNote; // Store reference before clearing
            textarea.value = "";
            textarea.dispatchEvent(new Event("input")); // To resize and disable send button

            // Show loading indicator
            const loadingId = Date.now();
            const loadingMessage = createTypingIndicator();
            loadingMessage.id = `loading-${loadingId}`;
            chatMessages.appendChild(loadingMessage);
            scrollToBottom(messagesContainer);

            try {
                let apiEndpoint = "/api/v1/chat";
                let requestBody = {
                    message,
                    chatSessionId: currentChatSessionId,
                    stream: true // opt in to paced chunked response
                };

                // Check if a note is attached
                if (currentAttachedNote) {
                    apiEndpoint = "/api/v1/chat-with-note";
                    requestBody.noteId = currentAttachedNote.id;

                    // Clear the attachment after sending
                    removeAttachedNote();
                }

                // Call the appropriate chat API endpoint
                const response = await fetch(apiEndpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include", // Include cookies for authentication
                    body: JSON.stringify(requestBody),
                });

                if (!response.ok) {
                    // Errors are always JSON (streaming only starts after
                    // the full answer is generated and persisted)
                    removeTypingIndicator(loadingId);
                    const errorData = await response.json().catch(() => ({}));
                    if (response.status === 401) {
                        appendMessage("Your session has expired. Please login again.", false);
                        setTimeout(() => {
                            window.location.href = "/login";
                        }, 2000);
                        return;
                    }
                    throw new Error(errorData.message || `Server error: ${response.status}`);
                }

                const contentType = response.headers.get("Content-Type") || "";
                if (contentType.includes("text/plain") && response.body) {
                    // Streamed mode: paced plain-text chunks
                    await readStreamedAnswer(response, loadingId, isFirstMessageInSession, message);
                } else {
                    // JSON fallback (e.g. old server, or response.body unsupported)
                    removeTypingIndicator(loadingId);
                    const data = await response.json();
                    if (data.success && data.response) {
                        appendMessage(data.response, false);

                        // Title the session from its first exchange
                        if (isFirstMessageInSession) {
                            maybeAutoTitleSession(currentChatSessionId, message);
                        }
                    } else {
                        throw new Error("Invalid response format from server");
                    }
                }
            } catch (error) {
                console.error("Error connecting to chat API:", error);

                // Remove loading indicator if still present
                removeTypingIndicator(loadingId);

                // Show error message
                appendMessage(
                    `Sorry, I couldn't process your message. Error: ${error.message}`,
                    false,
                );
            }
        });
    });

    // Notes Popup Functions - Define globally
    // Toggle attachment: open modal if no attachment, remove if already attached
    function toggleAttachment() {
        const attachBtn = document.getElementById('attachmentBtn');

        // If note is already attached, remove it
        if (attachedNote) {
            removeAttachedNote();
        } else {
            // Otherwise, open the notes modal to attach one
            openNotesModal();
        }
    }

    function openNotesModal() {
        const popup = document.getElementById('notesPopup');
        popup.style.display = 'flex';
        loadNotesForModal();
    }

    function closeNotesModal() {
        const popup = document.getElementById('notesPopup');
        popup.style.display = 'none';
    }

    function closeNotesPopup() {
        closeNotesModal();
    }

    async function loadNotesForModal() {
        const notesListContainer = document.getElementById('notesListPopup');
        notesListContainer.innerHTML = '<div class="notes-loading"><i class="fas fa-spinner fa-spin"></i> Loading notes...</div>';

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

            if (!response.ok) {
                if (response.status === 401) {
                    notesListContainer.innerHTML = '<div class="notes-error">Please login to view your notes.</div>';
                    return;
                }
                throw new Error("Failed to load notes");
            }

            const result = await response.json();
            const notes = result && result.data && result.data.notes ? result.data.notes : [];

            if (notes.length === 0) {
                notesListContainer.innerHTML = '<div class="notes-empty"><i class="fas fa-sticky-note" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i><br>No notes found. Create some notes first!</div>';
                return;
            }

            notesListContainer.innerHTML = '';
            notes.forEach(note => {
                const noteItem = document.createElement('div');
                noteItem.className = 'note-item-popup';
                noteItem.onclick = () => attachNote(note);

                const plainText = extractPlainTextFromDelta(note.content);
                const preview = plainText.slice(0, 60) + (plainText.length > 60 ? '...' : '');

                noteItem.innerHTML = `
                    <h4>${escapeHtml(note.title || 'Untitled Note')}</h4>
                    <p>${escapeHtml(preview || 'No content')}</p>
                `;
                notesListContainer.appendChild(noteItem);
            });

        } catch (error) {
            console.error('Error loading notes:', error);
            notesListContainer.innerHTML = '<div class="notes-error"><i class="fas fa-exclamation-triangle"></i> Failed to load notes. Please try again.</div>';
        }
    }

    function attachNote(note) {
        // Store the attached note
        attachedNote = {
            id: note._id,
            title: note.title || 'Untitled Note',
            content: note.content
        };

        // Update button to show green state
        const attachBtn = document.getElementById('attachmentBtn');
        attachBtn.classList.add('has-attachment');
        attachBtn.setAttribute('title', `Attached: ${attachedNote.title} (Click to remove)`);

        closeNotesModal();

        const textarea = document.querySelector('.chat-textarea');
        textarea.focus();
    }

    function removeAttachedNote() {
        attachedNote = null;

        const attachBtn = document.getElementById('attachmentBtn');
        attachBtn.classList.remove('has-attachment');
        attachBtn.setAttribute('title', 'Attach a note');
    }

    // Close popup when clicking outside
    document.addEventListener('click', function(event) {
        const popup = document.getElementById('notesPopup');
        const attachBtn = document.getElementById('attachmentBtn');

        if (popup && popup.style.display === 'flex') {
            if (!popup.contains(event.target) && !attachBtn.contains(event.target)) {
                closeNotesModal();
            }
        }
    });

    // Make functions available globally
    window.toggleAttachment = toggleAttachment;
    window.openNotesModal = openNotesModal;
    window.closeNotesModal = closeNotesModal;
    window.closeNotesPopup = closeNotesPopup;
    window.removeAttachedNote = removeAttachedNote;