import * as Comlink from 'comlink'
import type { TranscodeWorkerAPI } from '../types'

let rawWorker: Worker | null = null
let workerProxy: Comlink.Remote<TranscodeWorkerAPI> | null = null

export function getTranscodeWorker(): Comlink.Remote<TranscodeWorkerAPI> {
  if (!workerProxy) {
    rawWorker = new Worker(
      new URL('../workers/transcode.worker.ts', import.meta.url),
      { type: 'module' }
    )
    workerProxy = Comlink.wrap<TranscodeWorkerAPI>(rawWorker)
  }
  return workerProxy
}

export async function terminateWorker(): Promise<void> {
  if (workerProxy) {
    try {
      await workerProxy.cleanup()
    } catch {
      // Ignored
    }
    workerProxy = null
  }
  if (rawWorker) {
    rawWorker.terminate()
    rawWorker = null
  }
}
