(function () {
    'use strict';

    const TOOLKIT_NAME = '[CP Toolkit - Open In New Tab]';

    // Idempotency guard
    if (window.AllowOpenInNewTab && window.AllowOpenInNewTab.__loaded) return;

    window.AllowOpenInNewTab = {
        __loaded: false,

        init: async function () {
            if (window.AllowOpenInNewTab.__loaded) return;
            window.AllowOpenInNewTab.__loaded = true;

            // Only run on admin pages
            const path = window.location.pathname.toLowerCase();
            if (!path.startsWith('/admin') && !path.startsWith('/admin/')) return;

            // Prefer loader's CivicPlus check if present
            if (window.CPToolkit && typeof window.CPToolkit.isCivicPlusSite === 'function') {
                try {
                    const ok = await window.CPToolkit.isCivicPlusSite();
                    if (!ok) return;
                } catch (e) {
                    // continue if check fails
                }
            }

            // waitFor helper
            function waitFor(testFn, timeout = 4000, interval = 100) {
                const start = Date.now();
                return new Promise(resolve => {
                    const check = () => {
                        try {
                            if (testFn()) return resolve(true);
                        } catch (e) { /* ignore */ }
                        if (Date.now() - start >= timeout) return resolve(false);
                        setTimeout(check, interval);
                    };
                    check();
                });
            }

            const hasJQ = await waitFor(() => !!window.jQuery, 4000);
            if (!hasJQ) return; // can't operate safely without jQuery

            const $ = window.jQuery;

            try {
                $(document).ready(function () {
                    const moduleReferrer = window.location.pathname.toLowerCase().replace('/admin/', '');

                    // Replace divs with onclicks inside classicItems with equivalent clickable links
                    $('.classicItems div[onclick]').each(function () {
                        try {
                            // create a copy and convert onclick to href wrapper if possible
                            // safer approach: wrap the div contents with an <a> that has the onclick encoded as toolkitRunfn
                            const onclick = this.getAttribute('onclick') || '';
                            if (!onclick) return;
                            const wrapper = document.createElement('a');
                            wrapper.setAttribute('href', '/Admin/Classic.aspx?fromURL=' + encodeURIComponent(moduleReferrer) + '&toolkitRunfn=' + encodeURIComponent(onclick));
                            // move children into anchor
                            while (this.firstChild) wrapper.appendChild(this.firstChild);
                            this.parentNode.replaceChild(wrapper, this);
                        } catch (e) { /* ignore individual item failures */ }
                    });

                    // Convert anchor tags that only have onclicks into usable hrefs so they open in new tabs
                    $('a[onclick]').each(function () {
                        try {
                            const $a = $(this);
                            const onclick = ($a.attr('onclick') || '').trim();
                            const href = ($a.attr('href') || '').trim();

                            if (!onclick) return;

                            const onclickFunction = onclick.split('(')[0].trim();

                            // Common onclick handlers we handle by creating a "proxy" href that encodes the onclick action
                            const handlersToProxy = [
                                'categoryDetails','displayItemList','CallAlertCategoryDetail','ModifyArchiveMaster',
                                'BidCategoryModifyDelete','CategoryModifyDelete','ModifyBlogCategory','FAQTopicModifyDelete',
                                'NotifyMeListAction','PollCategoryModifyDelete','editPhoto','goToSellerProperties',
                                'CRMCategoryModifyDelete','dirDetail'
                            ];

                            if (handlersToProxy.indexOf(onclickFunction) !== -1) {
                                if (!href || href === '#') {
                                    const newHref = '/Admin/Classic.aspx?fromURL=' + encodeURIComponent(moduleReferrer) + '&toolkitRunfn=' + encodeURIComponent(onclick);
                                    $a.attr('href', newHref);
                                }
                                return;
                            }

                            // For linkDetails we attempt to create a clickable URL that reconstructs the submit behavior.
                            if (onclickFunction === 'linkDetails') {
                                if (!href || href === '') {
                                    // Build a simplified handler that will be passed in the querystring for the new-tab restoration logic.
                                    // We cannot reliably extract form variable names in all contexts, so create a safe proxy that triggers original onclick when loaded.
                                    const proxyFn = onclick; // use the original onclick as the payload
                                    const newHref = '/Admin/Classic.aspx?fromURL=' + encodeURIComponent(moduleReferrer) + '&toolkitRunfn=' + encodeURIComponent(proxyFn);
                                    $a.attr('href', newHref);
                                }
                                return;
                            }

                            // For other known handlers that we don't implement, leave as-is but don't overwrite existing hrefs
                        } catch (e) {
                            // ignore
                        }
                    });

                    // If page opened in a new tab with toolkitRunfn in referrer -> run it to restore state
                    try {
                        if (document.referrer && document.referrer.indexOf('toolkitRunfn') !== -1) {
                            // parse referrer query param
                            const match = document.referrer.match(/[?&]toolkitRunfn=([^&]+)/);
                            if (match && match[1]) {
                                const encodedFn = match[1];
                                const fnToRun = decodeURIComponent(encodedFn);
                                // Execute in page context by injecting a script element
                                const s = document.createElement('script');
                                s.textContent = `(function(){ try{ ${fnToRun.replace(/return\s+false;?/,'')} }catch(e){ console.warn('${TOOLKIT_NAME} restore failed', e); } })();`;
                                document.body.appendChild(s);
                                // minimal log
                                console.log(TOOLKIT_NAME, 'Restored click action from new-tab referrer.');
                            }
                        }
                    } catch (e) {
                        // ignore
                    }
                });
            } catch (err) {
                console.warn(TOOLKIT_NAME, 'Error:', err);
            }
        },

        stop: function () {
            // nothing persisted that needs explicit teardown currently
        }
    };

    // Auto-run
    window.AllowOpenInNewTab.init();

})();
