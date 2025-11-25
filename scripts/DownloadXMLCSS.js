/**
 * DownloadXMLCSS.js (REMOTE SCRIPT)
 * ---------------------------------------------------------
 * This file is designed to be fetched and injected by a loader script.
 * It DOES auto-run when injected — just like a normal userscript would.
 * It does NOT rely on GM_addStyle (not available in page context).
 * It inserts XML/CSS download buttons on CivicPlus Layout Manager pages.
 */

(function () {
    'use strict';

    const TOOLKIT_NAME = '[CP Toolkit - Download XML/CSS]';

    // Detect if we're on a CivicPlus site
    async function isCivicPlusSite() {
        return new Promise((resolve) => {
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('HEAD', '/Assets/Mystique/Shared/Components/ModuleTiles/Templates/cp-Module-Tile.html', true);
                xhr.onload = () => resolve(xhr.status === 200);
                xhr.onerror = () => resolve(false);
                xhr.send();
            } catch (e) {
                resolve(false);
            }
        });
    }

    // Check if on the Layouts page
    function isLayoutsPage() {
        const path = window.location.pathname.toLowerCase();
        return path.includes('/admin/designcenter/layouts');
    }

    // Insert CSS normally (GM_addStyle does NOT exist here)
    function injectCSS() {
        const css = `
            .downloadXML, .downloadCSS {
                line-height: 33px;
                font-size: .75rem;
                font-weight: 400 !important;
                position: absolute;
                top: 4px;
                cursor: pointer;
            }
            .downloadXML { right: 221px; }
            .downloadCSS { right: 120px; }
            .downloadXML .fa, .downloadCSS .fa { color: #4f8ec0; margin-right:6px; }
            .listing .item { padding-right: 330px; }
            .listing .item>.status { right: 330px; }
            .listing .item h3 { width: calc(100% - 54px); }
        `;
        const s = document.createElement("style");
