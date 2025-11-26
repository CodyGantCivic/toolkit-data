// Helper: Multiple Category Upload
// This script adds a simple UI to create multiple categories on CivicPlus
// admin pages (Info Center, Graphic Links, and Quick Links). It avoids
// Chrome extension APIs and conforms to the CivicPlus Toolkit helper
// specification: idempotent guard, exports an init() function, minimal
// logging, and no automatic execution outside the loader. Users can
// open the modal, add category names and statuses, then post them via
// AJAX to the current admin page. After posting, the page reloads.

(function() {
  'use strict';

  // Prevent running more than once
  if (window.MultipleCategoryUpload && window.MultipleCategoryUpload.__loaded) {
    return;
  }

  window.MultipleCategoryUpload = {
    __loaded: false,
    /**
     * Initialize the helper. Detects CivicPlus sites, waits for jQuery and
     * category pages, then injects a modal and button to create multiple
     * categories. Only posts to Info Center, Graphic Links, or Quick Links
     * admin pages. Reloads the page after categories are posted.
     */
    init: async function() {
      // guard
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

      // Wait for jQuery and an Add Category element
      const ready = await waitFor(() => {
        return !!(window.jQuery && (window.jQuery("input[value*='Add Category']").length || window.jQuery("a:contains('Add Category')").length));
      }, 10000);
      if (!ready) return;

      const $ = window.jQuery;

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
      $('<style>').text(styleContent).appendTo('head');

      // Construct modal structure
      const modal = $(
        '<div id="cp-mcu-modal">' +
          '<div class="cp-mcu-content">' +
            '<h3>Upload Multiple Categories</h3>' +
            '<div id="cp-mcu-sections">' +
              '<div class="cp-mcu-section">' +
                '<input type="text" class="cp-mcu-name" placeholder="Category Name">' +
                '<select class="cp-mcu-status">' +
                  '<option value="Draft">Draft</option>' +
                  '<option value="Published">Published</option>' +
                '</select>' +
              '</div>' +
            '</div>' +
            '<div class="cp-mcu-actions">' +
              '<button type="button" id="cp-mcu-add">Add</button>' +
              '<button type="button" id="cp-mcu-remove">Remove</button>' +
              '<button type="button" id="cp-mcu-submit">Submit</button>' +
            '</div>' +
            '<button type="button" id="cp-mcu-close">Close</button>' +
          '</div>' +
        '</div>'
      );
      $('body').append(modal);

      // Modal event handlers
      $('#cp-mcu-add').on('click', function() {
        $('#cp-mcu-sections').append(
          '<div class="cp-mcu-section">' +
            '<input type="text" class="cp-mcu-name" placeholder="Category Name">' +
            '<select class="cp-mcu-status">' +
              '<option value="Draft">Draft</option>' +
              '<option value="Published">Published</option>' +
            '</select>' +
          '</div>'
        );
      });
      $('#cp-mcu-remove').on('click', function() {
        const sections = $('#cp-mcu-sections .cp-mcu-section');
        if (sections.length > 1) sections.last().remove();
      });
      $('#cp-mcu-close').on('click', function() {
        $('#cp-mcu-modal').hide();
      });

      // Submit categories
      $('#cp-mcu-submit').on('click', function() {
        const names = $('.cp-mcu-name').map(function() { return $(this).val().trim(); }).get();
        const statuses = $('.cp-mcu-status').map(function() { return $(this).val(); }).get();
        const tasks = [];
        names.forEach(function(name, idx) {
          if (!name) return;
          const status = statuses[idx] || 'Draft';
          const data = {
            lngResourceID: 43,
            strResourceType: 'M',
            ysnSave: 1,
            intQLCategoryID: 0,
            strAction: 'qlCategorySave',
            txtName: name,
            txtGroupViewList: 1
          };
          if (status === 'Published') {
            data.ysnPublishDetail = 1;
          }
          const postUrl = window.location.origin + path;
          tasks.push(
            $.ajax({ type: 'POST', url: postUrl, data: data })
          );
        });
        if (tasks.length) {
          Promise.all(tasks).catch(function() {}) // ignore errors
            .finally(function() {
              window.location.reload();
            });
        } else {
          $('#cp-mcu-modal').hide();
        }
      });

      // Create and insert the UI trigger button on the page
      let triggerButton;
      if ($("input[value*='Add Category']").length) {
        triggerButton = $('<input type="button" class="cp-button" value="Add Multiple Categories" style="margin-left: 5px;">');
        $("input[value*='Add Category']").after(triggerButton);
      } else if ($("a:contains('Add Category')").length) {
        // For anchor-based buttons (e.g., lists with li > a)
        triggerButton = $(
          '<li><a href="#" class="button bigButton nextAction cp-button"><span>Add Multiple Categories</span></a></li>'
        );
        const buttonSection = $("a:contains('Add Category')").parents().eq(2);
        if (buttonSection.length) {
          buttonSection.prepend(triggerButton);
        }
      }
      if (triggerButton) {
        triggerButton.on('click', function(event) {
          event.preventDefault();
          $('#cp-mcu-modal').show();
          // reset fields
          $('#cp-mcu-sections .cp-mcu-name').val('');
          $('#cp-mcu-sections .cp-mcu-status').val('Draft');
        });
      }
    }
  };
})();
