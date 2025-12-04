// cp-MultipleCategoryUpload.js - Optimised CivicPlus Toolkit helper
//
// This script adds a simple UI to create multiple categories on CivicPlus
// admin pages (Info Center, Graphic Links, and Quick Links).  The original
// version depended on jQuery and used polling to wait for elements.  This
// version uses native DOM APIs, a MutationObserver-based wait helper, and
// fetch for posting categories.  It exports a single idempotent init() and
// only runs on the appropriate admin pages.

(function () {
  'use strict';

  // Prevent running more than once
  if (window.MultipleCategoryUpload && window.MultipleCategoryUpload.__loaded) {
    return;
  }

  window.MultipleCategoryUpload = {
    __loaded: false,
    init: async function () {
      if (window.MultipleCategoryUpload.__loaded) return;
      window.MultipleCategoryUpload.__loaded = true;

      // CivicPlus detection (if provided by loader). Do nothing if not CP.
      if (window.CPToolkit && typeof window.CPToolkit.isCivicPlusSite === 'function') {
        try {
          const isCP = await window.CPToolkit.isCivicPlusSite();
          if (!isCP) return;
        } catch (e) {
          // ignore detection errors
        }
      }

      // Paths where category upload applies
      const path = (window.location.pathname || '').toLowerCase();
      const validPaths = [
        '/admin/infoii.aspx',
        '/admin/graphiclinks.aspx',
        '/admin/quicklinks.aspx'
      ];
      if (!validPaths.includes(path)) return;

      /**
       * Wait for a selector to appear in the DOM. Uses MutationObserver and
       * times out after the specified milliseconds.
       * @param {() => boolean} testFn Function to test the condition.
       * @param {number} timeout Maximum time to wait in ms.
       * @returns {Promise<boolean>} Resolves true if condition met, false otherwise.
       */
      function waitFor(testFn, timeout = 8000, interval = 100) {
      const start = Date.now();
      return new Promise((resolve) => {
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

      // Wait for Add Category button/input to be present
      const ready = await waitFor(() => {
        // Input with value containing 'Add Category'
        if (document.querySelector("input[value*='Add Category']")) return true;
        // Anchor containing text 'Add Category'
        const anchors = Array.from(document.querySelectorAll('a'));
        return anchors.some(a => /Add Category/i.test(a.textContent));
      }, 10000);
      if (!ready) return;

      // Inject minimal styles for modal
      const styleContent = `
        /* Multiple Category Upload Modal Styles */
        #cp-mcu-modal { display: none; position: fixed; z-index: 2147483600; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background: rgba(0, 0, 0, 0.4); }
        #cp-mcu-modal .cp-mcu-content { background: #fff; margin: 5% auto; padding: 20px; border: 1px solid #888; width: 400px; max-width: 90%; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.2); }
        #cp-mcu-modal h3 { margin-top: 0; }
        .cp-mcu-section { margin-bottom: 10px; }
        .cp-mcu-section input, .cp-mcu-section select { width: 100%; margin-bottom: 4px; padding: 6px; }
        .cp-mcu-actions { display: flex; justify-content: space-between; gap: 6px; margin-top: 10px; }
        .cp-mcu-actions button { flex: 1; padding: 6px; border: 1px solid #ccc; border-radius: 4px; background: #f3f4f6; cursor: pointer; }
        .cp-mcu-actions button:hover { background: #e5e7eb; }
        #cp-mcu-close { margin-top: 10px; padding: 6px 12px; border: none; background: #e5e7eb; border-radius: 4px; cursor: pointer; }
        #cp-mcu-close:hover { background: #d1d5db; }
      `;
      const styleEl = document.createElement('style');
      styleEl.textContent = styleContent;
      document.head.appendChild(styleEl);

      // Construct modal structure
      const modal = document.createElement('div');
      modal.id = 'cp-mcu-modal';
      modal.innerHTML = `
        <div class="cp-mcu-content">
          <h3>Upload Multiple Categories</h3>
          <div id="cp-mcu-sections">
            <div class="cp-mcu-section">
              <input type="text" class="cp-mcu-name" placeholder="Category Name">
              <select class="cp-mcu-status">
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
              </select>
            </div>
          </div>
          <div class="cp-mcu-actions">
            <button type="button" id="cp-mcu-add">Add</button>
            <button type="button" id="cp-mcu-remove">Remove</button>
            <button type="button" id="cp-mcu-submit">Submit</button>
          </div>
          <button type="button" id="cp-mcu-close">Close</button>
        </div>
      `;
      document.body.appendChild(modal);

      // Modal event handlers
      document.getElementById('cp-mcu-add').addEventListener('click', function() {
        const sections = document.getElementById('cp-mcu-sections');
        const div = document.createElement('div');
        div.className = 'cp-mcu-section';
        div.innerHTML = `
          <input type="text" class="cp-mcu-name" placeholder="Category Name">
          <select class="cp-mcu-status">
            <option value="Draft">Draft</option>
            <option value="Published">Published</option>
          </select>
        `;
        sections.appendChild(div);
      });
      document.getElementById('cp-mcu-remove').addEventListener('click', function() {
        const sections = document.querySelectorAll('#cp-mcu-sections .cp-mcu-section');
        if (sections.length > 1) sections[sections.length - 1].remove();
      });
      document.getElementById('cp-mcu-close').addEventListener('click', function() {
        modal.style.display = 'none';
      });

      // Submit categories
      document.getElementById('cp-mcu-submit').addEventListener('click', function() {
        const nameInputs = Array.from(document.querySelectorAll('.cp-mcu-name'));
        const statusSelects = Array.from(document.querySelectorAll('.cp-mcu-status'));
        const tasks = [];
        nameInputs.forEach(function(input, idx) {
          const name = input.value.trim();
          if (!name) return;
          const status = statusSelects[idx] ? statusSelects[idx].value : 'Draft';
          const data = new URLSearchParams();
          data.append('lngResourceID', '43');
          data.append('strResourceType', 'M');
          data.append('ysnSave', '1');
          data.append('intQLCategoryID', '0');
          data.append('strAction', 'qlCategorySave');
          data.append('txtName', name);
          data.append('txtGroupViewList', '1');
          if (status === 'Published') {
            data.append('ysnPublishDetail', '1');
          }
          const postUrl = window.location.origin + path;
          tasks.push(
            fetch(postUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
              body: data.toString(),
              credentials: 'same-origin'
            })
          );
        });
        if (tasks.length) {
          Promise.allSettled(tasks).finally(function() {
            window.location.reload();
          });
        } else {
          modal.style.display = 'none';
        }
      });

      // Create and insert the UI trigger button on the page
      let triggerButton;
      const addInput = document.querySelector("input[value*='Add Category']");
      if (addInput) {
        triggerButton = document.createElement('input');
        triggerButton.type = 'button';
        triggerButton.className = 'cp-button';
        triggerButton.value = 'Add Multiple Categories';
        triggerButton.style.marginLeft = '5px';
        addInput.insertAdjacentElement('afterend', triggerButton);
      } else {
        // For anchor-based buttons (e.g., lists with li > a)
        const addAnchor = Array.from(document.querySelectorAll('a')).find(a => /Add Category/i.test(a.textContent));
        if (addAnchor) {
          triggerButton = document.createElement('li');
          const link = document.createElement('a');
          link.href = '#';
          link.className = 'button bigButton nextAction cp-button';
          link.innerHTML = '<span>Add Multiple Categories</span>';
          triggerButton.appendChild(link);
          // Insert at the correct parent list
          let parent = addAnchor.parentElement;
          // ascend until we find a UL or appropriate container
          for (let i = 0; i < 3 && parent && parent.tagName.toLowerCase() !== 'ul'; i++) {
            parent = parent.parentElement;
          }
          if (parent) {
            parent.insertBefore(triggerButton, parent.firstChild);
          }
          triggerButton = link;
        }
      }
      if (triggerButton) {
        triggerButton.addEventListener('click', function(event) {
          event.preventDefault();
          modal.style.display = 'block';
          // reset fields
          document.querySelectorAll('#cp-mcu-sections .cp-mcu-name').forEach(function(inp) { inp.value = ''; });
          document.querySelectorAll('#cp-mcu-sections .cp-mcu-status').forEach(function(sel) { sel.value = 'Draft'; });
        });
      }
    }
  };
})();
