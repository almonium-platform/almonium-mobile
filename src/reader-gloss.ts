/** A reviewed note is already embedded as escaped text in the backend's book HTML. */
export const glossScript = `
  (function () {
    function show(target) {
      var anchor = target && target.closest && target.closest('.almonium-gloss[data-gloss-note]');
      if (!anchor) return false;
      var body = anchor.getAttribute('data-gloss-note');
      var quote = (anchor.textContent || '').trim();
      if (!body || body.length > 500 || !quote || quote.length > 160) return false;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'gloss', quote: quote, body: body }));
      return true;
    }
    document.addEventListener('click', function (event) {
      if (show(event.target)) event.stopPropagation();
    });
    document.addEventListener('keydown', function (event) {
      if ((event.key === 'Enter' || event.key === ' ') && show(event.target)) event.preventDefault();
    });
  })();
`;
