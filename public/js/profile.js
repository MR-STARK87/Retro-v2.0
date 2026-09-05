    let menuDropdownOpen = false;
    let themeSubmenuOpen = false;
    let userProfileData = null;
    let userMemoryData = null;

    // Toggle menu dropdown
    function toggleMenuDropdown() {
        const dropdown = document.getElementById('menuDropdown');
        menuDropdownOpen = !menuDropdownOpen;

        if (menuDropdownOpen) {
            dropdown.classList.add('active');
            dropdown.style.display = 'block';
            if (!userProfileData) {
                loadUserProfile();
            }
            updateThemeCheckmarks();
        } else {
            dropdown.classList.remove('active');
            if (themeSubmenuOpen) {
                toggleThemeSubmenu();
            }
            setTimeout(() => {
                dropdown.style.display = 'none';
            }, 300);
        }
    }

    // Toggle theme submenu
    function toggleThemeSubmenu() {
        const submenu = document.getElementById('themeSubmenu');
        themeSubmenuOpen = !themeSubmenuOpen;

        if (themeSubmenuOpen) {
            submenu.classList.add('active');
            submenu.style.display = 'block';
            updateThemeCheckmarks();
        } else {
            submenu.classList.remove('active');
            setTimeout(() => {
                submenu.style.display = 'none';
            }, 300);
        }
    }

    // Set theme
    function setTheme(theme) {
        const body = document.body;

        if (theme === 'dark') {
            body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            body.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        }

        updateThemeCheckmarks();
    }

    // Update theme checkmarks
    function updateThemeCheckmarks() {
        const lightCheck = document.getElementById('lightCheck');
        const darkCheck = document.getElementById('darkCheck');
        const currentTheme = localStorage.getItem('theme') || 'light';

        if (currentTheme === 'dark') {
            lightCheck.style.display = 'none';
            darkCheck.style.display = 'block';
        } else {
            lightCheck.style.display = 'block';
            darkCheck.style.display = 'none';
        }
    }

    // Open profile modal
    function openProfile() {
        const modal = document.getElementById('profileModal');
        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        if (menuDropdownOpen) {
            toggleMenuDropdown();
        }

        if (!userProfileData) {
            loadUserProfile();
        } else {
            // refresh initials in case tier changed
            displayTierBadge(userProfileData.subscription?.tier || 'free');
        }

        // ESC to close
        document.addEventListener('keydown', escCloseProfile);
    }

    function escCloseProfile(e) {
        if (e.key === 'Escape') closeProfile();
    }

    // Close profile modal
    function closeProfile() {
        const modal = document.getElementById('profileModal');
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        document.removeEventListener('keydown', escCloseProfile);
        setTimeout(() => {
            modal.style.display = 'none';
        }, 280);
    }

    // Handle logout
    async function handleLogout() {
        try {
            const response = await fetch('/api/v1/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                window.location.href = '/';
            } else {
                console.error('Logout failed');
                alert('Failed to logout. Please try again.');
            }
        } catch (error) {
            console.error('Logout error:', error);
            alert('An error occurred during logout.');
        }
    }

    // Load user profile data
    async function loadUserProfile() {
        try {
            const response = await fetch('/api/v1/auth/me', {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                userProfileData = data.user;
                userMemoryData = data.memory || null;
                displayUserProfile(data.user);
                // tier may be inside user object already
                if (data.user?.subscription?.tier) displayTierBadge(data.user.subscription.tier);
            } else {
                displayDefaultProfile();
            }
        } catch (error) {
            console.error('Failed to load user profile:', error);
            displayDefaultProfile();
        }
    }

    // Display user profile data — dossier style
    function displayUserProfile(user) {
        const nameEl = document.getElementById('profileName');
        const usernameEl = document.getElementById('profileUsername');
        const emailEl = document.getElementById('profileEmail');
        const emailHeroEl = document.getElementById('profileEmailHero');
        const joinedEl = document.getElementById('profileJoined');
        const verifiedEl = document.getElementById('profileVerified');
        const initialsEl = document.getElementById('profileInitials');
        const iconEl = document.getElementById('profileAvatarIcon');
        const footerUserEl = document.getElementById('profileFooterUser');
        const catalogEl = document.getElementById('profileCatalogNo');
        const statusEl = document.getElementById('profileStatus');
        const verifyHintEl = document.getElementById('profileVerifyHint');

        const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
        nameEl.textContent = fullName || user.username || 'User';
        usernameEl.textContent = user.username ? `@${user.username}` : '@user';
        if (emailEl) emailEl.textContent = user.email || '—';
        if (emailHeroEl) emailHeroEl.textContent = user.email || '—';
        if (footerUserEl) footerUserEl.textContent = user.username ? `@${user.username}` : '@user';

        // initials
        let initials = 'R';
        if (user.firstName || user.lastName) {
            initials = `${(user.firstName?.[0] || '')}${(user.lastName?.[0] || '')}`.toUpperCase().trim() || (user.username?.[0]?.toUpperCase() || 'R');
        } else if (user.username) {
            initials = user.username.slice(0,2).toUpperCase();
        }
        if (initialsEl) {
            initialsEl.textContent = initials.slice(0,2);
            initialsEl.style.display = 'block';
            if (iconEl) iconEl.style.display = 'none';
        }

        // joined
        if (user.createdAt) {
            const d = new Date(user.createdAt);
            const str = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            joinedEl.textContent = str;
            if (catalogEl) {
                const id = user._id ? String(user._id).slice(-4).toUpperCase() : '001';
                catalogEl.textContent = `DOSSIER — ${id}`;
            }
        } else {
            joinedEl.textContent = 'Recently';
        }

        // verified
        if (user.isEmailVerified) {
            verifiedEl.style.display = 'inline-flex';
            if (verifyHintEl) verifyHintEl.style.display = 'none';
            if (statusEl) statusEl.textContent = 'Verified';
        } else {
            verifiedEl.style.display = 'none';
            if (verifyHintEl) verifyHintEl.style.display = 'block';
            if (statusEl) statusEl.textContent = 'Unverified';
        }
    }

    // Display default profile when not authenticated
    function displayDefaultProfile() {
        const nameEl = document.getElementById('profileName');
        const usernameEl = document.getElementById('profileUsername');
        const emailEl = document.getElementById('profileEmail');
        const emailHeroEl = document.getElementById('profileEmailHero');
        const joinedEl = document.getElementById('profileJoined');
        const verifiedEl = document.getElementById('profileVerified');
        const initialsEl = document.getElementById('profileInitials');
        const footerUserEl = document.getElementById('profileFooterUser');
        const verifyHintEl = document.getElementById('profileVerifyHint');

        if (nameEl) nameEl.textContent = 'Guest User';
        if (usernameEl) usernameEl.textContent = '@guest';
        if (emailEl) emailEl.textContent = 'Not signed in';
        if (emailHeroEl) emailHeroEl.textContent = 'Sign in to sync';
        if (joinedEl) joinedEl.textContent = '—';
        if (verifiedEl) verifiedEl.style.display = 'none';
        if (initialsEl) initialsEl.textContent = 'G';
        if (footerUserEl) footerUserEl.textContent = '@guest';
        if (verifyHintEl) verifyHintEl.style.display = 'none';
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('menuDropdown');
        const icon = document.getElementById('menuIcon');

        if (menuDropdownOpen && dropdown && icon) {
            if (!dropdown.contains(e.target) && !icon.contains(e.target)) {
                toggleMenuDropdown();
            }
        }
    });

    // Open memory modal — dossier archive
    function openMemory() {
        const modal = document.getElementById('memoryModal');
        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', escCloseMemory);

        if (menuDropdownOpen) {
            toggleMenuDropdown();
        }

        if (!userMemoryData) {
            loadMemoryData();
        } else {
            displayMemory(userMemoryData);
        }
    }

    function escCloseMemory(e) { if (e.key === 'Escape') closeMemory(); }

    // Close memory modal
    function closeMemory() {
        const modal = document.getElementById('memoryModal');
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        document.removeEventListener('keydown', escCloseMemory);
        setTimeout(() => {
            modal.style.display = 'none';
        }, 280);
    }

    async function handleClearMemory() {
        if (!confirm('Clear Retro’s memory? This keeps your chats but resets what it remembers about you.')) return;
        const el = document.getElementById('memoryText');
        const countEl = document.getElementById('memoryCount');
        const charsEl = document.getElementById('memoryChars');
        const catalogEl = document.getElementById('memoryCatalog');
        if (el) {
            el.innerHTML = '<p>No memories stored yet. Chat with Retro to build memories!</p>';
            el.classList.add('empty');
        }
        if (countEl) countEl.textContent = '0 entries';
        if (charsEl) charsEl.textContent = '';
        if (catalogEl) catalogEl.textContent = 'ARCHIVE — 000';
        userMemoryData = null;
        // Best-effort: if backend adds /api/v1/auth/clear-memory later, it will persist
        try {
            await fetch('/api/v1/auth/clear-memory', { method: 'POST', credentials: 'include' }).catch(()=>{});
        } catch {}
    }

    // Load memory data
    async function loadMemoryData() {
        try {
            const response = await fetch('/api/v1/auth/me', {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                userMemoryData = data.memory || null;
                displayMemory(userMemoryData);
            } else {
                displayMemory(null);
            }
        } catch (error) {
            console.error('Failed to load memory data:', error);
            displayMemory(null);
        }
    }

    // Display memory data — ledger meta
    function displayMemory(memory) {
        const memoryTextElement = document.getElementById('memoryText');
        const catalogEl = document.getElementById('memoryCatalog');
        const countEl = document.getElementById('memoryCount');
        const charsEl = document.getElementById('memoryChars');

        const isPopulated = memory && memory.trim() !== '';
        const chars = isPopulated ? memory.trim().length : 0;
        const words = isPopulated ? memory.trim().split(/\s+/).length : 0;

        if (catalogEl) {
            const code = isPopulated ? String(chars % 999).padStart(3, '0') : '000';
            catalogEl.textContent = `ARCHIVE — ${code}`;
        }
        if (countEl) countEl.textContent = isPopulated ? `${words} words` : '0 entries';
        if (charsEl) charsEl.textContent = isPopulated ? `${chars} chars` : '';

        if (isPopulated) {
            memoryTextElement.innerHTML = `<p>${escapeHtml(memory)}</p>`;
            memoryTextElement.classList.remove('empty');
        } else {
            memoryTextElement.innerHTML = '<p>No memories stored yet. Chat with Retro to build memories!</p>';
            memoryTextElement.classList.add('empty');
        }
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Close modals when clicking backdrop
    document.addEventListener('click', (e) => {
        const profileModal = document.getElementById('profileModal');
        const memoryModal = document.getElementById('memoryModal');

        if (profileModal && profileModal.classList.contains('active') && e.target === profileModal) {
            closeProfile();
        }

        if (memoryModal && memoryModal.classList.contains('active') && e.target === memoryModal) {
            closeMemory();
        }
    });

    // Load saved theme on page load
    function loadSavedTheme() {
        const savedTheme = localStorage.getItem('theme');

        if (savedTheme === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
        }

        updateThemeCheckmarks();
    }

    // Open upgrade page
    function openUpgrade() {
        window.location.href = '/upgrade';
    }

    // Fetch and display subscription tier — drives both menu + dossier
    async function loadSubscriptionTier() {
        try {
            const response = await fetch('/api/v1/subscription/status', {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                const tier = data.subscription?.tier || 'free';
                displayTierBadge(tier);
            } else {
                displayTierBadge('free');
            }
        } catch (error) {
            console.error('Failed to load subscription tier:', error);
            displayTierBadge('free');
        }
    }

    // Display tier badge in menu and dossier
    function displayTierBadge(tier) {
        const menuBadge = document.getElementById('menuTierBadge');
        const badgeText = document.getElementById('tierBadgeText');
        const upgradeMenuItem = document.getElementById('upgradeMenuItem');
        const profileTier = document.getElementById('profileTier');
        const profileTierIcon = document.getElementById('profileTierIcon');
        const profileTierDot = document.getElementById('profileTierDot');
        const profileTierStrip = document.getElementById('profileTierStrip');
        const stripIcon = document.getElementById('profileTierStripIcon');
        const stripTitle = document.getElementById('profileTierStripTitle');
        const stripSub = document.getElementById('profileTierStripSub');
        const stripAction = document.getElementById('profileTierAction');
        const stripActionText = document.getElementById('profileTierActionText');

        const tierNames = {
            free: 'Free Tier',
            pro: 'Pro Tier',
            premium: 'Premium Tier'
        };

        const tierIcons = {
            free: 'fa-user',
            pro: 'fa-star',
            premium: 'fa-crown'
        };

        const stripConfig = {
            free: { icon: 'fa-leaf', title: 'Free — Starter', sub: '25 notes · 100 cards · 20 chats/mo', action: 'Upgrade', showAction: true },
            pro: { icon: 'fa-bolt', title: 'Pro — Expanded study', sub: '500 notes · 2k cards · 300 chats/mo', action: 'Manage', showAction: true },
            premium: { icon: 'fa-crown', title: 'Premium — Unlimited', sub: 'Unlimited notes · cards · chats', action: 'Manage', showAction: true }
        };

        // Update menu badge
        if (menuBadge && badgeText) {
            menuBadge.className = `menu-tier-badge tier-${tier}`;
            badgeText.textContent = tierNames[tier] || 'Free Tier';
            const i = menuBadge.querySelector('i');
            if (i) i.className = `fas ${tierIcons[tier] || 'fa-user'}`;
        }

        // Show/hide upgrade menu item
        if (upgradeMenuItem) {
            upgradeMenuItem.style.display = tier === 'free' ? 'flex' : 'none';
        }

        // Update dossier tier
        if (profileTier) profileTier.textContent = tierNames[tier] || 'Free Tier';
        if (profileTierIcon) {
            profileTierIcon.className = `fas ${tierIcons[tier] || 'fa-user'} tier-icon tier-${tier}`;
        }
        if (profileTierDot) {
            profileTierDot.className = `avatar-tier-dot tier-${tier}`;
        }

        // Strip
        if (profileTierStrip) {
            profileTierStrip.className = `dossier-tier-strip tier-${tier}`;
        }
        const cfg = stripConfig[tier] || stripConfig.free;
        if (stripIcon) stripIcon.className = `fas ${cfg.icon}`;
        if (stripTitle) stripTitle.textContent = cfg.title;
        if (stripSub) stripSub.textContent = cfg.sub;
        if (stripActionText) stripActionText.textContent = cfg.action;
        if (stripAction) {
            stripAction.style.display = cfg.showAction ? 'inline-flex' : 'none';
            stripAction.onclick = tier === 'free' ? openUpgrade : () => window.location.href = '/upgrade';
        }
    }

    // Load profile data and theme on page load
    document.addEventListener('DOMContentLoaded', () => {
        loadUserProfile();
        loadSavedTheme();
        loadSubscriptionTier();
    });