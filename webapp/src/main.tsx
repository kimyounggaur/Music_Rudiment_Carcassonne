import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './ui/App';
import { game } from './game/controller';
import * as PZ from './game/puzzle';
import { lastMode } from './game/aiRunner';
import './styles.css';

declare const __TARGET__: 'artifact' | 'web';
game.target = __TARGET__;
game.loadSkin();

if (__TARGET__ === 'web') {
  registerSW({ immediate: true });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); game.installPrompt = e; game.emit(); });
}

// 아티팩트 화면이 열린 채로 새 버전이 게시돼도 진행 중인 게임을 이어 가도록
try {
  (window as any).claude?.hot?.snapshot?.(() => {
    const st = game.stableState();
    return { save: st && !st.over && !game.tut && !game.puz ? { S: st, O: game.O } : null };
  });
} catch { /* 미리보기 환경 */ }

function boot(data: any) {
  createRoot(document.getElementById('root')!).render(<App />);
  const hot = data && data.save;
  if (hot && hot.S && !hot.S.over && hot.S.turn) game.resumeGame(hot.S, hot.O);
}
const hotApi = (window as any).claude?.hot;
if (hotApi && typeof hotApi.ready === 'function') hotApi.ready(boot);
else boot(hotApi?.data ?? {});

// 브라우저 검증용 접근점
(window as any).__rv = game;
(window as any).__pz = PZ;
Object.defineProperty(window, '__aiMode', { get: () => lastMode });
