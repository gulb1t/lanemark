/**
 * Centre-crops an image file to a square and downsizes it to a small JPEG data URL so profile
 * photos stay light enough to live in localStorage (roughly 10–30 KB each).
 */
export async function fileToAvatar(file: File, size = 256): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.')
  const bitmap = await createImageBitmap(file)
  try {
    const side = Math.min(bitmap.width, bitmap.height)
    const sx = (bitmap.width - side) / 2
    const sy = (bitmap.height - side) / 2
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is not available in this browser.')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)
    return canvas.toDataURL('image/jpeg', 0.82)
  } finally {
    bitmap.close()
  }
}
