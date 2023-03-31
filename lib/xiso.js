export async function * traverseNodes (fh, info) {
  const nodes = [{
    offset: 0,
    path: '.',
    position: info.rootDirSector * info.sectorSize,
    size: info.rootDirSize
  }]

  while (nodes.length > 0) {
    const node = nodes.pop()

    let buffer = node.buffer
    if (!buffer) {
      buffer = Buffer.alloc(node.size)
      await fh.read({
        buffer,
        position: node.position
      })
    }

    // cast offset to bytes
    const offset = node.offset * 4

    const left = buffer.readUint16LE(offset + 0)
    if (left === 0xFFFF) {
      // TODO: why? eof?
      continue
    }

    const right = buffer.readUint16LE(offset + 2)
    const sector = buffer.readUInt32LE(offset + 4)
    const size = buffer.readUInt32LE(offset + 8)
    const attribute = buffer.readUInt8(offset + 12)
    const length = buffer.readUInt8(offset + 13)

    const name = buffer
      .subarray(offset + 14, offset + 14 + length)
      .toString('ascii')
      .toLowerCase()

    const path = node.path + '/' + name

    // 32 > 0x20 > 00100000
    // 16 > 0x10 > 00010000

    // https://xboxdevwiki.net/XDVDFS
    //
    // READONLY = 0x01
    // HIDDEN = 0x02
    // SYSTEM = 0x04
    // DIRECTORY = 0x10
    // ARCHIVE = 0x20
    // NORMAL = 0x80
    const directory = (attribute & 0x10) > 0

    yield {
      directory,
      sector,
      position: sector * info.sectorSize,
      size,
      attribute,
      name,
      path
    }

    if (left > 0) {
      nodes.push({
        ...node,
        buffer,
        offset: left
      })
    }

    if (right > 0) {
      nodes.push({
        ...node,
        buffer,
        offset: right
      })
    }

    if (directory) {
      nodes.push({
        offset: 0,
        path: node.path + '/' + name,
        position: sector * info.sectorSize,
        size
      })
    }
  }
}

export async function getXisoInfo (fh) {
  const sectorSize = 2048 // bytes

  const sector = await readSector(fh, sectorSize, 32)

  if (sector.subarray(0, 20).toString('ascii') !== 'MICROSOFT*XBOX*MEDIA') {
    // not a xiso
    return null
  }

  return {
    rootDirSector: sector.readUint32LE(0x14),
    rootDirSize: sector.readUint32LE(0x18),
    sectorSize
  }
}

export async function readSector (fh, sectorSize, sectorIndex) {
  const buffer = Buffer.alloc(sectorSize)
  await fh.read({
    buffer,
    position: sectorIndex * sectorSize
  })
  return buffer
}
