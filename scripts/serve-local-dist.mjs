import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = new Map(
  process.argv.slice(2).reduce((pairs, arg, index, allArgs) => {
    if (arg.startsWith('--')) {
      pairs.push([arg.slice(2), allArgs[index + 1]])
    }
    return pairs
  }, []),
)

const root = resolve(args.get('root') ?? 'dist')
const host = args.get('host') ?? '127.0.0.1'
const port = Number(args.get('port') ?? 5173)

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
}

function resolveAssetFallback(pathname) {
  const match = pathname.match(/^\/assets\/(.+)-[A-Za-z0-9_-]+\.(css|js)$/)

  if (!match) return null

  const [, chunkName, extension] = match
  const assetsDir = join(root, 'assets')

  if (!existsSync(assetsDir)) return null

  const candidates = readdirSync(assetsDir)
    .filter((name) => name.startsWith(`${chunkName}-`) && name.endsWith(`.${extension}`))
    .map((name) => {
      const filePath = join(assetsDir, name)
      return { filePath, mtimeMs: statSync(filePath).mtimeMs }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)

  return candidates[0]?.filePath ?? null
}

function resolveRequestPath(pathname) {
  const decodedPathname = decodeURIComponent(pathname.split('?')[0] || '/')
  const relativePath = decodedPathname === '/' ? 'index.html' : decodedPathname.slice(1)
  const requestedPath = normalize(join(root, relativePath))
  const rootWithSeparator = root.endsWith(sep) ? root : `${root}${sep}`

  if (requestedPath !== root && !requestedPath.startsWith(rootWithSeparator)) {
    return null
  }

  if (existsSync(requestedPath) && statSync(requestedPath).isFile()) {
    return { filePath: requestedPath }
  }

  const fallbackAsset = resolveAssetFallback(decodedPathname)

  if (fallbackAsset) {
    return { filePath: fallbackAsset }
  }

  return { filePath: join(root, 'index.html') }
}

function sendFile(response, filePath) {
  const extension = extname(filePath)

  response.writeHead(200, {
    'Cache-Control': 'no-store, max-age=0',
    'Content-Type': contentTypes[extension] ?? 'application/octet-stream',
  })

  createReadStream(filePath).pipe(response)
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `${host}:${port}`}`)
  const resolvedPath = resolveRequestPath(url.pathname)

  if (!resolvedPath) {
    response.writeHead(403, { 'Cache-Control': 'no-store, max-age=0' })
    response.end('Forbidden')
    return
  }

  if ('inline' in resolvedPath) {
    response.writeHead(200, {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Type': resolvedPath.type,
    })
    response.end(resolvedPath.inline)
    return
  }

  sendFile(response, resolvedPath.filePath)
})

server.listen(port, host, () => {
  const scriptPath = fileURLToPath(import.meta.url)
  console.log(`Serving ${root} at http://${host}:${port} (${scriptPath})`)
})
