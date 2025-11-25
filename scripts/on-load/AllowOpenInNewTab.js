// AllowOpenInNewTab.js
// Version: 1.0.1
// Exports: window.AllowOpenInNewTab.init()
// Purpose: Convert fragile onclick-only links on admin pages into hrefs that can be opened in new tabs,
// and restore click behavior when the new tab rehydrates state from a referrer containing toolkitRunfn.

(function () {
  'use strict';

  const TOOLKIT_NAME = '[CP Toolkit - Open In New Tab]';

  // Idempotency guard & namespace
  if (window.AllowOpenInNewTab && window.AllowOpenInNewTab.__loaded) return;

  window.AllowOpenInNewTab = window.AllowOpenInNewTab || {
    __loaded: false,
    /**
     * init() - idempotent initializer. Waits for jQuery, verifies it's an admin page,
     * and performs link transformations + restore-on-new-tab logic.
     */
    init: async function init() {
      if (window.AllowOpenInNewTab.__loaded) return;
      window.AllowOpenInNewTab.__loaded = true;

      // Only run on admin pages
      try {
        const path = window.location.pathname.toLowerCase();
        if (!path.startsWith('/admin') && !path.startsWith('/admin/')) return;
      } catch (e) {
        // cannot determine path -> abort to be safe
        return;
      }

      // If a loader exposes a CivicPlus detection hook, prefer it
      if (window.CPToolkit && typeof window.CPToolkit.isCivicPlusSite === 'function') {
        try {
          const ok = await window.CPToolkit.isCivicPlusSite();
          if (!ok) return;
        } catch (e) {
          // proceed anyway if detection throws
        }
      }

      // tiny waitFor helper for page globals
      function waitFor(testFn, timeout = 4000, interval = 100) {
        const start = Date.now();
        return new Promise((resolve) => {
          (function check() {
            try {
              if (testFn()) return resolve(true);
            } catch (ex) {
              // ignore test errors
            }
            if (Date.now() - start >= timeout) return resolve(false);
            setTimeout(check, interval);
          })();
        });
      }

      const hasJQ = await waitFor(() => !!window.jQuery, 4000);
      if (!hasJQ) return; // need jQuery to operate safely
      const $ = window.jQuery;

      try {
        $(document).ready(function () {
          try {
            const moduleReferrer = window.location.pathname.toLowerCase().replace('/admin/', '');

            // Convert classicItems div[onclick] -> anchor href that encodes the onclick in toolkitRunfn
            $('.classicItems div[onclick]').each(function () {
              try {
                const onclick = this.getAttribute('onclick') || '';
                if (!onclick) return;
                const wrapper = document.createElement('a');
                wrapper.setAttribute(
                  'href',
                  '/Admin/Classic.aspx?fromURL=' + encodeURIComponent(moduleReferrer) + '&toolkitRunfn=' + encodeURIComponent(onclick)
                );
                // move children into anchor
                while (this.firstChild) wrapper.appendChild(this.firstChild);
                this.parentNode.replaceChild(wrapper, this);
              } catch (err) {
                // ignore element-level errors
              }
            });

            // Convert anchor tags that rely only on onclick -> proxy hrefs for supported handlers
            $('a[onclick]').each(function () {
              try {
                const $a = $(this);
                const onclick = ($a.attr('onclick') || '').trim();
                const href = ($a.attr('href') || '').trim();
                if (!onclick) return;

                const onclickFunction = onclick.split('(')[0].trim();

                // handlers we proxy by encoding the onclick into the new-tab URL
                const handlersToProxy = [
                  'categoryDetails', 'displayItemList', 'CallAlertCategoryDetail', 'ModifyArchiveMaster',
                  'BidCategoryModifyDelete', 'CategoryModifyDelete', 'ModifyBlogCategory', 'FAQTopicModifyDelete',
                  'NotifyMeListAction', 'PollCategoryModifyDelete', 'editPhoto', 'goToSellerProperties',
                  'CRMCategoryModifyDelete', 'dirDetail'
                ];

                if (handlersToProxy.indexOf(onclickFunction) !== -1) {
                  if (!href || href === '#') {
                    const newHref =
                      '/Admin/Classic.aspx?fromURL=' + encodeURIComponent(moduleReferrer) + '&toolkitRunfn=' + encodeURIComponent(onclick);
                    $a.attr('href', newHref);
                  }
                  return;
                }

                // Special-case: linkDetails -> encode the original onclick as payload
                if (onclickFunction === 'linkDetails') {
                  if (!href || href === '') {
                    const proxyFn = onclick;
                    const newHref =
                      '/Admin/Classic.aspx?fromURL=' + encodeURIComponent(moduleReferrer) + '&toolkitRunfn=' + encodeURIComponent(proxyFn);
                    $a.attr('href', newHref);
                  }
                  return;
                }

                // Otherwise leave href as-is
              } catch (err) {
                // ignore element-level errors
              }
            });

            // If this page was opened in a new tab and the referrer encoded a toolkitRunfn, execute it to restore state.
            try {
              if (document.referrer && document.referrer.indexOf('toolkitRunfn') !== -1) {
                const match = document.referrer.match(/[?&]toolkitRunfn=([^&]+)/);
                if (match && match[1]) {
                  const encodedFn = match[1];
                  const fnToRun = decodeURIComponent(encodedFn);
                  // Execute in page context by injecting a script element (keeps execution in page context)
                  const s = document.createElement('script');
                  // remove trailing "return false" if present to avoid stopping navigation
                  const sanitized = fnToRun.replace(/return\s+false;?/gi, '');
                  s.textContent = `(function(){ try{ ${sanitized} }catch(e){ console.error('${TOOLKIT_NAME} restore failed', e); } })();`;
                  (document.body || document.documentElement).appendChild(s);
                  // do not log successful restore to adhere to minimal logging rules
                }
              }
            } catch (err) {
              // swallow to avoid noisy failures
            }
          } catch (e) {
            // Critical error during DOM ready processing -> surface as console.error
            console.error(TOOLKIT_NAME + ' initialization error:', e);
          }
        });
      } catch (err) {
        console.error(TOOLKIT_NAME + ' failed to initialize:', err);
      }
    },

    stop: function () {
      // nothing to clean up for now
    }
  };

  // Auto-run, but allow loader to call init() as well — init is idempotent.
  try {
    // Defer to DOM ready via the exported init implementation (it does its own wait).
    window.AllowOpenInNewTab.init();
  } catch (e) {
    console.error(TOOLKIT_NAME + ' auto-run failed:', e);
  }
})();
