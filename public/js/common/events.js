/**
 * Cross-pane event conventions for Retro's static scripts.
 *
 * Panes communicate through DOM CustomEvents on `document` instead of
 * reaching into each other's window.* globals:
 *
 *   section:change      { detail: { index, name } }   dispatched by nav.js
 *                       on every section switch (index: 0=chat 1=notes 2=den 3=cards)
 *
 *   ambient:toggled     { detail: { active } }         dispatched by den.js
 *                       whenever ambient mode turns on or off
 *
 *   den:timer-progress  { detail: { progress } }       dispatched by den.js
 *                       on each pomodoro tick; progress is 0..1 through the
 *                       current session (drives dynamic sky colors)
 *
 * Loaded (deferred) before the pane scripts; exposes window.RetroEvents.
 */
(function () {
  "use strict";

  window.RetroEvents = {
    emit: function (name, detail) {
      document.dispatchEvent(new CustomEvent(name, { detail: detail }));
    },
    on: function (name, handler) {
      document.addEventListener(name, function (e) {
        handler(e.detail);
      });
    },
  };
})();
