import { defineConfig } from 'vite';

// 페이지 3개: 게임(index), 캐릭터 도감(characters), 집 컴퓨터로 하는 인형뽑기(claw)
export default defineConfig({
  base: './',
  resolve: { dedupe: ['three'] },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
    rollupOptions: { input: { index: 'index.html', characters: 'characters.html', claw: 'claw.html' } },
  },
});
