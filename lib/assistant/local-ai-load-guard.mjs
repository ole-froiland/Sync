export class LocalAiLoadGuard {
  constructor({ maxPending = 2, maxPerWindow = 8, windowMs = 60_000 } = {}) {
    this.maxPending = maxPending
    this.maxPerWindow = maxPerWindow
    this.windowMs = windowMs
    this.pending = 0
    this.starts = []
  }

  tryStart(now = Date.now()) {
    this.starts = this.starts.filter((startedAt) => now - startedAt < this.windowMs)
    if (this.pending >= this.maxPending || this.starts.length >= this.maxPerWindow) return false
    this.pending += 1
    this.starts.push(now)
    return true
  }

  finish() {
    this.pending = Math.max(0, this.pending - 1)
  }
}
