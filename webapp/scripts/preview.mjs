// 로컬 확인용: 아티팩트 뼈대와 비슷하게 감싸고, CDN 대신 로컬 React·글꼴 사용 (게시본에는 쓰지 않음)
import fs from 'fs';
const body = fs.readFileSync('dist-artifact/rhythm-village.html', 'utf8')
  .replace('https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js', '../node_modules/react/umd/react.production.min.js')
  .replace('https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js', '../node_modules/react-dom/umd/react-dom.production.min.js');
const fonts = ['jua/400.css', 'ibm-plex-sans-kr/400.css', 'ibm-plex-sans-kr/500.css', 'ibm-plex-sans-kr/600.css', 'ibm-plex-sans-kr/700.css']
  .map((f) => `<link rel="stylesheet" href="../../node_modules/@fontsource/${f}">`).join('');
fs.writeFileSync('dist-artifact/preview.html', `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">${fonts}
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${body}</body></html>`);
console.log('preview ready');
