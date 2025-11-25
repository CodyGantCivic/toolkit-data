// XMLMajorChangeAlert.js
// Version: fixed (export init, compute diffs, safer DOM insertion)

(function () {
  'use strict';

  const TOOLKIT_NAME = '[CP Toolkit - XML Major Change Alert]';
  const GUARD = '__CP_XML_MAJOR_CHANGE_ALERT_LOADED_v1';

  if (window[GUARD]) {
    return;
  }

  // Expose object
  window.XMLMajorChangeAlert = window.XMLMajorChangeAlert || { __loaded: false };

  // Small helper: wait-for condition
  async function waitFor(fn, timeout = 5000, interval = 100) {
    const start = Date.now();
    return new Promise((resolve) => {
      (function check() {
        try {
          if (fn()) return resolve(true);
        } catch (e) { /* ignore */ }
        if (Date.now() - start >= timeout) return resolve(false);
        setTimeout(check, interval);
      })();
    });
  }

  // Compute list of container IDs from XML string
  function extractContainerIdsFromXml(xmlString) {
    try {
      // parse into DOM fragment safely
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, 'text/xml');
      const nodes = Array.from(doc.querySelectorAll('[cpRole="contentContainer"]'));
      return nodes.map(n => n.getAttribute('id') || '').filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  // Compute human diff string
  function makeDifferenceString(removedIds) {
    if (!removedIds || !removedIds.length) return '';
    return removedIds.map(id => '- ' + id).join('\n');
  }

  // Build a small toolkit alert element (safely)
  function ensureToolkitAlert() {
    let el = document.getElementById('toolkitAlert');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toolkitAlert';
      el.style.margin = '6px 0';
      el.style.fontSize = '13px';
      // try to place near the structureFile input; fallback to body prepend
      try {
        const structure = document.getElementById('structureFile');
        if (structure && structure.parentNode) {
          structure.parentNode.appendChild(el);
        } else {
          document.body.insertBefore(el, document.body.firstChild);
        }
      } catch (e) {
        document.body.insertBefore(el, document.body.firstChild);
      }
    }
    return el;
  }

  // Core init (idempotent)
  async function init() {
    if (window[GUARD]) return;
    window[GUARD] = true;
    window.XMLMajorChangeAlert.__loaded = true;

    try {
      // Only on Layout Modify page
      try {
        const url = (window.location.pathname || '').toLowerCase();
        if (!url.includes('/admin/designcenter/layouts/modify')) {
          return;
        }
      } catch (e) {
        // continue defensively
      }

      // optional loader validator
      if (window.CPToolkit && typeof window.CPToolkit.isCivicPlusSite === 'function') {
        try {
          const ok = await window.CPToolkit.isCivicPlusSite();
          if (!ok) return;
        } catch (e) {
          // continue
        }
      }

      // wait for jQuery
      const okJQ = await waitFor(() => !!window.jQuery, 5000);
      if (!okJQ) return;
      const $ = window.jQuery;

      $(function () {
        try {
          // Create or ensure the toolkit alert container
          const $alert = $(ensureToolkitAlert());

          // Grab original XML from the page (usually in a <code> or textarea)
          const originalXmlRaw = ($('code').first().text() || '').trim();
          const originalIds = extractContainerIdsFromXml(originalXmlRaw);

          // When a new file is chosen, read it and compare
          $('#structureFile').off('change.cpXMLMajor').on('change.cpXMLMajor', function () {
            const file = this.files && this.files[0];
            if (!file) {
              $alert.text('');
              $('a.button.save').removeClass('xml-warning');
              $('a.button.save span').text('Save');
              return;
            }

            try {
              const reader = new FileReader();
              reader.onload = function (e) {
                try {
                  const data = e.target.result || '';
                  // keep only the XML starting at <?xml
                  const xmlStartIndex = data.indexOf('<?xml');
                  const newXml = xmlStartIndex >= 0 ? data.slice(xmlStartIndex) : data;

                  // extract container ids from new xml
                  const newIds = extractContainerIdsFromXml(newXml);

                  // compute removed containers (in original but not in new)
                  const removed = originalIds.filter(id => newIds.indexOf(id) < 0);

                  if (removed.length) {
                    const diffText = makeDifferenceString(removed);
                    // show a clear warning in the page
                    $alert
                      .text('Warning: The new XML removes existing content containers. Widgets/styles applied to these containers will be lost.')
                      .css('color', 'red')
                      .attr('title', 'Removed containers:\n' + diffText);

                    // make the save button visually urgent
                    $('a.button.save')
                      .css('background-color', '#B33A3A')
                      .css('border-bottom-color', '#792327')
                      .css('color', '#fff')
                      .addClass('xml-warning');
                    $('a.button.save span').text('Save ignoring XML warning');
                  } else {
                    $alert.text('The new XML preserves all existing containers.').css('color', 'green');
                    $('a.button.save')
                      .css('background-color', '')
                      .css('border-bottom-color', '')
                      .css('color', '')
                      .removeClass('xml-warning');
                    $('a.button.save span').text('Save');
                  }

                  // Extra validation: check for malformed content containers in new xml
                  const newMalformed = (function () {
                    try {
                      const parser = new DOMParser();
                      const ndoc = parser.parseFromString(newXml, 'text/xml');
                      const bad = Array.from(ndoc.querySelectorAll('[cpRole="contentContainer"]')).filter(n => n.children && n.children.length);
                      return bad.map(n => n.getAttribute('id') || '').filter(Boolean);
                    } catch (err) {
                      return [];
                    }
                  })();

                  if (newMalformed.length) {
                    const list = newMalformed.join('\n');
                    alert('The chosen XML is malformed:\n\ncontent container(s) contain additional elements.\n\nInvalid children:\n\n' + list + '\nThis may cause layout/theme save errors.');
                  }
                } catch (errInner) {
                  console.error(TOOLKIT_NAME + ' file read processing error', errInner);
                }
              };
              reader.readAsText(file);
            } catch (err) {
              console.error(TOOLKIT_NAME + ' file read error', err);
            }
          });

          // Convert built-in error DIV into alert popups (keep behavior)
          $('#ErrorMessage').on('DOMSubtreeModified.cpXMLMajor', function (e) {
            try {
              const t = $(this).text().trim();
              if (t) alert(t);
            } catch (err) {
              /* ignore */
            }
          });

          // add "View Layout Page" button safely near existing save button area
          try {
            const layoutName = ($('#txtStructureName').val() || '').toString();
            if (layoutName) {
              const pagesUrl = '/Pages/LayoutPage/?name=' + encodeURIComponent(layoutName);
              const $linkLi = $('<li />').append(
                $('<a />').attr('href', pagesUrl).attr('target', '_blank').text('View Layout Page')
              );
              $('.buttons li a.save').parent('li').after($linkLi);
            }
          } catch (e) {
            // non-critical
            console.error(TOOLKIT_NAME + ' error adding View Layout Page button', e);
          }

        } catch (e) {
          console.error(TOOLKIT_NAME + ' initialization error', e);
        }
      });

    } catch (e) {
      console.error(TOOLKIT_NAME + ' init failed', e);
    }
  }

  // expose init
  window.XMLMajorChangeAlert.init = init;

  // auto-run (idempotent)
  try {
    window.XMLMajorChangeAlert.init();
  } catch (e) {
    console.error(TOOLKIT_NAME + ' auto-run failed', e);
  }

})();

    }

})();
