// CivicPlus Toolkit - Multiple Quick Links Helper (Optimised)
// This helper enhances the QuickLinks administration page by allowing
// admins to add multiple link items at once.  It has been rewritten to
// remove dependencies on jQuery, avoid repeated polling and instead use
// MutationObservers and native DOM APIs.  Network requests are made
// using the Fetch API and results are tracked via a simple overlay.

(function () {
  'use strict';

  // Guard against double‑loading
  if (window.MultipleQuickLinks && window.MultipleQuickLinks.__loaded) {
    return;
  }

  window.MultipleQuickLinks = {
    __loaded: false,
    init: async function () {
      if (window.MultipleQuickLinks.__loaded) return;
      window.MultipleQuickLinks.__loaded = true;

      try {
        // Only run on CivicPlus sites when detection is available
        if (window.CPToolkit && typeof window.CPToolkit.isCivicPlusSite === 'function') {
          try {
            const isCp = await window.CPToolkit.isCivicPlusSite();
            if (!isCp) {
              return;
            }
          } catch (_) {
            // detection call failed; continue
          }
        }

        // Only run on the QuickLinks admin page
        const path = (window.location.pathname || '').toLowerCase();
        if (!path.includes('/admin/quicklinks.aspx')) {
          return;
        }

        /**
         * Wait for an element matching the selector to appear in the DOM.
         * Uses MutationObserver for efficiency and times out after the
         * specified number of milliseconds.  Returns the element or null.
         * @param {string} selector
         * @param {number} timeout
         */
        function waitForElement(selector, timeout = 8000) {
          return new Promise(resolve => {
            const element = document.querySelector(selector);
            if (element) return resolve(element);
            const observer = new MutationObserver(() => {
              const el = document.querySelector(selector);
              if (el) {
                observer.disconnect();
                resolve(el);
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

        // Wait for the first quick link section and the Save and Publish button
        const firstSection = await waitForElement('.formline.selfClear.multiple.link');
        const publishButton = await waitForElement("input[value*='Save and Publish']");
        if (!firstSection || !publishButton) {
          return;
        }

        // Hidden textarea to track completion counts (for backwards compatibility)
        const progressId = 'completedResults';
        if (!document.getElementById(progressId)) {
          const textarea = document.createElement('textarea');
          textarea.id = progressId;
          textarea.style.display = 'none';
          textarea.style.margin = '0px 921px 0px 0px';
          textarea.style.height = '356px';
          textarea.style.width = '362px';
          publishButton.insertAdjacentElement('afterend', textarea);
        }

        // Maintain a counter for posted quick links
        let postedCount = 0;

        /**
         * Append UI elements to allow adding new quick link sections and a status
         * dropdown.  This function is idempotent and safe to call repeatedly.
         */
        function appendUI() {
          // Identify the inner wrapper div (the original code targeted the first
          // inner div within the .formline container).  We find the first
          // descendant div of the first quick link section.
          const innerDiv = firstSection.querySelector('div');
          if (innerDiv) {
            // Add the "+" button before the first inner div if not already present
            if (!document.querySelector('input[name="addNewSection"]')) {
              const addBtn = document.createElement('input');
              addBtn.type = 'button';
              addBtn.name = 'addNewSection';
              addBtn.value = '+';
              addBtn.style.width = '30px';
              addBtn.style.float = 'right';
              addBtn.style.marginTop = '25px';
              innerDiv.parentElement.insertBefore(addBtn, innerDiv);
            }
          }

          // Add a status dropdown to the first quick link section if missing
          const statusExists = firstSection.querySelector('select[name="txtStatus"]');
          if (!statusExists) {
            const select = document.createElement('select');
            select.name = 'txtStatus';
            select.style.float = 'left';
            select.style.marginRight = '20px';
            const optPub = document.createElement('option');
            optPub.value = 'Save and Publish';
            optPub.textContent = 'Published';
            const optDraft = document.createElement('option');
            optDraft.value = 'Save';
            optDraft.textContent = 'Draft';
            select.appendChild(optPub);
            select.appendChild(optDraft);
            // Append to the firstSection's inner container
            const firstInner = firstSection.querySelector('div');
            if (firstInner) firstInner.appendChild(select);
          }

          // Handler to insert a new quick link section
          function addNewSection() {
            const container = document.createElement('div');
            container.className = 'formline selfClear multiple link';
            container.style.paddingTop = '10px';
            // Compose the inner HTML similar to the original markup
            container.innerHTML =
              '<br>' +
              '<input type="button" style="width:30px;float:right;margin-top:55px;" name="addNewSection" value="+">' +
              '<label for="txtLink">Link</label>' +
              '<div>' +
              '<label for="txtLink">Web Address<br><input type="text" name="txtLink" value=""></label>' +
              '<label for="txtLinkText">Display Text<br><input type="text" maxlength="500" name="txtLinkText" value=""></label>' +
              '<label class="check" style="width:47%" for="ysnNewWindow"><input type="checkbox" name="ysnNewWindow">Open in new window</label>' +
              '<select name="txtStatus" style="float:left;margin-right:20px;"><option value="Save and Publish">Published</option><option value="Save">Draft</option></select>' +
              '</div>';
            // Append the new section after the last existing quick link section
            const allSections = document.querySelectorAll('.formline.selfClear.multiple.link');
            const lastSection = allSections[allSections.length - 1];
            if (lastSection) {
              lastSection.insertAdjacentElement('afterend', container);
            }
            // Rebind all plus buttons to click handler
            bindPlusButtons();
          }

          // Bind plus buttons to call addNewSection and remove the clicked button
          function bindPlusButtons() {
            const buttons = document.querySelectorAll('input[name="addNewSection"]');
            buttons.forEach(btn => {
              btn.removeEventListener('click', plusClickHandler);
              btn.addEventListener('click', plusClickHandler);
            });
          }
          function plusClickHandler(event) {
            const target = event.currentTarget;
            // Remove the clicked button to avoid duplicates
            target.parentElement.removeChild(target);
            addNewSection();
          }
          bindPlusButtons();
        }

        /**
         * Perform a POST request to create a single quick link.  Uses fetch
         * instead of jQuery.ajax.  Tracks completion via postedCount and
         * updates the progress textarea.  If all links are completed,
         * hides the overlay and triggers navigation back to the list page.
         * @param {HTMLInputElement} displayInput
         * @param {string} webAddress
         * @param {boolean} openInNewWindow
         * @param {string} statusValue
         */
        function addQuickLink(displayInput, webAddress, openInNewWindow, statusValue) {
          postedCount++;
          // Extract necessary hidden values
          const intQLCategoryIDElems = document.getElementsByName('intQLCategoryID');
          const lngResourceIDElems = document.getElementsByName('lngResourceID');
          if (!intQLCategoryIDElems[1] || !lngResourceIDElems[1]) return;
          const intQLCategoryID = intQLCategoryIDElems[1].value;
          const lngResourceID = lngResourceIDElems[1].value;
          // Format current date mm/dd/yyyy
          const today = new Date();
          const dd = ('0' + today.getDate()).slice(-2);
          const mm = ('0' + (today.getMonth() + 1)).slice(-2);
          const yyyy = today.getFullYear();
          const formattedDate = `${mm}/${dd}/${yyyy}`;
          // Build POST data
          const data = {
            lngResourceID: lngResourceID,
            strResourceType: 'M',
            ysnSave: 1,
            strAction: 'qlLinkSave',
            strActionSubmit: 0,
            intQLCategoryID: intQLCategoryID,
            save: statusValue,
            txtLink: webAddress,
            txtLinkText: displayInput.value,
            ysnNewWindow: openInNewWindow ? 1 : 0,
            dtiStartDate: formattedDate,
            txtCategoryIDListSave: intQLCategoryID
          };
          fetch('https://' + document.location.hostname + '/admin/quicklinks.aspx', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams(data)
          })
            .then(() => {
              // Mark the display text as done
              displayInput.value = 'Done';
              // Update the hidden progress textarea
              const resArea = document.getElementById(progressId);
              if (resArea) {
                resArea.value = postedCount.toString();
              }
              // If all posts complete, hide overlay and navigate back
              const linkCount = document.getElementsByName('txtLinkText').length;
              if (postedCount === linkCount) {
                hideOverlay();
                const backBtn = document.querySelector('input[value="Back"]');
                if (backBtn) backBtn.click();
              }
            })
            .catch(err => {
              console.warn('[CP Toolkit] Error posting quick link', err);
            });
        }

        // Function to show a progress overlay while links are posting
        function showOverlay() {
          // If site defines ajax helpers, use them for consistency
          try {
            // eslint-disable-next-line no-undef
            if (typeof ajaxPostBackStart === 'function' && typeof ajaxPostBackEnd === 'function') {
              // eslint-disable-next-line no-undef
              ajaxPostBackStart('Please wait... This will only take a moment.');
              const ajaxProgress = document.getElementById('divAjaxProgress');
              if (ajaxProgress) {
                const clone = ajaxProgress.cloneNode(true);
                clone.id = 'toolkit-block';
                clone.style.display = 'block';
                document.body.appendChild(clone);
              }
              // eslint-disable-next-line no-undef
              ajaxPostBackEnd();
              return;
            }
          } catch (e) {
            // ignore errors
          }
          // Fallback: create a simple overlay
          let overlay = document.getElementById('toolkit-block');
          if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'toolkit-block';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
            overlay.style.color = '#fff';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.zIndex = '10000';
            overlay.textContent = 'Posting quick links...';
            document.body.appendChild(overlay);
          } else {
            overlay.style.display = 'flex';
          }
        }

        // Hide progress overlay
        function hideOverlay() {
          const overlay = document.getElementById('toolkit-block');
          if (overlay) {
            overlay.style.display = 'none';
          }
        }

        // Append the UI modifications
        appendUI();

        // Insert a Post Items button after the Save and Publish button
        const postBtn = document.createElement('input');
        postBtn.type = 'button';
        postBtn.className = 'cp-button';
        postBtn.value = 'Post Items';
        postBtn.style.marginLeft = '5px';
        publishButton.insertAdjacentElement('afterend', postBtn);

        // Click handler for posting all quick links
        postBtn.addEventListener('click', () => {
          // Reset posted count
          postedCount = 0;
          // Show overlay
          showOverlay();
          // Gather all quick link fields
          const urlInputs = document.getElementsByName('txtLink');
          const displayInputs = document.getElementsByName('txtLinkText');
          const newWindowInputs = document.getElementsByName('ysnNewWindow');
          const statusInputs = document.getElementsByName('txtStatus');
          for (let i = 0; i < urlInputs.length; i++) {
            const displayInput = displayInputs[i];
            const urlVal = urlInputs[i].value;
            const newWin = newWindowInputs[i].checked;
            const statusVal = statusInputs[i].value;
            addQuickLink(displayInput, urlVal, newWin, statusVal);
          }
        });
      } catch (err) {
        console.warn('[CP Toolkit] MultipleQuickLinks init error', err);
      }
    }
  };
})();
