// XMLMajorChangeAlert.js
// Clean, fixed, injection-safe, GitHub-ready
// Exports: window.XMLMajorChangeAlert.init()
// Auto-runs only on CivicPlus + Layout Modify pages

(function () {
  'use strict';

  const NS = 'XMLMajorChangeAlert';
  const GUARD = '__CP_' + NS + '_LOADED_v1';

  if (window[GUARD]) return;
  window[GUARD] = true;

  window.XMLMajorChangeAlert = window.XMLMajorChangeAlert || { __loaded: false };

  function waitFor(test, timeout = 5000, interval = 100) {
    const start = Date.now();
    return new Promise(resolve => {
      (function check() {
        try {
          if (test()) return resolve(true);
        } catch (_) {}
        if (Date.now() - start >= timeout) return resolve(false);
        setTimeout(check, interval);
      })();
    });
  }

  function parseXml(xml) {
    try {
      return new DOMParser().parseFromString(xml, "text/xml");
    } catch (_) {
      return null;
    }
  }

  function extractIds(xml) {
    const doc = parseXml(xml);
    if (!doc) return [];
    return Array.from(doc.querySelectorAll('*'))
      .map(n => n.getAttribute('id'))
      .filter(Boolean);
  }

  function findMalformedContainers(xml) {
    const doc = parseXml(xml);
    if (!doc) return [];
    return Array.from(doc.querySelectorAll('[cpRole="contentContainer"]'))
      .filter(n => n.children && n.children.length)
      .map(n => ({
        id: n.getAttribute('id') || '(no id)',
        childIds: Array.from(n.children).map(c => c.id || '(no id)')
      }));
  }

  function injectAlertContainer($) {
    let $alert = $('#toolkitAlert');
    if ($alert.length === 0) {
      try {
        $('#structureFile').parent().append(
          '<div id="toolkitAlert" style="margin:6px 0;font-size:13px"></div>'
        );
        $alert = $('#toolkitAlert');
      } catch (_) {
        // fallback
        const el = document.createElement('div');
        el.id = 'toolkitAlert';
        el.style.margin = '6px 0';
        el.style.fontSize = '13px';
        document.body.prepend(el);
        $alert = $(el);
      }
    }
    return $alert;
  }

  async function init() {
    window.XMLMajorChangeAlert.__loaded = true;

    // Only run on Layout Modify page
    const path = (location.pathname || '').toLowerCase();
    if (!path.includes('/admin/designcenter/layouts/modify')) return;

    // Honor CivicPlus detection if present
    if (window.CPToolkit?.isCivicPlusSite) {
      try {
        const ok = await window.CPToolkit.isCivicPlusSite();
        if (!ok) return;
      } catch (_) {}
    }

    // Wait for jQuery
    const ready = await waitFor(() => window.jQuery && document.readyState !== 'loading');
    if (!ready) return;

    const $ = window.jQuery;

    $(function () {
      try {
        const $alert = injectAlertContainer($);
        const originalXml = ($('code').first().text() || '').trim();
        const originalIds = extractIds(originalXml).sort();

        // Check malformed containers in existing XML
        const malformed = findMalformedContainers(originalXml);
        malformed.forEach(m => {
          alert(
            `The current XML is malformed:\n\n` +
            `${m.id} is a content container containing: \n\n${m.childIds.join('\n')}\n\n` +
            `Content containers must not contain other elements.`
          );
        });

        // Show #ErrorMessage content as popup
        $('#ErrorMessage')
          .off('.XMLMajorChangeAlert')
          .on('DOMSubtreeModified.XMLMajorChangeAlert', function () {
            const t = $(this).text().trim();
            if (t) alert(t);
          });

        // Add "View Layout Page"
        try {
          const layoutName = ($('#txtStructureName').val() || '').toString();
          if (layoutName) {
            const link = `/Pages/LayoutPage/?name=${encodeURIComponent(layoutName)}`;
            const li = $(
              `<li><a class='button bigButton nextAction' target='_blank' href='${link}'><span>View Layout Page</span></a></li>`
            );
            $('.buttons li a.save').parent('li').after(li);
          }
        } catch (_) {}

        // File reader
        $('#structureFile')
          .off('.XMLMajorChangeAlert')
          .on('change.XMLMajorChangeAlert', function () {
            const file = this.files && this.files[0];
            if (!file) {
              $alert.text('');
              return;
            }

            const reader = new FileReader();
            reader.onload = function (ev) {
              try {
                const raw = ev.target.result || '';
                const idx = raw.indexOf('<?xml');
                const newXml = idx >= 0 ? raw.slice(idx) : raw;
                const newIds = extractIds(newXml).sort();

                const removed = originalIds.filter(id => !newIds.includes(id));

                if (removed.length) {
                  $alert
                    .html(
                      `Warning: The new XML is missing existing containers:<br><br>` +
                      removed.join(', ')
                    )
                    .css('color', 'red');
                  $('a.button.save')
                    .css({
                      backgroundColor: '#B33A3A',
                      borderBottomColor: '#792327',
                      color: '#fff'
                    });
                  $('a.button.save span').text('Save ignoring XML warning');
                } else {
                  $alert.text('This XML keeps all existing containers.').css('color', 'green');
                  $('a.button.save').css({
                    backgroundColor: '',
                    borderBottomColor: '',
                    color: ''
                  });
                  $('a.button.save span').text('Save');
                }

                // new malformed containers
                const newMalformed = findMalformedContainers(newXml);
                newMalformed.forEach(m => {
                  alert(
                    `The chosen XML is malformed:\n\n` +
                    `${m.id} contains: \n\n${m.childIds.join('\n')}\n\n` +
                    `Content containers must not contain elements.`
                  );
                });
              } catch (err) {
                console.error('[XMLMajorChangeAlert] reader error', err);
              }
            };

            reader.readAsText(file);
          });
      } catch (err) {
        console.error('[XMLMajorChangeAlert] init error', err);
      }
    });
  }

  window.XMLMajorChangeAlert.init = init;

  try {
    init();
  } catch (err) {
    console.error('[XMLMajorChangeAlert] autorun error', err);
  }

})();

