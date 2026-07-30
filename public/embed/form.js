(function () {
  var currentScript = document.currentScript;
  var formId = currentScript && (currentScript.getAttribute('data-form') || currentScript.getAttribute('data-slug'));
  var targetSelector = currentScript && currentScript.getAttribute('data-target');
  var height = currentScript && currentScript.getAttribute('data-height');
  var origin = currentScript && currentScript.getAttribute('data-origin');

  if (!formId) {
    var fallbackHost = currentScript && currentScript.parentElement;
    var fallbackNode = fallbackHost && fallbackHost.querySelector('[data-poles-lead-form]');
    formId = fallbackNode && fallbackNode.getAttribute('data-poles-lead-form');
  }

  if (!formId) return;

  var container = targetSelector
    ? document.querySelector(targetSelector)
    : document.querySelector('[data-poles-lead-form="' + formId + '"]');

  if (!container && currentScript) {
    container = document.createElement('div');
    currentScript.parentNode.insertBefore(container, currentScript);
  }

  if (!container) return;

  var baseOrigin = origin || (currentScript ? new URL(currentScript.src).origin : window.location.origin);
  var iframe = document.createElement('iframe');
  iframe.src = baseOrigin + '/embed/form/' + encodeURIComponent(formId) + window.location.search;
  iframe.width = '100%';
  iframe.height = height || '720';
  iframe.loading = 'lazy';
  iframe.title = 'Polesheadlamp Lead Form';
  iframe.style.border = '0';
  iframe.style.display = 'block';
  iframe.style.width = '100%';
  iframe.style.maxWidth = '100%';
  iframe.setAttribute('allowtransparency', 'true');

  container.innerHTML = '';
  container.appendChild(iframe);
})();
