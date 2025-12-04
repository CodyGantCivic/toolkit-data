// CivicPlus Toolkit - Multiple Item Upload Helper (Optimised)
// This helper allows admins to save a single CivicAlert item to multiple
// categories.  It has been refactored to remove jQuery, minimise
// repeated polling, and use native DOM APIs with MutationObservers.
// Categories are collected from the categories list page and stored in
// localStorage.  When creating a new alert, a category selector is
// displayed and the item is posted to each selected category using
// Fetch API requests.  It respects the CivicPlus Toolkit guidelines:
// idempotent initialisation, detection of CivicPlus sites, and no
// reliance on Chrome extension APIs.

(function () {
  'use strict';

  // Prevent multiple initialisations
  if (window.MultipleItemUpload && window.MultipleItemUpload.__loaded) {
    return;
  }

  window.MultipleItemUpload = {
    __loaded: false,
    init: async function () {
      if (window.MultipleItemUpload.__loaded) return;
      window.MultipleItemUpload.__loaded = true;
      try {
        // CivicPlus detection if available
        if (window.CPToolkit && typeof window.CPToolkit.isCivicPlusSite === 'function') {
          try {
            const isCP = await window.CPToolkit.isCivicPlusSite();
            if (!isCP) return;
          } catch (_) {
            // ignore detection errors
          }
        }

        // Only run on the CivicAlerts admin page
        const path = (window.location.pathname || '').toLowerCase();
        if (path !== '/admin/civicalerts.aspx') return;

        /**
         * Wait for a DOM element matching the selector.  Resolves with the element
         * or null after timeout milliseconds.  Uses MutationObserver for
         * efficient detection.
         * @param {string} selector
         * @param {number} timeout
         */
        function waitForElement(selector, timeout = 8000) {
          return new Promise(resolve => {
            const el = document.querySelector(selector);
            if (el) return resolve(el);
            const observer = new MutationObserver(() => {
              const elem = document.querySelector(selector);
              if (elem) {
                observer.disconnect();
                resolve(elem);
              }
            });
            observer.observe(document.documentElement, {
              childList: true,
              subtree: true
            });
            setTimeout(() => {
              observer.disconnect();
              resolve(null);
            }, timeout);
          });
        }

        /**
         * Save categories from the categories list page into localStorage.  It
         * scans anchors within the `.adminthin` class and extracts category
         * IDs from their onclick attributes.  If categories are found they
         * are stored under the key 'cpToolkitAlertCategories'.
         */
        function saveCategoriesList() {
          const links = document.querySelectorAll('.adminthin a');
          const categories = [];
          links.forEach(link => {
            const onClick = link.getAttribute('onclick');
            if (!onClick) return;
            if (!onClick.includes("callPage('CivicAlertItemList")) return;
            // Extract category ID: callPage('CivicAlertItemList',6376,29) => 6376
            const match = onClick.match(/CivicAlertItemList',\s*(\d+)/);
            const categoryID = match ? match[1] : '';
            const categoryName = (link.innerText || link.textContent || '').trim();
            if (categoryID && categoryName) categories.push({ categoryName, categoryID });
          });
          if (categories.length) {
            try {
              localStorage.setItem('cpToolkitAlertCategories', JSON.stringify(categories));
            } catch (e) {
              // ignore storage errors
            }
          }
        }

        /**
         * Build the multiple category selection UI on the item creation page.
         * Reads categories from localStorage, constructs a checkbox list and
         * inserts a "Save to Multiple Categories" button.  When clicked, it
         * gathers form data and posts the item to each selected category.
         */
        function buildItemUploadUI() {
          // Only run if Save and Publish button exists
          const saveBtn = document.querySelector("input[value*='Save and Publish']");
          if (!saveBtn) return;
          // Prevent multiple injections
          if (document.getElementById('cp-miu-button')) return;

          // Retrieve categories from localStorage
          let categories = [];
          try {
            const raw = localStorage.getItem('cpToolkitAlertCategories');
            if (raw) categories = JSON.parse(raw);
          } catch (e) {
            categories = [];
          }
          if (!Array.isArray(categories) || !categories.length) return;

          // Create container for category checkboxes
          const catContainer = document.createElement('div');
          catContainer.className = 'cp-miu-categories';
          catContainer.style.marginTop = '10px';
          catContainer.innerHTML = '<label><strong>Select Categories</strong> (CP Toolkit):</label>';
          const list = document.createElement('ul');
          list.style.listStyle = 'none';
          list.style.margin = '0';
          list.style.padding = '0';
          list.id = 'cp-miu-cat-list';
          categories.forEach(cat => {
            const li = document.createElement('li');
            li.style.marginBottom = '4px';
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.value = cat.categoryID;
            input.style.marginRight = '6px';
            label.appendChild(input);
            label.appendChild(document.createTextNode(cat.categoryName));
            li.appendChild(label);
            list.appendChild(li);
          });
          catContainer.appendChild(list);

          // Create the action button
          const multiBtn = document.createElement('input');
          multiBtn.type = 'button';
          multiBtn.className = 'cp-button';
          multiBtn.id = 'cp-miu-button';
          multiBtn.value = 'Save to Multiple Categories';
          multiBtn.style.marginLeft = '5px';

          // Insert the UI after Save button
          saveBtn.insertAdjacentElement('afterend', multiBtn);
          // Insert categories list after an element with id 'advanced' if present, else after Save
          const advanced = document.getElementById('advanced');
          if (advanced) {
            advanced.insertAdjacentElement('afterend', catContainer);
          } else {
            saveBtn.insertAdjacentElement('afterend', catContainer);
          }

          // Overlay helpers to indicate progress
          function showOverlay() {
            let overlay = document.getElementById('miu-overlay');
            if (!overlay) {
              overlay = document.createElement('div');
              overlay.id = 'miu-overlay';
              overlay.style.position = 'fixed';
              overlay.style.top = '0';
              overlay.style.left = '0';
              overlay.style.width = '100%';
              overlay.style.height = '100%';
              overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
              overlay.style.color = '#fff';
              overlay.style.display = 'flex';
              overlay.style.justifyContent = 'center';
              overlay.style.alignItems = 'center';
              overlay.style.zIndex = '10000';
              overlay.textContent = 'Posting item to categories...';
              document.body.appendChild(overlay);
            }
            overlay.style.display = 'flex';
          }
          function hideOverlay() {
            const overlay = document.getElementById('miu-overlay');
            if (overlay) overlay.style.display = 'none';
          }

          // Handler when user clicks the multiBtn
          multiBtn.addEventListener('click', function () {
            const checkedInputs = Array.from(list.querySelectorAll('input[type=checkbox]:checked'));
            const checked = checkedInputs.map(el => el.value);
            if (!checked.length) return;

            // Build common form data from the page fields
            const dataCommon = {
              strResourceType: 'M',
              lngResourceID: 1,
              ysnPublishDetail: 1,
              ysnSave: 1,
              strPage: 'CivicAlertItemList',
              curPage: 'CivicAlertForm',
              dtiBeginningDate: document.getElementById('dtiBeginningDate')?.value || '',
              dtiBeginningTime: document.getElementById('dtiBeginningTime')?.value || '',
              dtiEndingDate: document.getElementById('dtiEndingDate')?.value || '',
              dtiEndingTime: document.getElementById('dtiEndingTime')?.value || '',
              txtTitle: document.getElementById('txtTitle')?.value || '',
              hdnBriefDescription: document.getElementById('ctl01_txtBriefDesc')?.value || '',
              'ctl01$txtBriefDesc': document.getElementById('ctl01_txtBriefDesc')?.value || '',
              txtPageContent: document.getElementById('txtPageContent')?.value || '',
              txtLinkTitle1: document.getElementById('txtLinkTitle1')?.value || '',
              txtAlternateURL: document.getElementById('txtAlternateURL')?.value || '',
              txtLinkTitle2: document.getElementById('txtLinkTitle2')?.value || '',
              altURLAction: document.getElementById('altURLAction')?.checked ? 1 : 0,
              ysnArchive: document.getElementById('ysnArchive')?.value || 0,
              imgSrc: document.getElementById('imgSrc')?.value || '',
              mynewimage: '',
              ImageDocumentId: document.getElementById('imgSrc')?.value || '',
              ysnImageAlignLeft: document.getElementById('ysnImageAlignLeft')?.value || 0
            };
            if (dataCommon.imgSrc) {
              dataCommon.mynewimage = '/ImageRepository/Document?documentID=' + dataCommon.imgSrc;
            }

            // Show progress overlay
            showOverlay();
            let posted = 0;
            checked.forEach(catId => {
              const postData = Object.assign({}, dataCommon, {
                lngOldCivicAlertCategoryID: catId,
                lngCivicAlertCategoryID: catId
              });
              fetch(window.location.origin + '/Admin/civicalerts.aspx', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams(postData)
              })
                .then(() => {
                  posted++;
                  if (posted === checked.length) {
                    hideOverlay();
                    // After all posts, navigate back to previous page
                    const backBtn = document.querySelector('input[value="Back"]');
                    if (backBtn) backBtn.click();
                    else window.location.reload();
                  }
                })
                .catch(err => {
                  console.warn('[CP Toolkit] Error posting CivicAlert item', err);
                });
            });
          });
        }

        // Attempt to save categories on list page immediately
        saveCategoriesList();
        // Wait for the Save and Publish button on the creation page and build UI when available
        const saveButton = await waitForElement("input[value*='Save and Publish']", 10000);
        if (saveButton) {
          buildItemUploadUI();
        }
      } catch (err) {
        console.warn('[CP Toolkit] MultipleItemUpload init error', err);
      }
    }
  };
})();
