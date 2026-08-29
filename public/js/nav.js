// Horizontal Navigation System
// Owns: section switching, nav dots, page name, DEN-control visibility
// (data-visible attrs on #ambientToggle / #colorPickerContainer).
// Announces switches via RetroEvents "section:change"; ambient cleanup when
// leaving DEN is handled by den.js listening for that event.
(function () {
    'use strict';

    let currentSection = 0;
    const totalSections = 4;
    let isNavigating = false;
    let touchStartX = 0;
    let touchEndX = 0;
    const pageNames = ['Chat', 'Notes', 'Den', 'Cards'];
    const sectionClasses = ['show-chat', 'show-notes', 'show-den', 'show-flashcards'];

    function updateNavigation() {
        const container = document.getElementById('horizontalContainer');
        const dots = document.querySelectorAll('.nav-dot');

        if (!container) {
            console.error('Navigation container not found');
            return;
        }

        // Update container position
        container.className = 'horizontal-container ' + sectionClasses[currentSection];

        // DEN controls visibility (DOM the nav owns)
        const ambientToggle = document.getElementById('ambientToggle');
        const colorPickerContainer = document.getElementById('colorPickerContainer');

        if (ambientToggle) {
            ambientToggle.setAttribute('data-visible', currentSection === 2 ? 'true' : 'false');
        }
        if (colorPickerContainer) {
            const ambientActive = window.ambientMode && window.ambientMode.isActive;
            colorPickerContainer.setAttribute(
                'data-visible',
                currentSection === 2 && ambientActive ? 'true' : 'false'
            );
        }

        // Update navigation dots
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentSection);
        });

        // Update and show page name
        const pageNameEl = document.getElementById('navPageName');
        if (pageNameEl) {
            pageNameEl.textContent = pageNames[currentSection];
            pageNameEl.classList.add('visible');
            setTimeout(() => {
                pageNameEl.classList.remove('visible');
            }, 2000);
        }

        // Close read mode modal if open
        const readModal = document.getElementById('readModal');
        if (readModal && readModal.classList.contains('active')) {
            if (typeof window.closeReadMode === 'function') {
                window.closeReadMode();
            }
        }

        // Store current section
        sessionStorage.setItem('currentSection', currentSection);

        // Announce the switch (den.js uses this to clean up Vanta)
        if (window.RetroEvents) {
            RetroEvents.emit('section:change', {
                index: currentSection,
                name: pageNames[currentSection]
            });
        }
    }

    function goToSection(sectionIndex) {
        if (sectionIndex >= 0 && sectionIndex < totalSections && !isNavigating) {
            currentSection = sectionIndex;
            isNavigating = true;
            updateNavigation();

            // Release the navigation lock once the slide transition completes
            setTimeout(() => {
                isNavigating = false;
            }, 600);
        }
    }

    function navigateLeft() {
        if (currentSection > 0) {
            goToSection(currentSection - 1);
        }
    }

    function navigateRight() {
        if (currentSection < totalSections - 1) {
            goToSection(currentSection + 1);
        }
    }

    // Keyboard navigation handler
    function handleKeydown(e) {
        // Ignore keyboard navigation when user is typing in input fields or editors
        const activeElement = document.activeElement;
        const isTyping = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable ||
            activeElement.classList.contains('ql-editor') ||
            activeElement.closest('.ql-editor')
        );

        if (isTyping || isNavigating) {
            return;
        }

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            navigateLeft();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            navigateRight();
        }
    }

    // Touch/Swipe navigation
    function handleTouchStart(e) {
        touchStartX = e.changedTouches[0].screenX;
    }

    function handleTouchEnd(e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }

    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                navigateRight();
            } else {
                navigateLeft();
            }
        }
    }

    // Mouse wheel navigation
    let wheelTimeout;
    function handleWheel(e) {
        if (isNavigating) return;

        clearTimeout(wheelTimeout);
        wheelTimeout = setTimeout(() => {
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                if (e.deltaX > 0) {
                    navigateRight();
                } else {
                    navigateLeft();
                }
            }
        }, 50);
    }

    // Keep the color picker visibility in sync when ambient mode flips
    if (window.RetroEvents) {
        RetroEvents.on('ambient:toggled', function (detail) {
            const colorPickerContainer = document.getElementById('colorPickerContainer');
            if (colorPickerContainer) {
                colorPickerContainer.setAttribute(
                    'data-visible',
                    currentSection === 2 && detail.active ? 'true' : 'false'
                );
            }
        });
    }

    function initializeNavigation() {
        // Restore saved section
        currentSection = parseInt(sessionStorage.getItem('currentSection') || '0');
        updateNavigation();

        window.addEventListener('keydown', handleKeydown);
        window.addEventListener('touchstart', handleTouchStart);
        window.addEventListener('touchend', handleTouchEnd);
        window.addEventListener('wheel', handleWheel, { passive: true });

        // Nav dot clicks (no inline onclick attributes in markup)
        document.querySelectorAll('.nav-dot').forEach((dot) => {
            dot.addEventListener('click', () => {
                goToSection(parseInt(dot.dataset.section, 10));
            });
        });

        // Force focus to body to enable immediate keyboard navigation
        if (document.body) {
            document.body.setAttribute('tabindex', '-1');
            document.body.focus();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeNavigation);
    } else {
        initializeNavigation();
    }
})();
