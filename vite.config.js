import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

// Vite plugin: generates public/firebase-messaging-sw.js from the template
// by replacing __VITE_FIREBASE_*__ placeholders with real env values.
// The generated file is gitignored; the template is what gets committed.
function serviceWorkerEnvPlugin() {
  return {
    name: 'sw-env-inject',
    buildStart() {
      const templatePath = resolve(__dirname, 'public/firebase-messaging-sw.template.js')
      const outPath      = resolve(__dirname, 'public/firebase-messaging-sw.js')

      let template = readFileSync(templatePath, 'utf-8')

      const vars = [
        'VITE_FIREBASE_API_KEY',
        'VITE_FIREBASE_AUTH_DOMAIN',
        'VITE_FIREBASE_PROJECT_ID',
        'VITE_FIREBASE_STORAGE_BUCKET',
        'VITE_FIREBASE_MESSAGING_SENDER_ID',
        'VITE_FIREBASE_APP_ID',
      ]

      for (const key of vars) {
        const value = process.env[key] || ''
        template = template.replaceAll(`__${key}__`, value)
      }

      writeFileSync(outPath, template, 'utf-8')
    },
  }
}

export default defineConfig(({ mode }) => {
  // Load env so process.env is populated before the plugin runs
  const env = loadEnv(mode, process.cwd(), '')
  for (const [k, v] of Object.entries(env)) {
    if (!(k in process.env)) process.env[k] = v
  }

  return {
    plugins: [react(), serviceWorkerEnvPlugin()],
  }
})
