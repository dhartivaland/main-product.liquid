(function () {

  /**
   * initShareButton
   * ───────────────
   * @param {HTMLElement} container   – the .share-button root element
   * @param {string}      [overrideUrl] – pass an explicit URL (used by QV so we
   *                                      share the product page, not the current URL)
   *
   * Exposed on window so the quick-view:loaded handler (below the IIFE) can call
   * it directly without duplicating logic.
   */
  function initShareButton(container, overrideUrl) {
    // Guard: skip if already wired up for this exact URL context.
    // We store the URL hash so a re-open with a different product forces a re-init.
    const urlKey = overrideUrl || 'page';
    if (container.dataset.shareInit === urlKey) return;
    container.dataset.shareInit = urlKey;

    const shareButton    = container.querySelector('.share-button__trigger');
    const detailsPanel   = container.querySelector('.share-button__details');
    const shareSummary   = container.querySelector('.share-button__summary'); // optional
    const closeButton    = container.querySelector('.share-button__close');
    const successMessage = container.querySelector('[id^="ShareMessage"]');
    const urlInput       = container.querySelector('input');

    if (!shareButton || !detailsPanel) return;

    // Resolve the URL to share:
    //   1. explicit override from QV  2. input value  3. current page
    let urlToShare = overrideUrl || (urlInput ? urlInput.value : window.location.href);

    // Keep the input in sync so copy-to-clipboard gets the right value too
    if (urlInput) urlInput.value = urlToShare;

    // ── Native Web Share API ──────────────────────────────────────────────────
    if (navigator.share) {
      // Show the single trigger button; hide/keep-hidden the details panel
      shareButton.classList.remove('hidden');
      detailsPanel.setAttribute('hidden', '');

      // Clone to remove any previous listener before re-adding
      const freshBtn = shareButton.cloneNode(true);
      shareButton.parentNode.replaceChild(freshBtn, shareButton);

      freshBtn.addEventListener('click', function () {
        navigator.share({
          url: urlToShare,
          title: document.title,
        }).catch(function () {
          // User dismissed — no-op
        });
      });

    // ── Fallback: copy-to-clipboard panel ────────────────────────────────────
    } else {

      // The trigger button doubles as a panel toggle when native share is absent.
      // (The liquid template has no separate .share-button__summary element.)
      shareButton.classList.remove('hidden');

      // Clone to wipe old listeners
      const freshBtn = shareButton.cloneNode(true);
      shareButton.parentNode.replaceChild(freshBtn, shareButton);

      freshBtn.addEventListener('click', function () {
        const isOpen = detailsPanel.classList.contains('is-open');
        isOpen ? closePanel() : openPanel();
      });

      // Optional summary element (theme variants that include it)
      if (shareSummary) {
        shareSummary.classList.remove('hidden');
        shareSummary.addEventListener('click', function () {
          const isOpen = detailsPanel.classList.contains('is-open');
          isOpen ? closePanel() : openPanel();
        });
      }

      if (closeButton) {
        closeButton.addEventListener('click', closePanel);
      }

      const copyBtn = container.querySelector('.share-button__copy');
      if (copyBtn) {
        // Clone to remove previous listeners
        const freshCopy = copyBtn.cloneNode(true);
        copyBtn.parentNode.replaceChild(freshCopy, copyBtn);
        freshCopy.addEventListener('click', copyToClipboard);
      }
    }

    // ── Panel helpers ─────────────────────────────────────────────────────────
    function openPanel() {
      detailsPanel.classList.add('is-open');
      detailsPanel.removeAttribute('hidden');
      const trigger = container.querySelector('.share-button__trigger');
      if (trigger) trigger.setAttribute('aria-expanded', 'true');
      if (shareSummary) shareSummary.setAttribute('aria-expanded', 'true');
    }

    function closePanel() {
      detailsPanel.classList.remove('is-open');
      detailsPanel.setAttribute('hidden', '');
      const trigger = container.querySelector('.share-button__trigger');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
      if (shareSummary) shareSummary.setAttribute('aria-expanded', 'false');

      if (successMessage) {
        successMessage.classList.add('hidden');
        successMessage.textContent = '';
      }
      if (closeButton) closeButton.classList.add('hidden');
      const focusTarget = shareSummary || container.querySelector('.share-button__trigger');
      if (focusTarget) focusTarget.focus();
    }

    function copyToClipboard() {
      if (!urlInput) return;
      navigator.clipboard.writeText(urlInput.value)
        .then(function () {
          if (successMessage) {
            successMessage.classList.remove('hidden');
            successMessage.textContent =
              (window.accessibilityStrings && window.accessibilityStrings.shareSuccess)
                ? window.accessibilityStrings.shareSuccess
                : 'Link copied!';
          }
          if (closeButton) {
            closeButton.classList.remove('hidden');
            closeButton.focus();
          }
        })
        .catch(function () {
          // Older browser fallback
          urlInput.select();
          document.execCommand('copy');
        });
    }

    // Public API: let Quick View update the URL after a variant change
    container.updateShareUrl = function (url) {
      urlToShare = url;
      if (urlInput) urlInput.value = url;
      container.dataset.shareInit = url; // allow re-init if URL changes again
    };
  }

  // ── Expose globally so quick-view:loaded handler can call it ────────────────
  window.initShareButton = initShareButton;

  // ── Init all share buttons on page load ─────────────────────────────────────
  function initAll() {
    document.querySelectorAll('.share-button').forEach(function (el) {
      initShareButton(el);
    });
  }

  // ── Watch for dynamically added share buttons (e.g. injected by apps) ───────
  function observeDOM() {
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.classList && node.classList.contains('share-button')) {
            initShareButton(node);
          }
          if (node.querySelectorAll) {
            node.querySelectorAll('.share-button').forEach(function (el) {
              initShareButton(el);
            });
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  initAll();
  observeDOM();

})();


/* ════════════════════════════════════════════════════════════════════════════
   QUICK VIEW — re-init share button with the correct product URL
   
   Runs after _reinitComponents dispatches 'quick-view:loaded'.
   window.initShareButton is now accessible because it was exposed above.
════════════════════════════════════════════════════════════════════════════ */
document.addEventListener('quick-view:loaded', function (e) {
  const wrapper = e.detail?.wrapper;
  if (!wrapper) return;

  // Derive a clean product URL for sharing (strip query params / variant param)
  const rawUrl    = wrapper.dataset.productUrl || window.location.href;
  const shareUrl  = rawUrl.split('?')[0].replace(/\/$/, '');

  wrapper.querySelectorAll('.share-button').forEach(function (el) {
    // Reset init guard so the button re-wires with the new product URL
    el.dataset.shareInit = 'none';
    window.initShareButton(el, shareUrl);
  });
});
