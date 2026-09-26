/* ------------------------------------------------------------------
   Per-file syntax / import check that does not touch dist/.
   Runs each file through Vite's transform pipeline (JSX, CSS, import
   resolution) so several people can verify their own pages at the
   same time without a full build.

     node scripts/check.mjs src/pages/Results.jsx src/pages/results.css
   ------------------------------------------------------------------ */
import { createServer } from 'vite'

const files = process.argv.slice(2)
if (!files.length) {
  console.error('usage: node scripts/check.mjs <file> [<file> ...]')
  process.exit(2)
}

const server = await createServer({
  configFile: 'vite.config.js',
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
})

let failed = 0
for (const f of files) {
  const url = '/' + f.replace(/\\/g, '/').replace(/^\.\//, '')
  try {
    const res = await server.transformRequest(url)
    if (!res) throw new Error('Vite returned no result (does the file exist?)')
    console.log(`OK    ${f}`)
  } catch (err) {
    failed++
    const msg = (err && (err.frame ? `${err.message}\n${err.frame}` : err.message)) || String(err)
    console.log(`FAIL  ${f}\n${msg}\n`)
  }
}
await server.close()
process.exit(failed ? 1 : 0)
