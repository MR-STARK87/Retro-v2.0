    console.log('🚀 Navigation script loaded!');

    // Wrap everything in IIFE to avoid global scope pollution
    (function() {
        'use strict';

        console.log('🔧 IIFE started');

        // Horizontal Navigation System
        let currentSection = 0;
        const totalSections = 4;
        let isNavigating = false;
        let touchStartX = 0;
        let touchEndX = 0;

        function updateNavigation() {
            console.log('📍 updateNavigation called - currentSection:', currentSection);

            const container = document.getElementById('horizontalContainer');
            const dots = document.querySelectorAll('.nav-dot');

            if (!container) {
                console.error('❌ Container not found!');
                return;
            }

            // Update container position
            if (currentSection === 0) {
                container.className = 'horizontal-container show-chat';
                console.log('📄 Showing CHAT section');
            } else if (currentSection === 1) {
                container.className = 'horizontal-container show-notes';
                console.log('📝 Showing NOTES section');
            } else if (currentSection === 2) {
                container.className = 'horizontal-container show-den';
                console.log('⏱️ Showing DEN section');
            } else {
                container.className = 'horizontal-container show-flashcards';
                console.log('🃏 Showing FLASHCARDS section');
            }

            // Cleanup Vanta effect when leaving DEN section
            try {
                if (currentSection !== 2 && window.ambientMode && typeof window.ambientMode.deactivate === 'function' && window.ambientMode.vantaEffect) {
                    console.log('🌌 Deactivating Vanta effect (leaving DEN)');
                    window.ambientMode.deactivate();
                }
            } catch (error) {
                console.warn('⚠️ Error deactivating ambient mode:', error);
            }

            // Hide/Show DEN controls based on current section
            // Using data attributes instead of inline styles for better CSS control
            try {
                const ambientToggle = document.getElementById('ambientToggle');
                const colorPickerContainer = document.getElementById('colorPickerContainer');

                console.log('🔍 Ambient toggle element:', ambientToggle);
                console.log('🎨 Color picker container:', colorPickerContainer);

                if (ambientToggle) {
                    if (currentSection === 2) {
                        console.log('✅ ON DEN SECTION - SHOWING AMBIENT TOGGLE');

                        // Use data attribute instead of inline styles
                        ambientToggle.setAttribute('data-visible', 'true');
                        ambientToggle.removeAttribute('style'); // Remove any inline styles that might conflict

                        // Log computed styles for debugging
                        setTimeout(() => {
                            const computedStyles = window.getComputedStyle(ambientToggle);
                            console.log('🎯 Ambient Toggle Computed Styles:');
                            console.log('   - display:', computedStyles.display);
                            console.log('   - visibility:', computedStyles.visibility);
                            console.log('   - opacity:', computedStyles.opacity);
                            console.log('   - position:', computedStyles.position);
                            console.log('   - top:', computedStyles.top);
                            console.log('   - right:', computedStyles.right);
                            console.log('   - z-index:', computedStyles.zIndex);
                            console.log('   - pointer-events:', computedStyles.pointerEvents);

                            // Check if element is in viewport
                            const rect = ambientToggle.getBoundingClientRect();
                            console.log('📏 Ambient Toggle Position:');
                            console.log('   - top:', rect.top, 'left:', rect.left);
                            console.log('   - width:', rect.width, 'height:', rect.height);
                            console.log('   - in viewport:', rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth);
                        }, 50);

                    } else {
                        console.log('❌ NOT on DEN section - hiding ambient toggle');
                        ambientToggle.setAttribute('data-visible', 'false');
                    }
                } else {
                    console.error('❌ CRITICAL: ambientToggle element NOT FOUND in DOM!');
                    console.log('🔍 Attempting to find it with querySelector...');
                    const toggle = document.querySelector('#ambientToggle');
                    console.log('   querySelector result:', toggle);

                    if (!toggle) {
                        console.log('🔍 Checking all buttons with "ambient" in id:');
                        const allButtons = document.querySelectorAll('button[id*="ambient"], button[id*="Ambient"]');
                        console.log('   Found buttons:', allButtons);
                    }
                }

                if (colorPickerContainer) {
                    if (currentSection === 2 && window.ambientMode && window.ambientMode.isActive) {
                        console.log('🎨 Showing color picker');
                        // Use data-visible attribute instead of inline styles
                        colorPickerContainer.setAttribute('data-visible', 'true');
                        colorPickerContainer.removeAttribute('style');
                    } else {
                        console.log('🎨 Hiding color picker');
                        // Use data-visible attribute instead of inline styles
                        colorPickerContainer.setAttribute('data-visible', 'false');
                    }
                } else {
                    console.warn('⚠️ colorPickerContainer not found');
                }
            } catch (error) {
                console.error('❌ Error managing DEN controls visibility:', error);
                console.error('   Stack:', error.stack);
            }

            // Update navigation dots
            // Update dots
            dots.forEach((dot, index) => {
                if (index === currentSection) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });

            // Update and show page name
            const pageNames = ['Chat', 'Notes', 'Den', 'Cards'];
            const pageNameEl = document.getElementById('navPageName');
            if (pageNameEl) {
                pageNameEl.textContent = pageNames[currentSection];
                pageNameEl.classList.add('visible');

                // Hide after 2 seconds
                setTimeout(() => {
                    pageNameEl.classList.remove('visible');
                }, 2000);
            }

            // Close read mode modal if open
            const readModal = document.getElementById('readModal');
            if (readModal && readModal.classList.contains('active')) {
                const closeReadMode = window.closeReadMode;
                if (typeof closeReadMode === 'function') {
                    closeReadMode();
                }
            }

            // Store current section
            sessionStorage.setItem('currentSection', currentSection);
        }

        function goToSection(sectionIndex) {
            console.log('🎯 goToSection called with index:', sectionIndex);
            if (sectionIndex >= 0 && sectionIndex < totalSections && !isNavigating) {
                currentSection = sectionIndex;
                isNavigating = true;
                updateNavigation();

                // Extra check after animation completes
                setTimeout(() => {
                    isNavigating = false;

                    // Double-check ambient toggle visibility after navigation completes
                    if (sectionIndex === 2) {
                        console.log('🔄 Post-navigation check for DEN section');
                        const ambientToggle = document.getElementById('ambientToggle');
                        if (ambientToggle) {
                            console.log('🔄 Ensuring ambient toggle is visible...');
                            ambientToggle.setAttribute('data-visible', 'true');
                            ambientToggle.removeAttribute('style'); // Remove any conflicting inline styles

                            setTimeout(() => {
                                const computedDisplay = window.getComputedStyle(ambientToggle).display;
                                console.log('🔄 Post-check display:', computedDisplay);
                            }, 100);
                        } else {
                            console.error('🔄 ❌ Still cannot find ambient toggle after navigation!');
                        }
                    }
                }, 600); // Match transition duration
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
            console.log('🔑 Key pressed:', e.key, '| isNavigating:', isNavigating, '| Target:', e.target.tagName);

            // Ignore keyboard navigation when user is typing in input fields or editors
            const activeElement = document.activeElement;
            const isTyping = activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.isContentEditable ||
                activeElement.classList.contains('ql-editor') ||
                activeElement.closest('.ql-editor')
            );

            if (isTyping) {
                console.log('⌨️ User is typing in an input field, ignoring navigation');
                return;
            }

            if (isNavigating) {
                console.log('⏸️ Navigation in progress, ignoring key press');
                return;
            }

            if (e.key === 'ArrowLeft') {
                console.log('⬅️ Arrow Left detected - navigating left');
                e.preventDefault();
                navigateLeft();
            } else if (e.key === 'ArrowRight') {
                console.log('➡️ Arrow Right detected - navigating right');
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
                    // Swiped left - go to next section
                    navigateRight();
                } else {
                    // Swiped right - go to previous section
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
                    // Horizontal scroll detected
                    if (e.deltaX > 0) {
                        navigateRight();
                    } else {
                        navigateLeft();
                    }
                }
            }, 50);
        }

        // Function to ensure DEN controls are visible when on DEN section
        function ensureDENControlsVisible() {
            if (currentSection === 2) {
                console.log('🔍 ensureDENControlsVisible - forcing ambient toggle to show');
                const ambientToggle = document.getElementById('ambientToggle');
                if (ambientToggle) {
                    ambientToggle.setAttribute('data-visible', 'true');
                    ambientToggle.removeAttribute('style'); // Remove any inline styles
                    console.log('✅ Ambient toggle data-visible set to true');

                    // Verify it worked
                    setTimeout(() => {
                        const computedStyles = window.getComputedStyle(ambientToggle);
                        console.log('✅ Verified display:', computedStyles.display, 'opacity:', computedStyles.opacity);
                    }, 50);
                } else {
                    console.error('❌ Cannot find ambient toggle element');
                }
            }
        }

        // Initialize all event listeners and navigation
        function initializeNavigation() {
            console.log('*** NAVIGATION INITIALIZING ***');

            // Restore saved section
            const savedSection = parseInt(sessionStorage.getItem('currentSection') || '0');
            currentSection = savedSection;
            console.log('📂 Restored section from sessionStorage:', currentSection);

            updateNavigation();

            // Add all event listeners
            window.addEventListener('keydown', handleKeydown);
            window.addEventListener('touchstart', handleTouchStart);
            window.addEventListener('touchend', handleTouchEnd);
            window.addEventListener('wheel', handleWheel, { passive: true });

            // Force focus to body to enable immediate keyboard navigation
            if (document.body) {
                document.body.setAttribute('tabindex', '-1');
                document.body.focus();
                console.log('✅ Focus set to body - keyboard events should now work immediately!');
            }

            console.log('*** KEYBOARD NAVIGATION READY - Arrow keys should work now! ***');
            console.log('📋 Event listener attached to window. Try pressing arrow keys...');

            // Extra check for DEN controls after short delay to ensure DOM is fully ready
            setTimeout(() => {
                console.log('⏰ Running delayed DEN controls check...');
                ensureDENControlsVisible();
            }, 100);
        }

        // Make goToSection globally accessible for onclick handlers
        window.goToSection = goToSection;

        // Initialize immediately if DOM is ready, otherwise wait
        console.log('📄 Document readyState:', document.readyState);
        if (document.readyState === 'loading') {
            console.log('⏳ Waiting for DOMContentLoaded...');
            document.addEventListener('DOMContentLoaded', initializeNavigation);
        } else {
            console.log('✅ DOM already ready, initializing immediately...');
            initializeNavigation();
        }

        // Also initialize on window load as a fallback
        window.addEventListener('load', () => {
            console.log('🪟 Window load event fired');

            // Restore saved section again in case it changed
            const savedSection = parseInt(sessionStorage.getItem('currentSection') || '0');
            if (savedSection !== currentSection) {
                console.log('🔄 Section changed during load, updating:', savedSection);
                currentSection = savedSection;
                updateNavigation();
            }

            // Ensure focus is set again on window load
            if (document.body) {
                document.body.focus();
                console.log('🔄 Focus re-applied on window load');
            }

            // Final check for DEN controls
            setTimeout(() => {
                console.log('⏰ Final DEN controls visibility check on window load...');
                ensureDENControlsVisible();
            }, 200);
        });

        // Expose function globally for manual debugging
        window.debugAmbientToggle = function() {
            console.log('🐛 MANUAL DEBUG - Current Section:', currentSection);
            const toggle = document.getElementById('ambientToggle');
            console.log('🐛 Toggle element:', toggle);
            if (toggle) {
                const styles = window.getComputedStyle(toggle);
                console.log('🐛 Computed styles:', {
                    display: styles.display,
                    visibility: styles.visibility,
                    opacity: styles.opacity,
                    position: styles.position,
                    top: styles.top,
                    right: styles.right,
                    zIndex: styles.zIndex
                });
                const rect = toggle.getBoundingClientRect();
                console.log('🐛 Position:', rect);
            }
        };

        // Expose function to force show toggle
        window.forceShowAmbientToggle = function() {
            console.log('🔧 FORCE SHOWING AMBIENT TOGGLE');
            const toggle = document.getElementById('ambientToggle');
            if (toggle) {
                toggle.setAttribute('data-visible', 'true');
                toggle.removeAttribute('style');
                console.log('✅ Force show applied via data-visible');

                setTimeout(() => {
                    const styles = window.getComputedStyle(toggle);
                    console.log('🔧 After force:', {
                        display: styles.display,
                        visibility: styles.visibility,
                        opacity: styles.opacity
                    });
                }, 50);
            } else {
                console.error('❌ Cannot find toggle to force show');
            }
        };

    })();