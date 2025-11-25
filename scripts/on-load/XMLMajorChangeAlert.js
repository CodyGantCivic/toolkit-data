// XMLMajorChangeAlert.js
// Patched to attach handlers reliably (delegated + MutationObserver + visibilitychange)
// Exports: window.XMLMajorChangeAlert.init()

(function () {
  'use strict';

  var NAMESPACE = 'XMLMajorChangeAlert';
  var GUARD = '__CP_' + NAMESPACE + '_LOADED_v2';

  if (window[GUARD]) return;
  window[NAMESPACE] = window[NAMESPACE] || { __loaded: false };

  function waitFor(conditionFn, timeoutMs, intervalMs) {
    timeoutMs = typeof timeoutMs === 'number' ? timeoutMs : 5000;
    intervalMs = typeof intervalMs === 'number' ? intervalMs : 100;
    var start = Date.now();
    return new Promise(function (resolve) {
      (function check() {
        try {
          if (conditionFn()) return resolve(true);
        } catch (e) {}
        if (Date.now() - start >= timeoutMs) return resolve(false);
        setTimeout(check, intervalMs);
      })();
    });
  }

  function parseXmlToDoc(xmlString) {
    try {
      return new DOMParser().parseFromString(xmlString || '', 'text/xml');
    } catch (e) {
      return null;
    }
  }

  function extractIdsFromXml(xmlString) {
    try {
      var doc = parseXmlToDoc(xmlString || '');
      if (!doc) return [];
      return Array.prototype.slice.call(doc.querySelectorAll('*')).map(function (n) {
        try { return n.getAttribute && n.getAttribute('id'); } catch (e) { return null; }
      }).filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  function extractContentContainers(xmlString) {
    try {
      var doc = parseXmlToDoc(xmlString || '');
      if (!doc) return [];
      var nodes = Array.prototype.slice.call(doc.querySelectorAll('[cpRole="contentContainer"]'));
      return nodes.map(function (n) {
        try { return { id: n.getAttribute('id') || '', childCount: n.children ? n.children.length : 0, childIds: Array.prototype.slice.call(n.children).map(function(c){ return c.id || '(no id)'; }) }; }
        catch (e) { return { id: '', childCount: 0, childIds: [] }; }
      });
    } catch (e) {
      return [];
    }
  }

  function injectAlertContainerJQ($) {
    try {
      var $parent = $('#structureFile').parent();
      if ($parent && $parent.length) {
        if ($('#toolkitAlert').length === 0) {
          $parent.append('<div id="toolkitAlert" style="margin:6px 0;font-size:13px"></div>');
        }
        return $('#toolkitAlert');
      }
    } catch (e) {}
    // DOM fallback
    try {
      var el = document.getElementById('toolkitAlert');
      if (!el) {
        el = document.createElement('div');
        el.id = 'toolkitAlert';
        el.style.margin = '6px 0';
        el.style.fontSize = '13px';
        (document.body || document.documentElement).insertBefore(el, (document.body || document.documentElement).firstChild);
      }
      return window.jQuery ? window.jQuery(el) : null;
    } catch (e) {
      return null;
    }
  }

  // Internal state
  var originalXmlRaw = '';
  var originalIds = [];

  function computeOriginalFromDOM($) {
    try {
      originalXmlRaw = ($('code').first().text() || '').trim();
      originalIds = extractIdsFromXml(originalXmlRaw).sort();
    } catch (e) {
      originalXmlRaw = '';
      originalIds = [];
    }
  }

  function setupBindings($) {
    try {
      // Recompute original whenever the code block changes (some SPAs re-render it)
      // Use delegated mutation / polling fallback as needed
      // Delegate change handler so it captures inputs added later
      $(document).off('.XMLMajorChangeAlert', '#structureFile');
      $(document).on('change.XMLMajorChangeAlert', '#structureFile', function () {
        handleFileChange(this, $);
      });

      // Recompute originalXmlRaw now (useful if we navigated to the page late)
      computeOriginalFromDOM($);

      // If ErrorMessage appears later, show alerts
      $(document).off('.XMLMajorChangeAlert', '#ErrorMessage');
      $(document).on('DOMSubtreeModified.XMLMajorChangeAlert', '#ErrorMessage', function () {
        try {
          var t = $(this).text().trim();
          if (t) alert(t);
        } catch (e) {}
      });

      // Also observe the code block so originalXml updates if the page updates it
      var codeEl = document.querySelector('code');
      if (codeEl && window.MutationObserver) {
        // disconnect existing observer if any
        if (codeEl.__cp_xml_observer) codeEl.__cp_xml_observer.disconnect();
        var mo = new MutationObserver(function () { computeOriginalFromDOM($); });
        mo.observe(codeEl, { childList: true, subtree: true, characterData: true });
        codeEl.__cp_xml_observer = mo;
      }
    } catch (e) {
      console.error('[XMLMajorChangeAlert] setupBindings failed', e);
    }
  }

  function handleFileChange(inputEl, $) {
    try {
      var file = inputEl && inputEl.files && inputEl.files[0];
      if (!file) {
        try { $('#toolkitAlert').text(''); } catch (e) {}
        return;
      }

      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var data = ev && ev.target && ev.target.result ? ev.target.result : '';
          var idx = data.indexOf('<?xml');
          var newXml = idx >= 0 ? data.slice(idx) : data;

          // Compute new IDs and compare
          var newIds = extractIdsFromXml(newXml).sort();
          var removed = originalIds.filter(function (id) { return newIds.indexOf(id) < 0; });

          try {
            var $alert = $('#toolkitAlert');
            if (removed && removed.length) {
              var diffText = removed.join(', ');
              if ($alert && $alert.length) {
                $alert.html('Warning: There are containers in the old XML that are not in the new XML. This will cause any widgets or styles applied to the following to be lost:<br><br>' + diffText).css('color', 'red');
              } else {
                // fallback: create alert container then set
                var el = document.getElementById('toolkitAlert');
                if (el) el.innerHTML = 'Warning: ' + diffText;
              }
              $('a.button.save').css('background-color', '#B33A3A').css('border-bottom-color', '#792327').css('color', '#fff');
              $('a.button.save span').text('Save ignoring XML warning');
            } else {
              if ($alert && $alert.length) $alert.text('This XML has all the containers that the old XML had.').css('color', 'green');
              $('a.button.save').css('background-color', '').css('border-bottom-color', '').css('color', '');
              $('a.button.save span').text('Save');
            }
          } catch (uiErr) {
            console.error('[XMLMajorChangeAlert] UI update failed', uiErr);
          }

          // Validate for malformed content containers in new XML
          try {
            var newContainers = extractContentContainers(newXml);
            (newContainers || []).forEach(function (c) {
              try {
                if (c && c.childCount && c.childCount > 0) {
                  alert('The chosen XML is malformed:\n\n' + c.id + ' is a content container that contains additional elements. Content containers should not contain any elements. Please change this to a structural container or remove those elements.');
                }
              } catch (inner2) {}
            });
          } catch (validateErr) {
            console.error('[XMLMajorChangeAlert] validation failed', validateErr);
          }

        } catch (procErr) {
          console.error('[XMLMajorChangeAlert] file processing error', procErr);
        }
      };
      reader.readAsText(file);
    } catch (e) {
      console.error('[XMLMajorChangeAlert] handleFileChange error', e);
    }
  }

  function runSetup() {
    // wait for jQuery + DOM readiness
    waitFor(function () { return !!window.jQuery && document.readyState !== 'loading'; }, 6000, 100)
      .then(function (hasJQ) {
        if (!hasJQ) return;
        var $ = window.jQuery;

        try {
          // compute current original state and bind handlers (delegated)
          computeOriginalFromDOM($);
          setupBindings($);

          // best-effort DOM rearrangements (non-fatal)
          try {
            var $mainMenuBreakpoint = $('#mainMenuBreakpoint');
            if ($mainMenuBreakpoint && $mainMenuBreakpoint.length) {
              var $li = $mainMenuBreakpoint.parents('li.left').first();
              if ($li && $li.length) $('ol.cpForm > li.left:nth-child(4)').after($li);
            }
            var $err = $('#ErrorMessage');
            if ($err && $err.length) {
              var $errLi = $err.parents('li.left').first();
              if ($errLi && $errLi.length) $('ol.cpForm > li.left:nth-child(5)').after($errLi);
            }
          } catch (e) {}

          // Add "View Layout Page" button (if present)
          try {
            var layoutName = ($('#txtStructureName').val() || '').toString();
            if (layoutName) {
              var pagesUrl = '/Pages/LayoutPage/?name=' + encodeURIComponent(layoutName);
              var $pagesLink = $("<li><a class='button bigButton nextAction' href='" + pagesUrl + "' target='_blank'><span>View Layout Page</span></a></li>");
              $('.buttons li a.save').parent("li").after($pagesLink);
            }
          } catch (e) {}

          // ensure autorun hookup if SPA navigates away/back — re-run bindings on visibilitychange
          if (!document.__cp_xml_visibility_listener) {
            document.addEventListener('visibilitychange', function () {
              if (document.visibilityState === 'visible') {
                // recompute and re-bind (idempotent)
                try {
                  computeOriginalFromDOM(window.jQuery);
                  setupBindings(window.jQuery);
                } catch (e) {}
              }
            });
            document.__cp_xml_visibility_listener = true;
          }

        } catch (outerErr) {
          console.error('[XMLMajorChangeAlert] setup outer error', outerErr);
        }
      });
  }

  function init() {
    if (window[GUARD]) return;
    window[GUARD] = true;
    window[NAMESPACE].__loaded = true;

    // Only run on Layouts Modify page
    try {
      var path = (window.location.pathname || '').toLowerCase();
      if (path.indexOf('/admin/designcenter/layouts/modify') === -1) return;
    } catch (e) { return; }

    // If loader provides detection, use it but fall back if absent
    (function () {
      try {
        if (window.CPToolkit && typeof window.CPToolkit.isCivicPlusSite === 'function') {
          Promise.resolve(window.CPToolkit.isCivicPlusSite()).then(function (ok) {
            if (ok) runSetup();
          }).catch(function () { runSetup(); });
        } else {
          runSetup();
        }
      } catch (e) { runSetup(); }
    })();
  }

  // expose + autorun
  try { window.XMLMajorChangeAlert = window.XMLMajorChangeAlert || {}; window.XMLMajorChangeAlert.init = init; } catch (e) {}
  try { init(); } catch (e) { console.error('[XMLMajorChangeAlert] autorun error', e); }

})();

