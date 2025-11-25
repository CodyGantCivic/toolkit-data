// CivicPlus Toolkit - Multiple Quick Links Helper
// This helper enhances the QuickLinks administration page by allowing
// admins to add multiple link items at once. It is adapted from an
// older Chrome extension but refactored for the CivicPlus Toolkit. The helper:
// - Runs only on CivicPlus sites (when CPToolkit.isCivicPlusSite() returns true).
// - Waits for jQuery and the quicklinks form to be ready.
// - Adds a "+" button to duplicate quicklink sections and a status dropdown.
// - Adds a "Post Items" button to post all entered quick links via AJAX.
// - Uses an idempotent guard and exposes an init() method.

(function () {
  'use strict';

  // Prevent multiple initialisations
  if (window.MultipleQuickLinks && window.MultipleQuickLinks.__loaded) {
    return;
  }

  window.MultipleQuickLinks = {
    __loaded: false,
    init: async function () {
      if (window.MultipleQuickLinks.__loaded) return;
      window.MultipleQuickLinks.__loaded = true;

      try {
        // If CPToolkit detection is available, ensure we are on a CivicPlus site
        if (window.CPToolkit && typeof window.CPToolkit.isCivicPlusSite === 'function') {
          try {
            const isCP = await window.CPToolkit.isCivicPlusSite();
            if (!isCP) {
              return;
            }
          } catch (_) {
            // detection failed; fall through
          }
        }

        // Only run on the QuickLinks admin page
        const path = (window.location.pathname || '').toLowerCase();
        if (!path.includes('/admin/quicklinks.aspx')) {
          return;
        }

        // Helper to wait for a condition to be true
        function waitFor(testFn, timeout = 5000, interval = 100) {
          const start = Date.now();
          return new Promise(resolve => {
            (function check() {
              try {
                if (testFn()) {
                  return resolve(true);
                }
              } catch (_) {
                // ignore errors from testFn
              }
              if (Date.now() - start >= timeout) {
                return resolve(false);
              }
              setTimeout(check, interval);
            })();
          });
        }

        // Wait for jQuery
        const hasJq = await waitFor(() => !!window.jQuery, 4000);
        if (!hasJq) {
          return;
        }
        const $ = window.jQuery;

        // Wait for the quicklinks form and the Save and Publish button to appear
        const ready = await waitFor(() => {
          return (
            $('.formline.selfClear.multiple.link').length > 0 &&
            $("input[value*='Save and Publish']").length > 0
          );
        }, 6000);
        if (!ready) {
          return;
        }

        // Insert a hidden textarea to track completion counts (if not already present)
        const progressId = 'completedResults';
        if (!document.getElementById(progressId)) {
          const textarea = document.createElement('textarea');
          textarea.id = progressId;
          textarea.style.display = 'none';
          textarea.style.margin = '0px 921px 0px 0px';
          textarea.style.height = '356px';
          textarea.style.width = '362px';
          const publishButton = $("input[value*='Save and Publish']").first();
          if (publishButton.length) {
            publishButton.after(textarea);
          }
        }

        let categoryCount = 0;

        // Function to add UI elements to duplicate quicklink sections and add a status dropdown
        function appendCode() {
          // Add a "+" button before the first quicklink div
          const firstDiv = $('.formline.selfClear.multiple.link div:first-of-type').first()[0];
          if (firstDiv) {
            // Avoid adding the button multiple times
            if (!document.querySelector('input[name="addNewSection"]')) {
              const addNewHtml = '<br><input type="button" style="width:30px;float:right;margin-top:25px;" name="addNewSection" value="+">';
              firstDiv.insertAdjacentHTML('beforebegin', addNewHtml);
            }
          }

          // Add a status select dropdown to the first quicklink div
          const firstDiv2 = $('.formline.selfClear.multiple.link div:first-of-type')[0];
          if (firstDiv2) {
            // Only insert if no status select exists
            if (!firstDiv2.querySelector('select[name="txtStatus"]')) {
              const statusHtml = '<select name="txtStatus" style="float:left;margin-right:20px;"><option value="Save and Publish">Published</option><option value="Save">Draft</option></select>';
              firstDiv2.insertAdjacentHTML('beforeend', statusHtml);
            }
          }

          // Handler to insert another quicklink section
          function addNewSectionClickHandler() {
            const str =
              '<div class="formline selfClear multiple link" style="padding-top: 10px;">' +
              '<br>' +
              '<input type="button" style="width:30px;float:right;margin-top:55px;" name="addNewSection" value="+">' +
              '<label for="txtLink">Link</label>' +
              '<div>' +
              '<label for="txtLink">Web Address<br><input type="text" name="txtLink" value=""></label>' +
              '<label for="txtLinkText">Display Text<br><input type="text" maxlength="500" name="txtLinkText" value=""></label>' +
              '<label class="check" style="width:47%" for="ysnNewWindow"><input type="checkbox" name="ysnNewWindow">Open in new window</label>' +
              '<select name="txtStatus" style="float:left;margin-right:20px;"><option value="Save and Publish">Published</option><option value="Save">Draft</option></select>' +
              '</div>' +
              '</div>';
            const lastDiv = $('.formline.selfClear.multiple.link div:last-of-type')[0];
            if (lastDiv) {
              lastDiv.insertAdjacentHTML('beforeend', str);
            }
            // Re-bind handlers
            $('input[name="addNewSection"]').off('click').on('click', function () {
              $(this).remove();
              addNewSectionClickHandler();
            });
          }

          // Initial binding for existing button(s)
          $('input[name="addNewSection"]').off('click').on('click', function () {
            $(this).remove();
            addNewSectionClickHandler();
          });
        }

        // Function to perform AJAX POST for a single quick link
        function addQuickLink(displayTextInput, webAddressValue, newWindowChecked, statusValue) {
          categoryCount++;
          const intQLCategoryIDElems = document.getElementsByName('intQLCategoryID');
          const lngResourceIDElems = document.getElementsByName('lngResourceID');
          if (!intQLCategoryIDElems[1] || !lngResourceIDElems[1]) return;
          const intQLCategoryID = intQLCategoryIDElems[1].value;
          const lngResourceID = lngResourceIDElems[1].value;
          const today = new Date();
          const dd = ('0' + today.getDate()).slice(-2);
          const mm = ('0' + (today.getMonth() + 1)).slice(-2);
          const yyyy = today.getFullYear();
          const formatted = `${mm}/${dd}/${yyyy}`;
          const data = {
            lngResourceID: lngResourceID,
            strResourceType: 'M',
            ysnSave: 1,
            strAction: 'qlLinkSave',
            strActionSubmit: 0,
            intQLCategoryID: intQLCategoryID,
            save: statusValue,
            txtLink: webAddressValue,
            txtLinkText: displayTextInput.value,
            ysnNewWindow: newWindowChecked,
            dtiStartDate: formatted,
            txtCategoryIDListSave: intQLCategoryID
          };
          $.ajax({
            type: 'POST',
            url: 'https://' + document.location.hostname + '/admin/quicklinks.aspx',
            data: data
          }).done(function () {
            displayTextInput.value = 'Done';
            const resArea = document.getElementById(progressId);
            if (resArea) {
              resArea.value = categoryCount.toString();
            }
            const qlCount = document.getElementsByName('txtLinkText');
            if (categoryCount === qlCount.length) {
              const block = document.getElementById('toolkit-block');
              if (block) {
                block.style.display = 'none';
              }
              $('input[value="Back"]').click();
            }
          });
        }

        // Add UI modifications
        appendCode();

        // Add a "Post Items" button after the Save and Publish button
        const postButton = document.createElement('input');
        postButton.type = 'button';
        postButton.className = 'cp-button';
        postButton.value = 'Post Items';
        postButton.style.marginLeft = '5px';
        const publishBtn = $("input[value*='Save and Publish']").first();
        if (publishBtn.length) {
          publishBtn.after(postButton);
        }
        // Handler for posting quick links
        postButton.addEventListener('click', function () {
          // Show a progress overlay by cloning the existing Ajax progress element if available
          try {
            const overlayScript =
              'ajaxPostBackStart("Please wait... This will only take a moment.");' +
              '$("#divAjaxProgress").clone().attr("id", "toolkit-block").css("display", "block").appendTo("body");' +
              'ajaxPostBackEnd();';
            const scriptElem = document.createElement('script');
            scriptElem.textContent = overlayScript;
            document.body.appendChild(scriptElem);
          } catch (_) {
            // ignore if Ajax functions are not defined
          }
          // Gather form values and post each quick link
          const webAddressElems = document.getElementsByName('txtLink');
          const displayTextElems = document.getElementsByName('txtLinkText');
          const newWindowElems = document.getElementsByName('ysnNewWindow');
          const statusElems = document.getElementsByName('txtStatus');
          for (let idx = 0; idx < webAddressElems.length; idx++) {
            const displayInput = displayTextElems[idx];
            const urlValue = webAddressElems[idx].value;
            const openNew = newWindowElems[idx].checked;
            const statusVal = statusElems[idx].value;
            addQuickLink(displayInput, urlValue, openNew, statusVal);
          }
        });
      } catch (err) {
        // Surface any errors quietly
        console.warn('[CP Toolkit] MultipleQuickLinks init error', err);
      }
    }
  };
})();
