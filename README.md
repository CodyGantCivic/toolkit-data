CivicPlus Toolkit Data

Welcome to toolkit‑data – the master repository for the CivicPlus Toolkit. The Toolkit is a collection of helper scripts, UI assets and configuration files that enhance the CivicPlus admin experience. Everything you see here is used by the CivicPlus Toolkit userscript
 to provide one‑click features, bulk operations and quality‑of‑life improvements for administrators.

This repository acts as the single source of truth for the toolkit: new helpers and assets must be added here and referenced via raw GitHub URLs. The loader userscript then fetches them at runtime. If you are developing or extending the Toolkit, use this repository as your starting point.

📂 Repository structure

This repository is organised into a handful of top‑level directories:

Folder	Purpose
css/	Core stylesheets and third‑party assets (Bootstrap, FontAwesome) for helper UI components.
data/	JSON data consumed by helpers. This includes module definitions (modules.json), text replacement maps and manifest files (on-load-tools.json, on-demand-tools.json) describing available helpers.
images/	Logos and icons displayed in the manager UI. These files are fetched by the loader at runtime.
scripts/	Home of the loader and all helper modules. It contains two subfolders: scripts/on‑load/ for helpers that run automatically and scripts/on demand/ for tools that execute only when the user clicks a Run button.
specs/	The authoritative Master Specification (CivicPlus_Toolkit_Upgraded_Master_Specification.pdf). This document defines the core goals of the project and the rules every helper must follow (idempotent guards, minimal logging, remote asset loading, etc.).

Each helper is a standalone script that declares itself on the global window object and exports an asynchronous init() function. Helpers never call each other directly; the loader manages when and where they run.

Two index files help you navigate the repository:

index.json is a machine‑readable manifest listing every file. The loader reads this file to verify that referenced files exist.

INDEX.md (this repository) provides a human‑friendly tree view of the folder structure for quick browsing.

🧰 Installing the userscript

To take advantage of the Toolkit, you need to install the loader as a Tampermonkey userscript. Follow these steps:

Install the Tampermonkey extension
 for your browser (Chrome, Firefox or Edge). Tampermonkey manages user scripts and provides a sandbox for them to run.

In the Tampermonkey dashboard, create a new script and copy the contents of scripts/tampermonkey script (found in this repository). Save the script.

Navigate to a CivicPlus admin page (e.g. /admin/designcenter/layouts). The loader performs a one‑time CivicPlus detection and caches the result on window.CPToolkit.isCivicPlusSiteResult. This cached value is re‑used by helpers so they don’t repeat the network call. After detecting the site, the loader consults its registry of helpers and injects any that match the current page’s path.

Look for the small circular CivicPlus icon (the CP button) near the top‑right of the page. Clicking this button opens the Toolkit Manager. The manager UI is divided into two sections:

On‑demand tools appear at the top. These are one‑off helpers stored in scripts/on demand/ that run only when you click Run. Use them for tasks such as copying a full layout or generating a report.

On‑load scripts live below the on‑demand section inside a collapsible panel. Click the caret next to “On‑load Scripts” to expand or collapse the list. Each helper is listed with a checkbox that toggles whether it runs automatically when its page pattern matches. Your choices are persisted via localStorage.

If an on‑demand tool isn’t listed, make sure it has been added to scripts/on demand/ and registered in the on‑demand registry in scripts/tampermonkey script.

🎛️ Toolkit Manager UI

The Toolkit Manager is the primary way to interact with the helpers. When you click the CP button, a panel slides out from the right. It contains two sections:

On‑demand Tools: these tools live in scripts/on demand/ and are only executed when you explicitly click the Run button next to them. They are ideal for bulk operations or infrequently used features that shouldn’t run on every page load.

On‑load Scripts: this section lists every helper in scripts/on‑load/. The list is collapsed by default to keep the interface tidy. Click the caret next to the section heading to expand it. Each entry has a checkbox that enables or disables that helper on its matching pages. This preference is stored in localStorage, so your settings persist across sessions.

Both sections are dynamically generated from the registry objects in the loader script. To add a new on‑demand tool or on‑load helper to the UI, simply create the file in the appropriate folder and add an entry to the corresponding registry in scripts/tampermonkey script. The loader will automatically fetch and display it.

How helpers work
On‑load helpers

On‑load helpers are scripts that run automatically based on the current URL. The loader’s registry associates each helper with one or more page patterns (e.g. /admin/designcenter/layouts*). When you visit a matching page, the loader fetches the helper via its raw GitHub URL, injects it, and calls its init() function. To ensure helpers run only once per page, each sets an idempotent guard (window.HelperName.__loaded = true). Helpers should:

Load any required CSS/JS from a CDN or raw GitHub (FontAwesome, Bootstrap, etc.).

Perform minimal work in init() – use MutationObserver instead of polling, and cache data on window.CPToolkit or in localStorage.

Avoid console.log; use console.warn sparingly for unexpected situations.

On‑demand helpers

On‑demand helpers live in scripts/on demand/. They only run when the user explicitly clicks Run in the Toolkit Manager. The loader fetches the helper, injects it into the page, and calls its init() method. Unlike on‑load helpers, on‑demand scripts are not bound to a page pattern; you decide when to run them. They are ideal for one‑time actions (e.g. copying a full layout, generating a report) that don’t need to run on every page load.

🧑‍💻 Developing new helpers

We welcome contributions! To add a new helper or dataset, follow these steps:

Decide whether it’s on‑load or on‑demand. If your helper should run automatically on certain pages, create it in scripts/on‑load/. If it’s a utility to run on user command, put it in scripts/on demand/.

Structure your helper. Attach your helper to the window object (e.g. window.MyHelper = { init: async function() { … } }). Immediately check for a loaded flag (if (MyHelper.__loaded) return; MyHelper.__loaded = true;). Only after this guard should you do your work.

Use standard web APIs. Never rely on chrome.* extension APIs. Use fetch(), localStorage, MutationObserver, etc. For remote assets, reference the raw GitHub URL or a CDN. Place any configuration JSON in data/ and fetch it.

Be lean. Avoid expensive polling – use a MutationObserver to wait for elements to appear. Cache network results in window.CPToolkit so other helpers can reuse them. Keep logging to a minimum; use console.warn only for unexpected errors.

Register your helper. Update the appropriate registry in scripts/tampermonkey script:

For an on‑load helper, provide an id, name, url (raw GitHub URL) and an array of page patterns.

For an on‑demand helper, provide an id, name, and url. On‑demand helpers don’t need page patterns.

Refresh the indexes. Add your new file to index.json under the correct directory. Regenerate INDEX.md (see below) to include it. Keep lists alphabetically sorted.

Refer to the Master Specification (specs/CivicPlus_Toolkit_Upgraded_Master_Specification.pdf) for additional guidelines on script behaviour, naming conventions and styling.

📄 License

All content in this repository is subject to the licensing terms defined by CivicPlus for the Toolkit project. See the accompanying licence file for details.

Happy coding and thank you for improving the CivicPlus Toolkit! If you have questions or ideas, feel free to open an issue or submit a pull request.
