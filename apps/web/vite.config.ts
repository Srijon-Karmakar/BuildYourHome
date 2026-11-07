import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/** Writes dist/sw.js: the service worker with the list of files that make the app open without internet. */
function offlineApp(): Plugin {
  let outDir = 'dist';
  return {
    name: 'plotframer-offline',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const root = join(fileURLToPath(new URL('.', import.meta.url)), outDir);
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const full = join(dir, name);
          if (statSync(full).isDirectory()) walk(full);
          else files.push('/' + relative(root, full).split(sep).join('/'));
        }
      };
      walk(root);
      // The shell: the page, scripts, styles, fonts and icons. Texture photos are kept when they are first used.
      const precache = ['/', ...files.filter((f) => f !== '/sw.js' && !f.endsWith('.map') && !f.startsWith('/textures/'))];
      const template = readFileSync(new URL('./sw.template.js', import.meta.url), 'utf8');
      const version = `${pkg.version}-${Date.now().toString(36)}`;
      writeFileSync(join(root, 'sw.js'), template.replace('__VERSION__', version).replace('[]; /* __PRECACHE__ */', `${JSON.stringify(precache)};`));
    },
  };
}

export default defineConfig({
  plugins: [react(), offlineApp()],
  server: { port: 5173 },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
});
