// 아티팩트용 HTML 만들기: <html>/<head>/<body> 없이, React는 jsDelivr(npm 원본)에서, 나머지는 모두 인라인
import fs from 'fs';
const src = fs.readFileSync('dist-artifact/index.html', 'utf8');
const pick = (re) => { const m = src.match(re); return m ? m[0] : ''; };
const style = pick(/<style[^>]*>[\s\S]*?<\/style>/);
const scriptM = src.match(/<script[^>]*>([\s\S]*?)<\/script>/);
if (!scriptM) throw new Error('앱 스크립트를 찾지 못함');
const js = scriptM[1];
if (js.includes('</script')) throw new Error('스크립트 안에 닫는 태그가 있음');
const metas = [
  '<meta name="claude:viewport-fit-sides" content="cover">',
  pick(/<meta name="description"[^>]*>/),
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  pick(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/),
].filter(Boolean);
const react = [
  '<script src="https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js"></script>',
  '<script src="https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js"></script>',
];
const html = [
  '<title>리듬마을 프로토타입</title>',
  ...metas,
  style.replace(/<style[^>]*>/, '<style>'),
  ...react,
  '<div id="root"></div>',
  `<script>${js}</script>`,
].join('\n');
fs.mkdirSync('dist-artifact', { recursive: true });
fs.writeFileSync('dist-artifact/rhythm-village.html', html + '\n');
console.log('artifact html', (html.length / 1024).toFixed(1) + 'KB');
