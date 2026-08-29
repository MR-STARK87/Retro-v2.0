    const STORAGE_KEYS = {
      settings: "pz_settings_v1",
      stats: "pz_stats_v1",
      ambient: "pz_ambient_v1",
      state: "pz_state_v1",
      ui: "pz_ui_v1",
    };

    const todayStr = () => {
      const d = new Date();
      return d.toISOString().slice(0, 10);
    };

    // Simple beep using WebAudio
    function beep(freq = 880, duration = 120, volume = 0.04) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = freq;
        g.gain.value = volume;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        setTimeout(() => {
          o.stop();
          ctx.close();
        }, duration);
      } catch {}
    }

    async function ensureNotificationPermission() {
      if (!("Notification" in window)) return false;
      if (Notification.permission === "granted") return true;
      if (Notification.permission !== "denied") {
        try {
          const res = await Notification.requestPermission();
          return res === "granted";
        } catch {
          return false;
        }
      }
      return false;
    }

    function notify(title, body) {
      if (!("Notification" in window)) return;
      if (Notification.permission === "granted") {
        new Notification(title, { body });
      }
    }

    class PomodoroTimer {
      constructor() {
        this.isRunning = false;
        this.currentSession = "work";
        this.sessionCount = 0;
        this.completedSessions = 0;
        this.currentSessionNumber = 1;

        this.settings = {
          work: 25,
          break: 5,
          longBreak: 15,
          autoStart: false,
          sound: false,
          notifications: false,
        };

        this.timeLeft = this.settings.work * 60;
        this.totalTime = this.settings.work * 60;
        this.timer = null;
        this.endTimestamp = null;

        this.initializeElements();
        this.loadFromStorage();
        this.updateDisplay();
        this.attachEventListeners();
        this.attachKeyboardShortcuts();
        window.addEventListener("beforeunload", () => this.persistState());
      }

      initializeElements() {
        this.timerDisplay = document.getElementById("timerDisplay");
        this.startPauseBtn = document.getElementById("startPauseBtn");
        this.resetBtn = document.getElementById("resetBtn");
        this.skipBtn = document.getElementById("skipBtn");
        this.progressBar = document.getElementById("progressBar");
        this.progressText = document.getElementById("progressText");
        this.sessionType = document.getElementById("sessionType");
        this.completedSessionsEl = document.getElementById("completedSessions");
        this.currentSessionEl = document.getElementById("currentSession");
        this.workDurationEl = document.getElementById("workDuration");
        this.breakDurationEl = document.getElementById("breakDuration");
        this.longBreakDurationEl = document.getElementById("longBreakDuration");
        this.todaysSessionsEl = document.getElementById("todaysSessions");
        this.todaysTimeEl = document.getElementById("todaysTime");
        this.streakEl = document.getElementById("streak");
        this.autoStartToggle = document.getElementById("autoStartToggle");
        this.soundToggle = document.getElementById("soundToggle");
        this.notifToggle = document.getElementById("notifToggle");
        this.autoStartKnob = document.getElementById("autoStartKnob");
        this.soundKnob = document.getElementById("soundKnob");
        this.notifKnob = document.getElementById("notifKnob");
      }

      attachEventListeners() {
        this.startPauseBtn.addEventListener("click", () => this.toggleTimer());
        this.resetBtn.addEventListener("click", () => this.resetTimer());
        this.skipBtn.addEventListener("click", () => this.skipSession());

        this.autoStartToggle.addEventListener("change", () => {
          this.settings.autoStart = this.autoStartToggle.checked;
          this.updateToggleUI();
          this.persistSettings();
        });
        this.soundToggle.addEventListener("change", () => {
          this.settings.sound = this.soundToggle.checked;
          this.updateToggleUI();
          this.persistSettings();
          if (this.settings.sound) beep(880, 80);
        });
        this.notifToggle.addEventListener("change", async () => {
          this.settings.notifications = this.notifToggle.checked;
          if (this.settings.notifications) {
            const ok = await ensureNotificationPermission();
            if (!ok) {
              this.settings.notifications = false;
              this.notifToggle.checked = false;
            }
          }
          this.updateToggleUI();
          this.persistSettings();
        });
      }

      attachKeyboardShortcuts() {
        window.addEventListener("keydown", (e) => {
          const activeElement = document.activeElement;
          const tag = activeElement?.tagName?.toLowerCase();

          // Ignore shortcuts when typing in input fields, textareas, or contentEditable elements (like Quill editor)
          if (
            tag === "input" ||
            tag === "textarea" ||
            activeElement?.isContentEditable ||
            activeElement?.classList?.contains('ql-editor') ||
            activeElement?.closest('.ql-editor')
          ) return;

          if (e.code === "Space") {
            e.preventDefault();
            this.toggleTimer();
          } else if (e.key === "r" || e.key === "R") {
            e.preventDefault();
            this.resetTimer();
          } else if (e.key === "s" || e.key === "S") {
            e.preventDefault();
            this.skipSession();
          } else if (e.key === "a" || e.key === "A") {
            e.preventDefault();
            if (window.ambientMode) window.ambientMode.toggle();
          }
        });
      }

      loadFromStorage() {
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || "{}");
          Object.assign(this.settings, saved);
        } catch {}

        let stats = { date: todayStr(), sessions: 0, streak: 0 };
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.stats) || "{}");
          if (saved.date && saved.date !== todayStr()) {
            const prev = new Date(saved.date);
            const today = new Date(todayStr());
            const diffDays = Math.round((today - prev) / 86400000);
            if (diffDays === 1 && (saved.sessions || 0) > 0) {
              stats.streak = (saved.streak || 0) + 1;
            } else {
              stats.streak = 0;
            }
            stats.sessions = 0;
            stats.date = todayStr();
          } else if (saved.date === todayStr()) {
            stats = {
              date: saved.date,
              sessions: saved.sessions || 0,
              streak: saved.streak || 0,
            };
          }
        } catch {}
        this.completedSessions = stats.sessions || 0;
        this.streakEl.textContent = stats.streak || 0;
        this.todaysSessionsEl.textContent = this.completedSessions;

        try {
          const state = JSON.parse(localStorage.getItem(STORAGE_KEYS.state) || "{}");
          if (state && state.currentSession && Number.isInteger(state.timeLeft)) {
            this.currentSession = state.currentSession;
            this.timeLeft = Math.max(0, state.timeLeft);
            this.totalTime = Math.max(1, state.totalTime || this.timeLeft || 1);
            this.sessionCount = state.sessionCount || 0;
            this.currentSessionNumber = state.currentSessionNumber || 1;
          }
        } catch {}

        this.autoStartToggle.checked = !!this.settings.autoStart;
        this.soundToggle.checked = !!this.settings.sound;
        this.notifToggle.checked = !!this.settings.notifications;
        this.updateToggleUI();
      }

      persistSettings() {
        localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(this.settings));
      }

      persistStats() {
        const existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.stats) || "{}");
        const toSave = {
          date: todayStr(),
          sessions: this.completedSessions,
          streak: this.streakEl.textContent ? parseInt(this.streakEl.textContent) : existing.streak || 0,
        };
        localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(toSave));
      }

      persistState() {
        const state = {
          currentSession: this.currentSession,
          timeLeft: this.timeLeft,
          totalTime: this.totalTime,
          sessionCount: this.sessionCount,
          currentSessionNumber: this.currentSessionNumber,
        };
        localStorage.setItem(STORAGE_KEYS.state, JSON.stringify(state));
      }

      updateToggleUI() {
        const setToggle = (inputEl, knobEl) => {
          if (inputEl.checked) {
            knobEl.style.transform = "translateX(16px)";
            inputEl.nextElementSibling.classList.remove("bg-gray-300");
            inputEl.nextElementSibling.classList.add("bg-purple-600");
          } else {
            knobEl.style.transform = "translateX(0)";
            inputEl.nextElementSibling.classList.add("bg-gray-300");
            inputEl.nextElementSibling.classList.remove("bg-purple-600");
          }
        };
        setToggle(this.autoStartToggle, this.autoStartKnob);
        setToggle(this.soundToggle, this.soundKnob);
        setToggle(this.notifToggle, this.notifKnob);
      }

      setButtonState(kind) {
        this.startPauseBtn.classList.remove(
          "bg-black", "border-black", "hover:bg-transparent", "hover:border-black", "hover:text-black",
          "bg-purple-600", "border-purple-600", "hover:bg-purple-700", "hover:border-purple-700", "text-white"
        );
        if (kind === "start") {
          this.startPauseBtn.innerHTML = "<span>Start Focus</span>";
          this.startPauseBtn.classList.add("bg-black", "border-black", "hover:bg-transparent", "hover:border-black", "hover:text-black", "text-white");
        } else if (kind === "pause") {
          this.startPauseBtn.innerHTML = "<span>Pause</span>";
          this.startPauseBtn.classList.add("bg-purple-600", "border-purple-600", "hover:bg-purple-700", "hover:border-purple-700", "text-white");
        } else {
          this.startPauseBtn.innerHTML = "<span>Resume</span>";
          this.startPauseBtn.classList.add("bg-black", "border-black", "hover:bg-transparent", "hover:border-black", "hover:text-black", "text-white");
        }
      }

      toggleTimer() {
        if (this.isRunning) {
          this.pauseTimer();
        } else {
          this.startTimer();
        }
      }

      startTimer() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.setButtonState("pause");
        const now = Date.now();
        this.endTimestamp = now + this.timeLeft * 1000;

        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
          const remainingMs = this.endTimestamp - Date.now();
          const nextLeft = Math.max(0, Math.ceil(remainingMs / 1000));
          if (nextLeft !== this.timeLeft) {
            this.timeLeft = nextLeft;
            this.updateDisplay();
          } else {
            this.updateDisplay(true);
          }
          if (remainingMs <= 0) {
            this.completeSession();
          }
        }, 250);
      }

      pauseTimer() {
        if (!this.isRunning) return;
        this.isRunning = false;
        const remainingMs = (this.endTimestamp || Date.now()) - Date.now();
        this.timeLeft = Math.max(0, Math.ceil(remainingMs / 1000));
        clearInterval(this.timer);
        this.timer = null;
        this.setButtonState("resume");
        this.persistState();
      }

      resetTimer() {
        this.isRunning = false;
        clearInterval(this.timer);
        this.timer = null;
        this.endTimestamp = null;

        if (this.currentSession === "work") {
          this.timeLeft = this.settings.work * 60;
          this.totalTime = this.settings.work * 60;
        } else if (this.currentSession === "shortBreak") {
          this.timeLeft = this.settings.break * 60;
          this.totalTime = this.settings.break * 60;
        } else {
          this.timeLeft = this.settings.longBreak * 60;
          this.totalTime = this.settings.longBreak * 60;
        }

        this.setButtonState("start");
        this.updateDisplay();
        this.persistState();
      }

      skipSession() {
        this.completeSession(true);
      }

      maybeNotify(title, body) {
        if (this.settings.sound) {
          beep(1046, 80);
          setTimeout(() => beep(880, 80), 120);
          setTimeout(() => beep(659, 120), 260);
        }
        if (this.settings.notifications) {
          notify(title, body);
        }
      }

      completeSession(skipped = false) {
        this.isRunning = false;
        clearInterval(this.timer);
        this.timer = null;
        this.endTimestamp = null;

        let justCompletedWork = false;

        if (this.currentSession === "work") {
          justCompletedWork = true;
          this.completedSessions++;
          this.sessionCount++;

          if (this.sessionCount % 4 === 0) {
            this.currentSession = "longBreak";
            this.timeLeft = this.settings.longBreak * 60;
            this.totalTime = this.settings.longBreak * 60;
          } else {
            this.currentSession = "shortBreak";
            this.timeLeft = this.settings.break * 60;
            this.totalTime = this.settings.break * 60;
          }
        } else {
          this.currentSession = "work";
          this.timeLeft = this.settings.work * 60;
          this.totalTime = this.settings.work * 60;
          this.currentSessionNumber++;
        }

        if (!skipped) {
          if (justCompletedWork) {
            this.maybeNotify("Work complete", "Break started. Nice job!");
          } else {
            this.maybeNotify("Break over", "Back to focus.");
          }
        }

        this.setButtonState(this.settings.autoStart ? "pause" : "start");
        this.updateDisplay();
        this.updateStats();
        this.persistState();

        if (this.settings.autoStart) {
          this.startTimer();
        }
      }

      updateDisplay(smooth = false) {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        const label = this.currentSession === "work" ? "Focus" :
                      this.currentSession === "shortBreak" ? "Short Break" : "Long Break";

        this.timerDisplay.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
        document.title = `${this.timerDisplay.textContent} • ${label} – DEN`;

        const rawProgress = ((this.totalTime - this.timeLeft) / Math.max(1, this.totalTime)) * 100;
        this.progressBar.style.width = `${Math.min(100, Math.max(0, rawProgress))}%`;
        this.progressText.textContent = `${Math.round(rawProgress)}%`;

        if (this.isRunning || smooth) {
          // Announce progress; AmbientMode subscribes via den:timer-progress
          if (window.RetroEvents) {
            RetroEvents.emit(
              'den:timer-progress',
              Math.min(1, Math.max(0, (this.totalTime - this.timeLeft) / Math.max(1, this.totalTime)))
            );
          }
        }

        this.completedSessionsEl.textContent = this.completedSessions;
        this.currentSessionEl.textContent = this.currentSessionNumber;

        if (this.currentSession === "work") {
          this.sessionType.textContent = "Work Session • Stay Focused";
          this.progressBar.classList.remove("bg-purple-600");
          this.progressBar.classList.add("bg-black");
        } else if (this.currentSession === "shortBreak") {
          this.sessionType.textContent = "Short Break • Relax & Recharge";
          this.progressBar.classList.remove("bg-black");
          this.progressBar.classList.add("bg-purple-600");
        } else {
          this.sessionType.textContent = "Long Break • Take Your Time";
          this.progressBar.classList.remove("bg-black");
          this.progressBar.classList.add("bg-purple-600");
        }

        this.workDurationEl.textContent = this.settings.work;
        this.breakDurationEl.textContent = this.settings.break;
        this.longBreakDurationEl.textContent = this.settings.longBreak;
      }

      updateStats() {
        this.todaysSessionsEl.textContent = this.completedSessions;
        const focusTimeHours = Math.round(((this.completedSessions * this.settings.work) / 60) * 10) / 10;
        this.todaysTimeEl.textContent = `${focusTimeHours}h`;

        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.stats) || "{}");
          let streak = saved?.streak || 0;
          this.streakEl.textContent = streak;
        } catch {}
        this.persistStats();
      }
    }

    window.adjustTime = function(type, minutes) {
      if (window.pomodoroTimer.isRunning) return;

      if (type === "work") {
        window.pomodoroTimer.settings.work = Math.max(5, Math.min(120, window.pomodoroTimer.settings.work + minutes));
        if (window.pomodoroTimer.currentSession === "work") {
          window.pomodoroTimer.timeLeft = window.pomodoroTimer.settings.work * 60;
          window.pomodoroTimer.totalTime = window.pomodoroTimer.settings.work * 60;
        }
      } else if (type === "break") {
        window.pomodoroTimer.settings.break = Math.max(1, Math.min(60, window.pomodoroTimer.settings.break + minutes));
        if (window.pomodoroTimer.currentSession === "shortBreak") {
          window.pomodoroTimer.timeLeft = window.pomodoroTimer.settings.break * 60;
          window.pomodoroTimer.totalTime = window.pomodoroTimer.settings.break * 60;
        }
      } else if (type === "longBreak") {
        window.pomodoroTimer.settings.longBreak = Math.max(5, Math.min(120, window.pomodoroTimer.settings.longBreak + minutes));
        if (window.pomodoroTimer.currentSession === "longBreak") {
          window.pomodoroTimer.timeLeft = window.pomodoroTimer.settings.longBreak * 60;
          window.pomodoroTimer.totalTime = window.pomodoroTimer.settings.longBreak * 60;
        }
      }

      window.pomodoroTimer.persistSettings();
      window.pomodoroTimer.updateDisplay();
    };

    class AmbientMode {
      constructor() {

        this.isActive = false;
        this.vantaEffect = null;
        // Guards against stale async Vanta initialization completing after a
        // disable/re-enable race
        this.enableGeneration = 0;
        // True when ambient was suspended because the user left the DEN pane
        this.suspended = false;
        // Last pomodoro progress (0..1) received via den:timer-progress
        this.lastTimerProgress = 0;

        this.toggleBtn = document.getElementById("ambientToggle");

        if (this.toggleBtn) {
          // CRITICAL: Remove any inline styles and set initial data-visible state
          this.toggleBtn.removeAttribute('style');
          this.toggleBtn.setAttribute('data-visible', 'false'); // Will be set to true by navigation script when on DEN section
        } else {
          console.error('❌ CRITICAL: ambientToggle NOT FOUND in DOM during AmbientMode construction!');
        }

        this.vantaBg = document.getElementById("vanta-bg");
        this.colorPickerContainer = document.getElementById("colorPickerContainer");
        this.colorPickerToggle = document.getElementById("colorPickerToggle");
        this.colorOptions = document.getElementById("colorOptions");
        this.currentColorIndicator = document.getElementById("currentColorIndicator");


        // CRITICAL: Initialize color picker container with data-visible
        if (this.colorPickerContainer) {
          this.colorPickerContainer.removeAttribute('style');
          this.colorPickerContainer.setAttribute('data-visible', 'false');
        } else {
          console.error('❌ Color picker container NOT FOUND!');
        }

        this.currentSkyColor = 0x68c7ff;
        this.colorPickerOpen = false;
        this.isDynamicMode = false;

        this.dynamicColors = [
          { progress: 0, color: 0x87ceeb, name: "Dawn" },
          { progress: 0.25, color: 0x68c7ff, name: "Morning" },
          { progress: 0.5, color: 0xffd700, name: "Noon" },
          { progress: 0.75, color: 0xff6b47, name: "Sunset" },
          { progress: 1, color: 0x2c3e50, name: "Night" },
        ];

        this.initializeToggle();
        this.initializeColorPicker();
        this.loadAmbientPrefs();

        // Dynamic sky colors follow pomodoro progress via events (no direct
        // window.pomodoroTimer reach-in)
        if (window.RetroEvents) {
          RetroEvents.on('den:timer-progress', (progress) => {
            this.lastTimerProgress = progress;
            this.updateDynamicColor(progress);
          });
        }
      }

      initializeToggle() {
        if (!this.toggleBtn) {
          console.error('❌ Cannot initialize toggle - button is null!');
          return;
        }

        this.toggleBtn.addEventListener("click", () => {
          this.toggle();
        });

      }

      initializeColorPicker() {
        this.colorPickerToggle.addEventListener("click", (e) => {
          e.stopPropagation();
          this.toggleColorPicker();
        });

        document.querySelectorAll(".color-option").forEach((option) => {
          option.addEventListener("click", async () => {
            // Capture dataset values up front: e.currentTarget is null after any await
            const requiredTier = option.dataset.tier;
            const colorAttr = option.dataset.color;
            const name = option.dataset.name;

            // Check if this color requires a pro/premium tier
            if (requiredTier) {
              const currentTier = await this.checkUserTier();

              if (currentTier === 'free') {
                // Show upgrade prompt
                this.showUpgradePrompt();
                return;
              }
            }

            if (colorAttr === "dynamic") {
              this.changeColor("dynamic", name);
            } else {
              const color = parseInt(colorAttr);
              this.changeColor(color, name);
            }
            this.closeColorPicker();
          });
        });

        // Update lock icons based on user tier
        this.updateColorLockStatus();

        document.addEventListener("click", (e) => {
          if (!this.colorPickerContainer.contains(e.target)) {
            this.closeColorPicker();
          }
        });
      }

      toggleColorPicker() {
        const expanded = this.colorPickerToggle.getAttribute("aria-expanded") === "true";
        this.colorPickerToggle.setAttribute("aria-expanded", (!expanded).toString());
        if (this.colorPickerOpen) {
          this.closeColorPicker();
        } else {
          this.openColorPicker();
        }
      }

      openColorPicker() {
        this.colorPickerOpen = true;
        this.colorOptions.classList.remove("opacity-0", "pointer-events-none", "translate-y-[-10px]");
        this.colorOptions.classList.add("opacity-100", "pointer-events-auto", "translate-y-0");
      }

      closeColorPicker() {
        this.colorPickerOpen = false;
        this.colorOptions.classList.add("opacity-0", "pointer-events-none", "translate-y-[-10px]");
        this.colorOptions.classList.remove("opacity-100", "pointer-events-auto", "translate-y-0");
      }

      changeColor(color, colorName) {
        if (color === "dynamic") {
          this.isDynamicMode = true;
          this.persistAmbientPrefs();
          this.currentColorIndicator.className = "w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 via-yellow-400 to-purple-600";
          if (this.isActive && this.vantaEffect) {
            this.updateDynamicColor(this.lastTimerProgress);
          }
          return;
        } else {
          this.isDynamicMode = false;
          this.currentSkyColor = color;
          this.persistAmbientPrefs();
        }

        const colorMap = {
          0x68c7ff: "bg-blue-400",
          0xff6b6b: "bg-red-400",
          0x9b59b6: "bg-purple-400",
          0x2ecc71: "bg-green-400",
        };
        this.currentColorIndicator.className = `w-3 h-3 rounded-full ${colorMap[color] || "bg-blue-400"}`;

        if (this.isActive && this.vantaEffect) {
          this.vantaEffect.setOptions({ skyColor: color });
        }
      }

      updateDynamicColor(progress) {
        if (!this.isDynamicMode || !this.isActive || !this.vantaEffect) return;

        let targetColor = this.dynamicColors[0];

        for (let i = 0; i < this.dynamicColors.length - 1; i++) {
          const current = this.dynamicColors[i];
          const next = this.dynamicColors[i + 1];

          if (progress >= current.progress && progress <= next.progress) {
            const localProgress = (progress - current.progress) / (next.progress - current.progress);
            targetColor = this.interpolateColor(current, next, localProgress);
            break;
          }
        }

        this.vantaEffect.setOptions({ skyColor: targetColor.color });
      }

      interpolateColor(color1, color2, progress) {
        const r1 = (color1.color >> 16) & 255;
        const g1 = (color1.color >> 8) & 255;
        const b1 = color1.color & 255;

        const r2 = (color2.color >> 16) & 255;
        const g2 = (color2.color >> 8) & 255;
        const b2 = color2.color & 255;

        const r = Math.round(r1 + (r2 - r1) * progress);
        const g = Math.round(g1 + (g2 - g1) * progress);
        const b = Math.round(b1 + (b2 - b1) * progress);

        return {
          color: (r << 16) | (g << 8) | b,
          name: `${color1.name} to ${color2.name}`,
        };
      }

      toggle() {
        this.isActive = !this.isActive;

        if (this.isActive) {
          this.enableAmbientMode();
        } else {
          this.disableAmbientMode();
        }
        this.persistAmbientPrefs();
      }

      async enableAmbientMode() {
        this.toggleBtn.textContent = "Ambient: On";
        this.toggleBtn.setAttribute("aria-pressed", "true");
        this.toggleBtn.classList.add("text-white", "bg-purple-600", "border-purple-600");
        this.toggleBtn.classList.remove("text-gray-600", "bg-white/80", "border-gray-200");

        // Use data-visible attribute for color picker
        this.colorPickerContainer.setAttribute('data-visible', 'true');
        this.colorPickerContainer.removeAttribute('style');

        this.vantaBg.style.opacity = "1";

        // Add glass effect class to denScrollContent
        const denContent = document.getElementById('denScrollContent');
        if (denContent) {
          denContent.classList.add('ambient-glass-mode');
        }

        // Add class to body to trigger glassmorphism on nav elements
        document.body.classList.add('ambient-active');

        // Lazy-load three.js + vanta on first activation (cached afterwards)
        const gen = ++this.enableGeneration;
        try {
          await window.loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r121/three.min.js");
          await window.loadScript("https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.clouds.min.js");
        } catch (err) {
          console.error("Failed to load Vanta dependencies:", err);
          return;
        }

        // Ambient may have been toggled off (or re-toggled) while loading
        if (gen !== this.enableGeneration || !this.isActive || this.vantaEffect) return;

        if (typeof VANTA !== 'undefined' && VANTA.CLOUDS) {
          this.vantaEffect = VANTA.CLOUDS({
            el: "#vanta-bg",
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: window.innerHeight,
            minWidth: window.innerWidth,
            skyColor: this.isDynamicMode ? 0x68c7ff : this.currentSkyColor,
            cloudColor: 0xc0c0c0,
            cloudShadowColor: 0x183550,
            sunColor: 0xff6600,
            sunGlareColor: 0xff9919,
            sunlightColor: 0xff9933,
            speed: 0.8,
            cloudOpacity: 0.8,
          });

          if (this.isDynamicMode) {
            this.updateDynamicColor(this.lastTimerProgress);
          }
        }

        if (window.RetroEvents) {
          RetroEvents.emit('ambient:toggled', { active: true });
        }
      }

      disableAmbientMode() {
        // Invalidate any in-flight lazy-load from enableAmbientMode()
        this.enableGeneration++;
        this.toggleBtn.textContent = "Ambient: Off";
        this.toggleBtn.setAttribute("aria-pressed", "false");
        this.toggleBtn.classList.remove("text-white", "bg-purple-600", "border-purple-600");

        // Remove glass effect class from body
        document.body.classList.remove('ambient-active');
        this.toggleBtn.classList.add("text-gray-600", "bg-white/80", "border-gray-200");

        // Use data-visible attribute for color picker
        this.colorPickerContainer.setAttribute('data-visible', 'false');
        this.closeColorPicker();

        this.vantaBg.style.opacity = "0";

        // Remove glass effect class from denScrollContent
        const denContent = document.getElementById('denScrollContent');
        if (denContent) {
          denContent.classList.remove('ambient-glass-mode');
        }

        if (this.vantaEffect) {
          this.vantaEffect.destroy();
          this.vantaEffect = null;
        }

        if (window.RetroEvents) {
          RetroEvents.emit('ambient:toggled', { active: false });
        }
      }

      // Tear down the Vanta effect while the user is away from the DEN pane,
      // remembering to restore it when they return (see resume()).
      suspend() {
        if (!this.isActive || !this.vantaEffect) return;
        this.suspended = true;
        this.isActive = false;
        this.disableAmbientMode();
      }

      resume() {
        if (!this.suspended) return;
        this.suspended = false;
        this.isActive = true;
        this.enableAmbientMode();
      }

      loadAmbientPrefs() {
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.ambient) || "{}");
          if (saved) {
            if (typeof saved.currentSkyColor === "number") {
              this.currentSkyColor = saved.currentSkyColor;
            }
            this.isDynamicMode = !!saved.isDynamicMode;

            // Validate that saved color is allowed for current tier
            this.validateColorForTier();
            this.isActive = !!saved.isActive;

            if (this.isDynamicMode) {
              this.currentColorIndicator.className = "w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 via-yellow-400 to-purple-600";
            } else {
              const colorMap = {
                0x68c7ff: "bg-blue-400",
                0xff6b6b: "bg-red-400",
                0x9b59b6: "bg-purple-400",
                0x2ecc71: "bg-green-400",
              };
              this.currentColorIndicator.className = `w-3 h-3 rounded-full ${colorMap[this.currentSkyColor] || "bg-blue-400"}`;
            }

            if (this.isActive) {
              this.enableAmbientMode();
            } else {
              this.disableAmbientMode();
            }
          }
        } catch {}
      }

      persistAmbientPrefs() {
        const data = {
          currentSkyColor: this.currentSkyColor,
          isDynamicMode: this.isDynamicMode,
          isActive: this.isActive,
        };
        localStorage.setItem(STORAGE_KEYS.ambient, JSON.stringify(data));
      }

      async checkUserTier() {
        try {
          const response = await fetch('/api/v1/subscription/status', {
            method: 'GET',
            credentials: 'include'
          });

          if (response.ok) {
            const data = await response.json();
            return data.subscription?.tier || 'free';
          }
          return 'free';
        } catch (error) {
          console.error('Failed to check user tier:', error);
          return 'free';
        }
      }

      async updateColorLockStatus() {
        const tier = await this.checkUserTier();
        const proFeatures = document.querySelectorAll('.color-option.pro-feature');

        proFeatures.forEach(option => {
          const lockIcon = option.querySelector('.locked-icon');
          if (tier === 'free') {
            // Show lock icon and add disabled styling
            if (lockIcon) lockIcon.style.display = 'inline';
            option.style.opacity = '0.6';
            option.style.cursor = 'not-allowed';
          } else {
            // Hide lock icon and enable
            if (lockIcon) lockIcon.style.display = 'none';
            option.style.opacity = '1';
            option.style.cursor = 'pointer';
          }
        });
      }

      async validateColorForTier() {
        const tier = await this.checkUserTier();

        // If user is on free tier and has a premium color selected, reset to default
        if (tier === 'free') {
          const defaultColor = 0x68c7ff; // Sky Blue

          // Check if current color is not the default (free tier only gets default)
          if (this.currentSkyColor !== defaultColor || this.isDynamicMode) {
            this.currentSkyColor = defaultColor;
            this.isDynamicMode = false;
            this.persistAmbientPrefs();

            // Update indicator
            this.currentColorIndicator.className = 'w-3 h-3 rounded-full bg-blue-400';

            // Update Vanta if active
            if (this.isActive && this.vantaEffect) {
              this.vantaEffect.setOptions({ skyColor: defaultColor });
            }
          }
        }
      }

      showUpgradePrompt() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.3s ease;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
          background: white;
          padding: 2rem;
          border-radius: 1rem;
          max-width: 400px;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.3s ease;
        `;

        modal.innerHTML = `
          <div style="font-size: 3rem; margin-bottom: 1rem;">🔒</div>
          <h2 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem; color: #1f2937;">
            Unlock Ambient Colors
          </h2>
          <p style="color: #6b7280; margin-bottom: 1.5rem;">
            Access all ambient mode colors with Pro or Premium tier
          </p>
          <div style="display: flex; gap: 1rem; justify-content: center;">
            <button onclick="this.closest('div[style*=fixed]').remove()" style="
              padding: 0.75rem 1.5rem;
              border-radius: 0.5rem;
              border: 2px solid #e5e7eb;
              background: white;
              color: #6b7280;
              font-weight: 600;
              cursor: pointer;
            ">
              Maybe Later
            </button>
            <button onclick="window.location.href='/upgrade'" style="
              padding: 0.75rem 1.5rem;
              border-radius: 0.5rem;
              border: none;
              background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
              color: white;
              font-weight: 600;
              cursor: pointer;
            ">
              Upgrade Now
            </button>
          </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            overlay.remove();
          }
        });

        // Add animations
        const style = document.createElement('style');
        style.textContent = `
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `;
        document.head.appendChild(style);
      }
    }

    // Initialize on DOMContentLoaded or immediately if already loaded
    function initializeDEN() {
      window.pomodoroTimer = new PomodoroTimer();
      window.ambientMode = new AmbientMode();

      // Suspend the Vanta effect while away from the DEN pane (index 2),
      // restore it when the user returns.
      if (window.RetroEvents) {
        RetroEvents.on('section:change', ({ index }) => {
          if (!window.ambientMode) return;
          if (index !== 2) {
            window.ambientMode.suspend();
          } else {
            window.ambientMode.resume();
          }
        });
      }

      window.addEventListener("resize", () => {
        if (window.ambientMode && window.ambientMode.vantaEffect) {
          window.ambientMode.vantaEffect.resize();
        }
      });

      // UI state and menu
      const uiState = {
        compact: false,
        showSettings: true,
        showStats: true,
      };

      let hasSaved = false;
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.ui) || "{}");
        if (typeof saved.compact === "boolean") {
          uiState.compact = saved.compact;
          hasSaved = true;
        }
        if (typeof saved.showSettings === "boolean") {
          uiState.showSettings = saved.showSettings;
          hasSaved = true;
        }
        if (typeof saved.showStats === "boolean") {
          uiState.showStats = saved.showStats;
          hasSaved = true;
        }
      } catch {}

      if (!hasSaved) {
        if (window.innerHeight < 720) {
          uiState.compact = true;
          if (window.innerHeight < 640) {
            uiState.showSettings = true;
            uiState.showStats = false;
          }
        }
      }

      const settingsCard = document.getElementById("settingsCard");
      const statsCard = document.getElementById("statsCard");
      const moreBtn = document.getElementById("moreOptionsBtn");
      const menu = document.getElementById("moreOptionsMenu");
      const optCompact = document.getElementById("optToggleCompact");
      const optSettings = document.getElementById("optToggleSettings");
      const optStats = document.getElementById("optToggleStats");
      const optAmbient = document.getElementById("optToggleAmbient");
      const optOpenSky = document.getElementById("optOpenSky");
      const optResetToday = document.getElementById("optResetToday");
      const chkCompact = document.getElementById("chkCompact");
      const chkSettings = document.getElementById("chkSettings");
      const chkStats = document.getElementById("chkStats");
      const chkAmbient = document.getElementById("chkAmbient");

      function persistUI() {
        localStorage.setItem(STORAGE_KEYS.ui, JSON.stringify(uiState));
      }

      function applyUI() {
        document.body.classList.toggle("compact", uiState.compact);
        chkCompact.classList.toggle("hidden", !uiState.compact);

        settingsCard.style.display = uiState.showSettings ? "flex" : "none";
        chkSettings.classList.toggle("hidden", !uiState.showSettings);
        statsCard.style.display = uiState.showStats ? "flex" : "none";
        chkStats.classList.toggle("hidden", !uiState.showStats);

        chkAmbient.textContent = window.ambientMode?.isActive ? "On" : "Off";
      }

      applyUI();

      function openMenu() {
        menu.classList.remove("dropdown-enter");
        menu.classList.add("dropdown-open");
        moreBtn.setAttribute("aria-expanded", "true");
      }

      function closeMenu() {
        menu.classList.add("dropdown-enter");
        menu.classList.remove("dropdown-open");
        moreBtn.setAttribute("aria-expanded", "false");
      }

      moreBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = menu.classList.contains("dropdown-open");
        if (isOpen) closeMenu();
        else openMenu();
      });

      document.addEventListener("click", (e) => {
        if (!menu.contains(e.target) && e.target !== moreBtn) {
          closeMenu();
        }
      });

      optCompact.addEventListener("click", () => {
        uiState.compact = !uiState.compact;
        applyUI();
        persistUI();
      });

      optSettings.addEventListener("click", () => {
        uiState.showSettings = !uiState.showSettings;
        applyUI();
        persistUI();
      });

      optStats.addEventListener("click", () => {
        uiState.showStats = !uiState.showStats;
        applyUI();
        persistUI();
      });

      optAmbient.addEventListener("click", () => {
        window.ambientMode.toggle();
        applyUI();
        persistUI();
      });

      optOpenSky.addEventListener("click", () => {
        const toggle = document.getElementById("colorPickerToggle");
        if (toggle) toggle.click();
        closeMenu();
      });

      optResetToday.addEventListener("click", () => {
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.stats) || "{}");
          const newStats = {
            date: todayStr(),
            sessions: 0,
            streak: saved?.streak || 0,
          };
          localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(newStats));
          window.pomodoroTimer.completedSessions = 0;
          window.pomodoroTimer.updateStats();
        } catch {}
        closeMenu();
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeDEN);
    } else {
      initializeDEN();
    }

  // Music Player Functionality
  document.addEventListener('DOMContentLoaded', () => {
    const musicPlayerToggle = document.getElementById('musicPlayerToggle');
    const musicPlayerExpanded = document.getElementById('musicPlayerExpanded');
    const musicPlayerClose = document.getElementById('musicPlayerClose');
    const audioPlayer = document.getElementById('audioPlayer');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const loopBtn = document.getElementById('loopBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const volumeContainer = document.getElementById('volumeContainer');
    const volumeFill = document.getElementById('volumeFill');
    const volumeIcon = document.getElementById('volumeIcon');
    const currentTimeEl = document.getElementById('currentTime');
    const totalTimeEl = document.getElementById('totalTime');
    const currentTrackTitleEl = document.getElementById('currentTrackTitle');
    const playlistItemsEl = document.getElementById('playlistItems');
    const refreshPlaylistBtn = document.getElementById('refreshPlaylist');

    let playlist = [];
    let currentTrackIndex = -1;
    let loopEnabled = false;

    // Toggle to expanded view
    musicPlayerToggle.addEventListener('click', () => {
      musicPlayerToggle.style.display = 'none';
      musicPlayerExpanded.style.display = 'flex';
      if (playlist.length === 0) {
        loadPlaylist();
      }
    });

    // Toggle back to collapsed pill
    musicPlayerClose.addEventListener('click', () => {
      musicPlayerExpanded.style.display = 'none';
      musicPlayerToggle.style.display = 'flex';
    });

    // Load playlist from API
    async function loadPlaylist() {
      try {
        playlistItemsEl.innerHTML = '<div class="playlist-loading"><i class="fas fa-spinner fa-spin"></i> Loading music...</div>';

        const response = await fetch('/api/v1/music', {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to load playlist');
        }

        const result = await response.json();
        playlist = result.data || [];

        if (playlist.length === 0) {
          playlistItemsEl.innerHTML = `
            <div class="playlist-empty">
              <i class="fas fa-music"></i>
              <span>No music files found</span>
              <span style="font-size: 0.75rem; opacity: 0.7;">Add MP3 files to public/music folder</span>
            </div>
          `;
          return;
        }

        renderPlaylist();

        // Auto-load first track if none is playing
        if (currentTrackIndex === -1) {
          loadTrack(0);
        }

      } catch (error) {
        console.error('Error loading playlist:', error);
        playlistItemsEl.innerHTML = `
          <div class="playlist-empty">
            <i class="fas fa-exclamation-triangle"></i>
            <span>Failed to load playlist</span>
          </div>
        `;
      }
    }

    // Render playlist items
    function renderPlaylist() {
      playlistItemsEl.innerHTML = '';

      playlist.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'playlist-item';
        if (index === currentTrackIndex) {
          item.classList.add('active');
        }

        item.innerHTML = `
          <div class="playlist-item-icon">
            <i class="fas fa-${index === currentTrackIndex ? 'volume-up' : 'music'}"></i>
          </div>
          <div class="playlist-item-title">${escapeHtml(track.title)}</div>
        `;

        item.addEventListener('click', () => {
          loadTrack(index);
          audioPlayer.play();
        });

        playlistItemsEl.appendChild(item);
      });
    }

    // Load a track
    function loadTrack(index) {
      if (index < 0 || index >= playlist.length) return;

      currentTrackIndex = index;
      const track = playlist[index];

      audioPlayer.src = `/api/v1/music/stream/${encodeURIComponent(track.filename)}`;
      currentTrackTitleEl.textContent = track.title;

      renderPlaylist();
    }

    // Play/Pause button
    playPauseBtn.addEventListener('click', () => {
      if (audioPlayer.paused) {
        if (currentTrackIndex === -1 && playlist.length > 0) {
          loadTrack(0);
        }
        audioPlayer.play();
      } else {
        audioPlayer.pause();
      }
    });

    // Previous track
    prevBtn.addEventListener('click', () => {
      if (currentTrackIndex > 0) {
        loadTrack(currentTrackIndex - 1);
        audioPlayer.play();
      }
    });

    // Next track
    nextBtn.addEventListener('click', () => {
      if (currentTrackIndex < playlist.length - 1) {
        loadTrack(currentTrackIndex + 1);
        audioPlayer.play();
      } else if (playlist.length > 0) {
        // Loop back to first track
        loadTrack(0);
        audioPlayer.play();
      }
    });

    // Loop toggle — replay current track instead of advancing
    loopBtn.addEventListener('click', () => {
      loopEnabled = !loopEnabled;
      audioPlayer.loop = loopEnabled;
      loopBtn.classList.toggle('active', loopEnabled);
      loopBtn.setAttribute('aria-pressed', String(loopEnabled));
      loopBtn.title = loopEnabled ? 'Loop: ON' : 'Loop: OFF';
    });

    // Auto-play next track when current ends
    audioPlayer.addEventListener('ended', () => {
      if (loopEnabled) {
        audioPlayer.currentTime = 0;
        audioPlayer.play();
        return;
      }
      if (currentTrackIndex < playlist.length - 1) {
        loadTrack(currentTrackIndex + 1);
        audioPlayer.play();
      } else {
        // Loop back to first track
        loadTrack(0);
      }
    });

    // Update play/pause icon
    audioPlayer.addEventListener('play', () => {
      playPauseBtn.querySelector('i').className = 'fas fa-pause';
    });

    audioPlayer.addEventListener('pause', () => {
      playPauseBtn.querySelector('i').className = 'fas fa-play';
    });

    // Update progress bar
    audioPlayer.addEventListener('timeupdate', () => {
      if (audioPlayer.duration) {
        const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressFill.style.width = `${progress}%`;

        currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
        totalTimeEl.textContent = formatTime(audioPlayer.duration);
      }
    });

    // Add playing class for playhead/shimmer animation
    audioPlayer.addEventListener('play', () => {
      progressFill.classList.add('playing');
    });

    audioPlayer.addEventListener('pause', () => {
      progressFill.classList.remove('playing');
    });

    audioPlayer.addEventListener('ended', () => {
      progressFill.classList.remove('playing');
    });

    // Seek functionality
    progressContainer.addEventListener('click', (e) => {
      const rect = progressContainer.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      audioPlayer.currentTime = percent * audioPlayer.duration;
    });

    // Volume control
    let isDraggingVolume = false;

    volumeContainer.addEventListener('mousedown', (e) => {
      isDraggingVolume = true;
      updateVolume(e);
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (isDraggingVolume) {
        updateVolume(e);
      }
    });

    document.addEventListener('mouseup', () => {
      isDraggingVolume = false;
    });

    volumeContainer.addEventListener('click', (e) => {
      if (!isDraggingVolume) {
        updateVolume(e);
      }
    });

    // Touch support for mobile
    volumeContainer.addEventListener('touchstart', (e) => {
      isDraggingVolume = true;
      const touch = e.touches[0];
      updateVolume(touch);
      e.preventDefault();
    });

    volumeContainer.addEventListener('touchmove', (e) => {
      if (isDraggingVolume) {
        const touch = e.touches[0];
        updateVolume(touch);
      }
    });

    volumeContainer.addEventListener('touchend', () => {
      isDraggingVolume = false;
    });

    function updateVolume(e) {
      const rect = volumeContainer.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      audioPlayer.volume = percent;
      volumeFill.style.width = `${percent * 100}%`;

      // Update volume icon
      if (percent === 0) {
        volumeIcon.className = 'fas fa-volume-mute volume-icon';
      } else if (percent < 0.5) {
        volumeIcon.className = 'fas fa-volume-down volume-icon';
      } else {
        volumeIcon.className = 'fas fa-volume-up volume-icon';
      }
    }

    // Volume icon click to mute/unmute
    volumeIcon.addEventListener('click', () => {
      if (audioPlayer.volume > 0) {
        audioPlayer.dataset.previousVolume = audioPlayer.volume;
        audioPlayer.volume = 0;
        volumeFill.style.width = '0%';
        volumeIcon.className = 'fas fa-volume-mute volume-icon';
      } else {
        const previousVolume = parseFloat(audioPlayer.dataset.previousVolume) || 0.7;
        audioPlayer.volume = previousVolume;
        volumeFill.style.width = `${previousVolume * 100}%`;
        volumeIcon.className = 'fas fa-volume-up volume-icon';
      }
    });

    // Refresh playlist button
    refreshPlaylistBtn.addEventListener('click', () => {
      loadPlaylist();
    });

    // Helper function to format time
    function formatTime(seconds) {
      if (isNaN(seconds)) return '0:00';
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Helper function to escape HTML
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Set initial volume
    audioPlayer.volume = 0.7;
  });