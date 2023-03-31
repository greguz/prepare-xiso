import { createReadStream, createWriteStream } from 'node:fs'
import { readdir, rename, unlink, writeFile } from 'node:fs/promises'
import * as path from 'node:path'
import { pipeline } from 'node:stream/promises'

import { getAttachXbeBuffer } from './lib/attach.js'
import { ensureDir, processFile } from './lib/fs.js'
import { injectXbeInfo } from './lib/inject.js'
import { getXisoInfo, traverseNodes } from './lib/xiso.js'

const maxSize = 4294967296 // 4 GiB (bytes)

const options = {
  // move source iso into this dir
  // create attach xbe
  // keep original default xbe
  noSplit: false,
  beQuiet: false
}

if (!process.argv[2]) {
  throw new Error('no dir')
}

await splitDir(process.argv[2])

async function splitDir (dir) {
  const items = await readdir(dir)

  for (const item of items) {
    if (/\.iso$/i.test(item)) {
      console.log(`processing ${item}`)

      try {
        await splitFile(path.join(dir, item))
      } catch (err) {
        console.error(err)
      }
    }
  }
}

async function splitFile (file) {
  const parsed = path.parse(file)
  if (!parsed.ext) {
    throw new Error()
  }

  const dir = path.join(parsed.dir, parsed.name)
  await ensureDir(dir)

  await writeFile(
    path.join(dir, 'default.xbe'),
    getAttachXbeBuffer()
  )

  const { sectorSize, size, splitSector } = await processFile(
    file,
    'r',
    undefined,
    fh => analyzeIsoAndExtractXbe(fh, dir)
  )

  if (size < maxSize) {
    await rename(
      file,
      path.join(dir, 'game.iso')
    )
  } else {
    await ensureDir(path.join(dir, '_big'))

    await pipeline(
      createReadStream(file, {
        start: 0,
        end: (splitSector * sectorSize) - 1
      }),
      createWriteStream(
        path.join(dir, 'game.1.iso')
      )
    )

    await pipeline(
      createReadStream(file, {
        start: splitSector * sectorSize
      }),
      createWriteStream(
        path.join(dir, 'game.2.iso')
      )
    )

    await rename(
      file,
      path.join(parsed.dir, '_big', parsed.name)
    )
  }
}

async function analyzeIsoAndExtractXbe (fh, dir) {
  const info = await getXisoInfo(fh)
  if (!info) {
    throw new Error()
  }

  const xbe = await find(
    traverseNodes(fh, info),
    node => !node.directory && node.name.toLowerCase() === 'default.xbe'
  )

  if (xbe) {
    const buffer = Buffer.alloc(xbe.size)

    await fh.read({
      buffer,
      position: xbe.position
    })

    await writeFile(
      path.join(dir, 'default.orig.xbe'),
      buffer
    )

    await injectXbeInfo(
      path.join(dir, 'default.orig.xbe'),
      path.join(dir, 'default.xbe')
    )

    await unlink(
      path.join(dir, 'default.orig.xbe')
    )
  }

  const stats = await fh.stat()

  if (stats.size % info.sectorSize !== 0) {
    throw new Error()
  }

  const totalSectors = Math.ceil(stats.size / info.sectorSize)
  const splitSector = Math.ceil(totalSectors / 2)

  return {
    sectorSize: info.sectorSize,
    size: stats.size,
    splitSector,
    totalSectors
  }
}

async function find (iterable, predicate) {
  let index = 0
  for await (const item of iterable) {
    if (predicate(item, index++)) {
      return item
    }
  }
}
