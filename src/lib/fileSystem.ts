/**
 * Memory-safe File System Access API utilities with fallback to standard browser downloads.
 * Streams chunks directly to disk without holding multi-gigabyte blobs in memory.
 */

export async function saveTranscodedFile(
  outputBlob: Blob,
  suggestedName: string
): Promise<void> {
  // Try modern File System Access API (Chromium, Edge, Opera)
  if ('showSaveFilePicker' in window) {
    try {
      const extension = suggestedName.split('.').pop() || 'mp4'
      const handle = await (window as unknown as {
        showSaveFilePicker: (options: unknown) => Promise<FileSystemFileHandle>
      }).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'Video File',
            accept: {
              [`video/${extension === 'mkv' ? 'x-matroska' : extension}`]: [`.${extension}`],
            },
          },
        ],
      })

      const writable = await handle.createWritable()
      // Stream in chunks if blob is large
      const stream = outputBlob.stream()
      await stream.pipeTo(writable)
      return
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        // User cancelled picker dialog
        return
      }
      console.warn('File System Access API failed, falling back to download:', err)
    }
  }

  // Fallback for Firefox / Safari / standard download
  const url = URL.createObjectURL(outputBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
