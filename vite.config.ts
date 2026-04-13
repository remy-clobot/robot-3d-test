import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue({ template: { transformAssetUrls } }),
    quasar({
      sassVariables: false,
    }),
  ],
  build: {
    // Node.js 백엔드의 정적 파일 폴더로 경로 지정 (예: backend 내부의 public 폴더)
    outDir: '../backend/public',
    // 프로젝트 루트 외부 폴더를 비울 때 발생하는 Vite 경고 방지
    emptyOutDir: true,
  }
})
