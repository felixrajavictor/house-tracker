import { supabase } from './supabase'

const BUCKET = 'receipts'

/** Phone photos are 3–6 MB; shrink to ≤1600px JPEG so the free storage tier lasts the whole build. */
async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type.includes('heic') || file.type.includes('heif')) return file
  const bmp = await createImageBitmap(file).catch(() => null)
  if (!bmp) return file
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bmp.width * scale))
  canvas.height = Math.max(1, Math.round(bmp.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', quality))
}

export async function uploadReceipt(file: File): Promise<string> {
  const blob = await compressImage(file)
  const type = blob.type || file.type || 'application/octet-stream'
  const ext = type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'bin').toLowerCase()
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false })
  if (error) throw error
  return path
}

export async function removeReceipt(path: string) {
  await supabase.storage.from(BUCKET).remove([path])
}

export async function receiptUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}
