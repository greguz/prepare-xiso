import { access, mkdir, open } from 'node:fs/promises'

export async function exists (path, mode) {
  try {
    await access(path, mode)
    return true
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false
    } else {
      return Promise.reject(err)
    }
  }
}

export async function ensureDir (path) {
  const ok = await exists(path)
  if (!ok) {
    await mkdir(path)
  }
  // TODO: check if file?
}

export async function processFile (path, flags, mode, handler) {
  const fh = await open(path, flags, mode)
  try {
    return await handler(fh)
  } finally {
    await fh.close()
  }
}
