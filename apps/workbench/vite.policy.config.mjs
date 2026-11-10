import {defineConfig} from 'vite';
export default defineConfig({base:'./',publicDir:false,build:{outDir:'policy-dist',rollupOptions:{input:'policy.html'}}});
