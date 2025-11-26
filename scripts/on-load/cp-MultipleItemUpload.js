// Helper: Multiple Item Upload
// This script adds a button on the CivicAlerts admin page to save a single
// CivicAlert item to multiple categories. It collects available categories
// when viewing the categories list and stores them in localStorage. On the
// item creation page, it displays a category selection list and uses
// AJAX requests to post the item to each selected category. The script
// avoids Chrome extension APIs and conforms to the CivicPlus Toolkit helper
// guidelines: idempotent guard, exported init() function, minimal logging,
// and no automatic execution outside the loader.

(function() {
  'use strict';

  // Prevent running more than once
  if (window.MultipleItemUpload && window.MultipleItemUpload.__loaded) {
    return;
  }

  window.MultipleItemUpload = {
    __loaded: false,
    /**
     * Initialize the helper. Detects CivicAlerts admin pages and
     * either stores category IDs/names in localStorage or injects a UI
     * to select categories and post the current item to each. Runs only
     * on CivicPlus sites.
     */
    init: async function() {
      if (window.MultipleItemUpload.__loaded) return;
      window.MultipleItemUpload.__loaded = true;

      // CivicPlus detection via CPToolkit (if available)
      if (window.CPToolkit && typeof window.CPToolkit.isCivicPlusSite === 'function') {
        try {
          const isCP = await window.CPToolkit.isCivicPlusSite();
          if (!isCP) return;
        } catch (e) {
          // ignore detection errors
        }
      }

      // Only operate on CivicAlerts admin page
      const path = (window.location.pathname || '').toLowerCase();
      if (path !== '/admin/civicalerts.aspx') return;

      // Wait helper: resolves when testFn returns true or timeout reached
      function waitFor(testFn, timeout = 8000, interval = 100) {
        const start = Date.now();
        return new Promise(resolve => {
          (function check() {
            try {
              if (testFn()) return resolve(true);
            } catch (e) {
              // ignore
            }
            if (Date.now() - start >= timeout) return resolve(false);
            setTimeout(check, interval);
          })();
        });
      }

      // Helper to save categories list to localStorage
      function saveCategoriesList() {
        const links = document.querySelectorAll('.adminthin a');
        const categories = [];
        links.forEach(link => {
          const onClick = link.getAttribute('onclick');
          if (!onClick) return;
          // Extract categoryID from onClick like: "callPage('CivicAlertItemList',6376,29)"
          const res = onClick.slice(24);
          const categoryID = res.substring(0, res.indexOf(','));
          const categoryName = link.innerText || link.textContent || '';
          categories.push({ categoryName, categoryID });
        });
        if (categories.length) {
          try {
            localStorage.setItem('cpToolkitAlertCategories', JSON.stringify(categories));
          } catch (e) {
            // ignore storage errors
          }
        }
      }

      // Helper to build UI on item creation page
      function buildItemUploadUI() {
        // Only run if Save and Publish button exists
        const saveBtn = document.querySelector("input[value*='Save and Publish']");
        if (!saveBtn) return;
        // Avoid injecting UI multiple times
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

        // Create action button
        const multiBtn = document.createElement('input');
        multiBtn.type = 'button';
        multiBtn.className = 'cp-button';
        multiBtn.id = 'cp-miu-button';
        multiBtn.value = 'Save to Multiple Categories';
        multiBtn.style.marginLeft = '5px';

        // Insert UI after the Save button
        saveBtn.insertAdjacentElement('afterend', multiBtn);
        // Insert categories container after Save button area (e.g., near #advanced or after Save button)
        const advanced = document.getElementById('advanced');
        if (advanced) {
          advanced.insertAdjacentElement('afterend', catContainer);
        } else {
          saveBtn.insertAdjacentElement('afterend', catContainer);
        }

        // Handler for multiBtn
        multiBtn.addEventListener('click', function() {
          // Collect selected categories
          const checked = Array.from(list.querySelectorAll('input[type=checkbox]:checked')).map(el => el.value);
          if (!checked.length) return;
          // Build common data from form fields
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
          // Post to each category
          let posted = 0;
          checked.forEach(catId => {
            const data = Object.assign({}, dataCommon, {
              lngOldCivicAlertCategoryID: catId,
              lngCivicAlertCategoryID: catId
            });
            $.ajax({ type: 'POST', url: window.location.origin + '/Admin/civicalerts.aspx', data: data })
              .done(function() {
                posted++;
                if (posted === checked.length) {
                  // After all posts, simulate back navigation
                  const backButton = document.querySelector('input[value="Back"]');
                  if (backButton) backButton.click();
                  else window.location.reload();
                }
              });
          });
        });
      }

      // Determine if we are on categories list page or item creation page
      // If we find a TD with "Published Categories", store categories
      if (document.querySelector('td') && document.querySelector("td:contains('Published Categories')")) {
        saveCategoriesList();
      }
      // If we find Save and Publish button, build UI for multiple item upload
      // Wait for jQuery and Save button presence
      const readyForUI = await waitFor(() => {
        return !!(window.jQuery && document.querySelector("input[value*='Save and Publish']"));
      }, 10000);
      if (readyForUI) {
        buildItemUploadUI();
      }
    }
  };
})();
