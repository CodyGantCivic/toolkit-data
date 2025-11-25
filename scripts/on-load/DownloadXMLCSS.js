// DownloadXMLCSS.js
// CivicPlus - Download XML/CSS (remote, injector-friendly)
// Exposes window.insertDownloadButtons() and window.downloadxmlcss()
// Auto-runs when on /admin/designcenter/layouts and on a CivicPlus site.

(function(global) {
    'use strict';

    const TOOLKIT_NAME = '[CP Toolkit - Download XML/CSS]';

    function pageMatches(patterns) {
        const url = window.location.href.toLowerCase();
        const pathname = window.location.pathname.toLowerCase();
        return patterns.some(pattern => {
            const regex = new RegExp(pattern.replace(/\*/d, '.*'), 'i');
            return regex.test(url) || regex.test(pathname);
        });
    }

    async function isCivicPlusSite() {
        try {
            const resp = await fetch('/Assets/Mystique/Shared/Components/ModuleTiles/Templates/cp-Module-Tile.html', { method: 'HEAD' });
            return resp && resp.status === 200;
        } catch (e) {
            return false;
        }
    }

    function ensureFontAwesome() {
        return new Promise(resolve => {
            try {
                if (document.querySelector('.fa, .fas, .far, .fal, .fab')) {
                    resolve();
                    return;
                }
                if (document.getElementById('cp-toolkit-fontawesome')) {
                    setTimeout(resolve, 200);
                    return;
                }
                const link = document.createElement('link');
                link.id = 'cp-toolkit-fontawesome';
                link.rel = 'stylesheet';
                link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
                link.onload = resolve;
                link.onerror = resolve;
                document.head.appendChild(link);
            } catch (e) { resolve(); }
        });
    }

    function addStyles(cssText) {
        try {
            if (document.getElementById('cp-toolkit-downloadxmlcss-styles')) return;
            const s = document.createElement('style');
            s.id = 'cp-toolkit-downloadxmlcss-styles';
            s.textContent = cssText;
            (document.head || document.documentElement).appendChild(s);
        } catch (e) {}
    }

    async function insertDownloadButtons(options) {
        options = options || {};

        try {
            if (window.__cp_downloadxmlcss_initialized) {
                return;
            }

            if (typeof window.jQuery === 'undefined') {
                await new Promise(resolve => {
                    let t = 0;
                    const h = setInterval(() => {
                        if (window.jQuery || t > 3000) {
                            clearInterval(h);
                            resolve();
                        }
                        t += 200;
                    }, 200);
                });
            }
            if (typeof window.jQuery === 'undefined') {
                console.warn(TOOLKIT_NAME + ' jQuery not found; aborting');
                return;
            }

            const $ = window.jQuery;

            await ensureFontAwesome();

            addStyles(`
                .downloadXML, .downloadCSS {
                    line-height: 33px;
                    font-size: .75rem;
                    font-weight: 400 !important;
                    position: absolute;
                    top: 4px;
                    z-index: 5;
                }
                .downloadXML { right: 221px; }
                .downloadCSS { right: 120px; }
                .downloadXML .fa, .downloadCSS .fa { color: #4f8ec0; margin-right:6px; }
                .listing .item { padding-right: 330px; }
                .listing .item>.status { right: 330px; }
                .listing .item h3 { width: calc(100% - 54px); }
                .downloadXML, .downloadCSS { white-space: nowrap; overflow: visible; }
            `);

            const layouts = $(".listing .items .item");
            const currentSite = document.location.host.replace(/[:\/]+/g, '-');

            function downloadItem(title, url) {
                try {
                    const a = document.createElement('a');
                    a.href = /^(https?:)?\/\//i.test(url)
                        ? url
                        : window.location.origin.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
                    a.download = title;
                    a.click();
                } catch (e) {
                    window.open(url, '_blank');
                }
            }

            layouts.each(function () {
                const $this = $(this);
                if ($this.data('cp-dl-added')) return;
                $this.data('cp-dl-added', true);

                const thisLayout = $this.find("h3 a").text().trim();
                if (!thisLayout) return;

                const downloadXML = $("<a href='#' class='button downloadXML'><i class='fa fa-download'></i><span>XML</span></a>");
                downloadXML.on('click', function(e) {
                    e.preventDefault();
                    const url = "/App_Themes/" + encodeURIComponent(thisLayout) + "/" + encodeURIComponent(thisLayout) + ".xml";
                    downloadItem(currentSite + "-" + thisLayout + ".xml", url);
                });

                const thisLayoutPage =
                    $this.find("a:contains('Layout Page'), a:contains('View Layout Page')").attr("href") ||
                    $this.find("h3 a").attr("href");

                const downloadCSS = $("<a href='#' class='button downloadCSS'><i class='fa fa-download'></i><span>CSS</span></a>");
                downloadCSS.on('click', function(e) {
                    e.preventDefault();
                    if (!thisLayoutPage) return;

                    const xhr = new XMLHttpRequest();
                    xhr.onreadystatechange = function() {
                        if (xhr.readyState === 4 && xhr.status === 200) {
                            const redirectedURL = xhr.responseURL;
                            $.get(redirectedURL + "?bundle=off", function(data) {
                                const cssMatch = data.match(/\/App_Themes\/[^"]*Layout[^"]*/);
                                if (cssMatch) {
                                    downloadItem(currentSite + "-" + thisLayout + ".css", cssMatch[0]);
                                }
                            }, "text");
                        }
                    };
                    xhr.open("GET", thisLayoutPage, true);
                    xhr.send();
                });

                $this.append(downloadXML, downloadCSS);
            });

            const $sidebarButtons = $(".contentContainer .sidebar .buttons");
            if ($sidebarButtons.length && !$sidebarButtons.find('.cp-download-all').length) {
                const allBtn = $("<li class='cp-download-all'><a class='button bigButton nextAction' href='#'><span>Download All CSS and XML</span></a></li>");
                allBtn.on('click', function(e) {
                    e.preventDefault();
                    $(".downloadXML, .downloadCSS").each(function () {
                        $(this).trigger('click');
                    });
                });
                $sidebarButtons.append(allBtn);
            }

            window.__cp_downloadxmlcss_initialized = true;
        } catch (err) {
            console.warn(TOOLKIT_NAME + ' Error:', err);
        }
    }

    // Provide global exports
    global.insertDownloadButtons = insertDownloadButtons;
    global.downloadxmlcss = insertDownloadButtons;

    // Auto-run only on CivicPlus + layouts root
    (async function autoRun() {
        try {
            if (!pageMatches(['/admin/designcenter/layouts'])) return;
            if (!(await isCivicPlusSite())) return;
            setTimeout(() => {
                try { insertDownloadButtons(); } catch (e) {}
            }, 300);
        } catch (e) {}
    })();

})(window);

