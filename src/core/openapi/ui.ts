export function getSwaggerHtml(specUrl: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>API Docs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; }
    #swagger-ui { height: 100%; }
    .tenant-bar { padding: 8px; background: #f5f5f5; border-bottom: 1px solid #e5e5e5; }
    .tenant-bar input { padding: 6px; width: 280px; }
  </style>
</head>
<body>
  <div class="tenant-bar">
    <label>
      Tenant ID: <input id="tenant-id-input" placeholder="kuaforun" />
    </label>
    <button id="tenant-save">Save</button>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    (function(){
      function getTenant(){
        try { return localStorage.getItem('swagger_tenant') || 'kuaforun'; } catch(e){ return 'kuaforun'; }
      }
      function saveTenant(val){
        try { localStorage.setItem('swagger_tenant', val || 'kuaforun'); } catch(e){}
      }
      window.addEventListener('DOMContentLoaded', function(){
        var input = document.getElementById('tenant-id-input');
        var btn = document.getElementById('tenant-save');
        if(input){ input.value = getTenant(); }
        if(btn){ btn.addEventListener('click', function(){ saveTenant(input && input.value ? input.value : 'kuaforun'); alert('Tenant saved'); }); }
      });
      window.ui = SwaggerUIBundle({
        url: '${specUrl}',
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis],
        layout: 'BaseLayout',
        deepLinking: true,
        docExpansion: 'none',
        requestInterceptor: function(req){
          try {
            req.headers = req.headers || {};
            if(!req.headers['X-Tenant-Id']) { req.headers['X-Tenant-Id'] = getTenant(); }
          } catch(e){}
          return req;
        }
      });
    })();
  </script>
</body>
</html>`
}