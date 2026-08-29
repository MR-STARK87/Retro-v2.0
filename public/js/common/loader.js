/**
 * Cached script loader for lazy-loading heavy CDN dependencies.
 * Each URL is fetched at most once; concurrent callers share the promise.
 */
(function () {
  "use strict";

  const cache = new Map();

  window.loadScript = function (src) {
    if (cache.has(src)) return cache.get(src);
    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === "true") return resolve();
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
        return;
      }
      const el = document.createElement("script");
      el.src = src;
      el.async = false; // preserve execution order between dependencies
      el.addEventListener("load", () => {
        el.dataset.loaded = "true";
        resolve();
      });
      el.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
      document.head.appendChild(el);
    });
    cache.set(src, promise);
    return promise;
  };
})();
