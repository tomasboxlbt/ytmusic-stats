import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** Genera /ads.txt (requerido por AdSense) a partir de VITE_ADSENSE_CLIENT. */
function adsTxt(client: string | undefined): Plugin {
  const pub = client?.replace(/^ca-/, '')
  const body = pub ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` : null
  return {
    name: 'ads-txt',
    configureServer(server) {
      server.middlewares.use('/ads.txt', (_req, res, next) => {
        if (!body) return next()
        res.setHeader('Content-Type', 'text/plain')
        res.end(body)
      })
    },
    generateBundle() {
      if (body) this.emitFile({ type: 'asset', fileName: 'ads.txt', source: body })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    plugins: [react(), adsTxt(env.VITE_ADSENSE_CLIENT)],
  }
})
