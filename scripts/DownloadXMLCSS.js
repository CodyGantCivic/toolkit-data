// ==UserScript==
// @name         CP Toolkit - Remote DownloadXMLCSS Loader (Final)
// @namespace    http://civicplus.com/
// @version      2.0.0
// @description  Ctrl+RightClick → load DownloadXMLCSS.js from GitHub, insert UI buttons, and enable downloads.
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  const TOOLKIT = '[CP Toolkit Loader]';

  // ✔ Use your GitHub RAW URL directly
  const DOWNLOAD_XML_CSS_URL =
    "https://raw.githubusercontent.com/CodyGantCivic/toolkit-data/main/scripts/DownloadXMLCSS.js";

  /* ---------------------- CivicPlus Detector ---------------------- */
  async function isCivicPlusSite() {
    return new Promise((resolve) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open(
          "HEAD",
          "/Assets/Mystique/Shared/Components/ModuleTiles/Templates/cp-Module-Tile.html",
          true
        );
        xhr.timeout = 4000;
        xhr.onload = () => resolve(xhr.status === 200);
        xhr.onerror = () => resolve(false);
        xhr.ontimeout = () => resolve(false);
        xhr.send();
      } catch (e) {
        console.warn(TOOLKIT, "isCivicPlusSite error", e);
        resolve(false);
      }
    });
  }

  /* ---------------------- Remote Fetch ---------------------- */
  function fetchRemoteText(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: url + "?t=" + Date.now(), // cache-bust
        responseType: "text",
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) resolve(res.responseText);
          else reject(new Error("HTTP " + res.status));
        },
        onerror: reject,
        ontimeout: () => reject(new Error("timeout")),
      });
    });
  }

  /* ---------------------- Script Injector ---------------------- */
  function injectScript(text) {
    const s = document.createElement("script");
    s.type = "text/javascript";
    s.textContent = text;
    (document.documentElement || document.head || document.body).appendChild(s);
    s.remove();
  }

  /* ---------------------- Poll & Call Function ---------------------- */
  function waitFor(fnNames, timeout = 3000) {
    return new Promise((resolve) => {
      const start = Date.now();

      function check() {
        for (const name of fnNames) {
          const parts = name.split(".");
          let ctx = window;
          for (let p of parts) ctx = ctx?.[p];
          if (typeof ctx === "function") return resolve({ found: true, name });
        }
        if (Date.now() - start > timeout) return resolve({ found: false });
        setTimeout(check, 80);
      }
      check();
    });
  }

  /* ---------------------- Main Trigger ---------------------- */
  async function runLoader() {
    console.log(TOOLKIT, "Trigger received…");

    const isCP = await isCivicPlusSite();
    if (!isCP) {
      console.warn(TOOLKIT, "Not a CivicPlus site. Loader cancelled.");
      return;
    }

    console.log(TOOLKIT, "CivicPlus site detected. Fetching remote script…");

    try {
      const text = await fetchRemoteText(DOWNLOAD_XML_CSS_URL);
      injectScript(text);

      /* Wait for exported functions from DownloadXMLCSS.js */
      const fnInsert = await waitFor([
        "CPToolkit.insertDownloadButtons",
        "insertDownloadButtons",
      ]);

      if (fnInsert.found) {
        console.log(TOOLKIT, "Running →", fnInsert.name);
        const parts = fnInsert.name.split(".");
        let ctx = window;
        for (let p of parts) ctx = ctx[p];
        ctx(); // run insert buttons
      } else {
        console.warn(TOOLKIT, "No insertDownloadButtons() found.");
      }

      const fnDownload = await waitFor([
        "downloadxmlcss",
        "CPToolkit.downloadxmlcss",
      ]);

      if (fnDownload.found) {
        console.log(TOOLKIT, "Running →", fnDownload.name);
        const parts = fnDownload.name.split(".");
        let ctx = window;
        for (let p of parts) ctx = ctx[p];
        ctx({ autoConfirm: false });
      } else {
        console.warn(TOOLKIT, "No downloadxmlcss() found.");
      }
    } catch (err) {
      console.error(TOOLKIT, "Loader failed:", err);
    }
  }

  /* ---------------------- Ctrl + RightClick Listener ---------------------- */
  document.addEventListener(
    "contextmenu",
    function (e) {
      if (e.ctrlKey) {
        e.preventDefault();
        runLoader();
      }
    },
    true
  );

  /* ---------------------- Manual Menu Button ---------------------- */
  if (typeof GM_registerMenuCommand === "function") {
    GM_registerMenuCommand("Run DownloadXMLCSS Now", runLoader);
  }

  console.log(TOOLKIT, "Loader ready. Ctrl+RightClick to activate.");
})();
