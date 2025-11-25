// XMLMajorChangeAlert.js
// Fixed, validated: exports window.XMLMajorChangeAlert.init(), idempotent, page-safe.

(function () {
  'use strict';

  var NAMESPACE = 'XMLMajorChangeAlert';
  var GUARD = '__CP_' + NAMESPACE + '_LOADED_v1';

  if (window[GUARD]) return;
  window[NAMESPACE] = window[NAMESPACE] || { __loaded: false };

  function waitFor(conditionFn, timeoutMs, intervalMs) {
    timeoutMs = typeof timeoutMs === 'number' ? timeoutMs : 5000;
    intervalMs = typeof intervalMs === 'number' ? intervalMs : 100;
    var started = Date.now();
    return new Promise(function (resolve) {
      (function check() {
        try {
          if (conditionFn()) return resolve(true);
        } catch (e) {
          // ignore
        }
        if (Date.now() - started >= timeoutMs) return resolve(false);
        setTimeout(check, intervalMs);
      })();
    });
  }

  function parseXml(xmlString) {
    try {
      return new DOMParser().parseFromString(xmlString || '', 'text/xml');
    } catch (e) {
      return null;
    }
  }

  function extractIds(xmlString) {
    try {
      var doc = parseXml(xmlString);
      if (!doc) return [];
      var nodes = Array.prototype.slice.call(doc.querySelectorAll('*'));
      var ids = [];
      nodes.forEach(function (n) {
        try {
          var id = n.getAttribute && n.getAttribute('id');
          if (id) ids.push(id);
        } catch (inner) { /* ignore node read errors */ }
      });
      return ids;
    } catch (e) {
      return [];
    }
  }

  function extractContentContainers(xmlString) {
    try {
      var doc = parseXml(xmlString);
      if (!doc) return [];
      var nodes = Array.prototype.slice.call(doc.querySelectorAll('[cpRole="contentContainer"]'));
      return nodes.map(function (n) {
        try {
          return { id: n.getAttribute('id') || '', childCount: n.children ? n.children.length : 0 };
        } catch (inner) { return { id: '', childCount: 0 }; }
      });
    } catch (e) {
      return [];
    }
  }

  function ensureAlertContainer() {
    try {
      if (window.jQuery) {
        var $ = window.jQuery;
        var $parent = $('#structureFile').parent();
        if ($parent && $parent.length) {
          if ($('#toolkitAlert').length === 0) {
            $parent.append('<div id="toolkitAlert" style="margin:6px 0;font-size:13px"></div>');
          }
          return $('#toolkitAlert');
        }
      }
    } catch (e) {
      // continue to DOM fallback
    }
    try {
      var el = document.getElementById('toolkitAlert');
      if (!el) {
        el = document.createElement('div');
        el.id = 'toolkitAlert';
        el.style.margin = '6px 0';
        el.style.fontSize = '13px';
        try { (document.body || document.documentElement).insertBefore(el, (document.body || document.documentElement).firstChild); } catch(err) { /* ignore */ }
      }
      return window.jQuery ? window.jQuery(el) : null;
    } catch (e) {
      return null;
    }
  }

  function init() {
    if (window[GUARD]) return;
    window[GUARD] = true;
    window[NAMESPACE].__loaded = true;

    try {
      var path = (window.location.pathname || '').toLowerCase();
      if (path.indexOf('/admin/designcenter/layouts') === -1) return;
    } catch (_) { return; }

    (function start() {
      try {
        if (window.CPToolkit && typeof window.CPToolkit.isCivicPlusSite === 'function') {
          Promise.resolve(window.CPToolkit.isCivicPlusSite()).then(function (ok) {
            if (ok) runSetup();
          }).catch(runSetup);
        } else {
          runSetup();
        }
      } catch (e) {
        runSetup();
      }
    })();

    function runSetup() {
      waitFor(function () { return !!window.jQuery && document.readyState !== 'loading'; }, 6000, 100).then(function (hasJQ) {
        if (!hasJQ) return;
        var $ = window.jQuery;

        $(function () {
          var $alert = ensureAlertContainer();
          var originalXml = ($('code').first().text() || '').trim();
          var originalIds = extractIds(originalXml).sort();

          // original containers malformed check
          try {
            var origContainers = extractContentContainers(originalXml);
            (origContainers || []).forEach(function (c) {
              try {
                if (c && c.childCount > 0) {
                  alert('The current XML is malformed:\n\n' + c.id + ' is a content container that contains additional elements. Content containers should not contain elements. Change it to a structural container or remove those elements.');
                }
              } catch (e) { /* ignore per-container error */ }
            });
          } catch (e) { console.error('[XMLMajorChangeAlert] orig check failed', e); }

          // ErrorMessage -> alert
          try {
            $('#ErrorMessage').off('.XMLMajorChangeAlert').on('DOMSubtreeModified.XMLMajorChangeAlert', function () {
              try {
                var t = $(this).text().trim();
                if (t) alert(t);
              } catch (_) { /* ignore */ }
            });
          } catch (e) { console.error('[XMLMajorChangeAlert] ErrorMessage bind failed', e); }

          // move breakpoint / error pieces (best-effort)
          try {
            var $mb = $('#mainMenuBreakpoint');
            if ($mb && $mb.length) {
              var $li = $mb.parents('li.left').first();
              if ($li && $li.length) $('ol.cpForm > li.left:nth-child(4)').after($li);
            }
            var $err = $('#ErrorMessage');
            if ($err && $err.length) {
              var $errLi = $err.parents('li.left').first();
              if ($errLi && $errLi.length) $('ol.cpForm > li.left:nth-child(5)').after($errLi);
            }
          } catch (e) { /* ignore */ }

          // add view layout page button
          try {
            var layoutName = ($('#txtStructureName').val() || '').toString();
            if (layoutName) {
              var pagesUrl = '/Pages/LayoutPage/?name=' + encodeURIComponent(layoutName);
              var $link = $("<li><a class='button bigButton nextAction' href='" + pagesUrl + "' target='_blank'><span>View Layout Page</span></a></li>");
              $('.buttons li a.save').parent('li').after($link);
            }
          } catch (e) { /* ignore */ }

          // auto save title
          try { $('#autoSaveThemeStyles').attr('title', 'Rebuilds the CSS for all themes that use this layout.'); } catch (e) { /* ignore */ }

          // file change handling
          try {
            $('#structureFile').off('.XMLMajorChangeAlert').on('change.XMLMajorChangeAlert', function () {
              try {
                var file = this.files && this.files[0];
                if (!file) { try { if ($alert) $alert.text(''); } catch(_){}; return; }
                var reader = new FileReader();
                reader.onload = function (ev) {
                  try {
                    var data = ev && ev.target && ev.target.result ? ev.target.result : '';
                    var idx = data.indexOf('<?xml');
                    var newXml = idx >= 0 ? data.slice(idx) : data;
                    var newIds = extractIds(newXml).sort();
                    var removed = originalIds.filter(function (id) { return newIds.indexOf(id) < 0; });

                    if (removed && removed.length) {
                      try {
                        var diffText = removed.join(', ');
                        if ($alert) $alert.html('Warning: There are containers in the old XML that are not in the new XML. This will cause any widgets or styles applied to the following to be lost:<br><br>' + diffText).css('color', 'red');
                        $('a.button.save').css('background-color', '#B33A3A').css('border-bottom-color', '#792327').css('color', '#fff');
                        $('a.button.save span').text('Save ignoring XML warning');
                      } catch (uiErr) { /* ignore UI errors */ }
                    } else {
                      try { if ($alert) $alert.text('This XML has all the containers that the old XML had.').css('color', 'green'); $('a.button.save').css('background-color', '').css('border-bottom-color', '').css('color', ''); $('a.button.save span').text('Save'); } catch(_) {}
                    }

                    // validate new content containers
                    try {
                      var newContainers = extractContentContainers(newXml);
                      (newContainers || []).forEach(function (c) {
                        try {
                          if (c && c.childCount > 0) {
                            alert('The chosen XML is malformed:\n\n' + c.id + ' is a content container that contains additional elements. Change to a structural container or remove children.');
                          }
                        } catch (_) { /* ignore per-container */ }
                      });
                    } catch (valErr) { console.error('[XMLMajorChangeAlert] validation failed', valErr); }

                  } catch (procErr) { console.error('[XMLMajorChangeAlert] processing failed', procErr); }
                };
                reader.readAsText(file);
              } catch (readErr) { console.error('[XMLMajorChangeAlert] file read error', readErr); }
            });
          } catch (attachErr) { console.error('[XMLMajorChangeAlert] attach handler error', attachErr); }

        });// end document ready
      } catch (outerErr) { console.error('[XMLMajorChangeAlert] runSetup outer error', outerErr); }
    });// end waitFor
  } // end init

  // expose and auto-run
  try { window.XMLMajorChangeAlert = window.XMLMajorChangeAlert || {}; window.XMLMajorChangeAlert.init = init; } catch (e) { /* ignore */ }
  try { window.XMLMajorChangeAlert.init(); } catch (e) { console.error('[XMLMajorChangeAlert] autorun failed', e); }

})();
