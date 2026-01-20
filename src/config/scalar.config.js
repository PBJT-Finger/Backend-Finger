// src/config/scalar.config.js - Hide Models for cleaner docs

function generateScalarHTML(spec) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Finger API Documentation</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  
  <style>
    body { 
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
  </style>
</head>
<body>

  <!-- Scalar Documentation Mount Point -->
  <script 
    id="api-reference" 
    data-url="/finger-api/docs-json"
    data-proxy-url="https://proxy.scalar.com"
  ></script>
  
  <!-- Client Logic -->
  <script>
    (function() {
        const scriptTag = document.getElementById('api-reference');
        
        // Features Config
        scriptTag.setAttribute('data-layout', 'modern');
        scriptTag.setAttribute('data-show-sidebar', 'true');
        scriptTag.setAttribute('data-hide-models', 'true');  // Hide Models section
        scriptTag.setAttribute('data-is-editable', 'false');

        // Set dark mode by default
        scriptTag.setAttribute('data-dark-mode', 'true');
    })();
  </script>

  <!-- Load Scalar Library -->
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
}

module.exports = { generateScalarHTML };
