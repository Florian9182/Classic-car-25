#!/bin/sh
# Construit le site autonome dans site/ (index.html + data.json + manifest + sw + icônes)
cd "$(dirname "$0")"
mkdir -p site; python3 -c "import json,base64;[open('site/'+k,'wb').write(base64.b64decode(v)) for k,v in json.load(open('assets_b64.json')).items()]"; cp manifest.webmanifest sw.js site/
{ echo '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  echo '<meta name="robots" content="noindex, nofollow"><meta name="theme-color" content="#08080A"><link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icon-192.png"><link rel="apple-touch-icon" href="icon-180.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Radar CC25">'
  echo '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>'
  cat page_head.html; echo '</head><body>'; cat page_body.html
  echo "<script>"; grep -v "module.exports" engine.js; echo; cat ui.js; echo "</script></body></html>"; } > site/index.html
cp data.json site/data.json
rm -rf functions; cp -r site_functions functions
printf 'User-agent: *\nDisallow: /\n' > site/robots.txt
printf '/*\n  X-Robots-Tag: noindex\n  Referrer-Policy: no-referrer\n/data.json\n  Cache-Control: no-store\n' > site/_headers
