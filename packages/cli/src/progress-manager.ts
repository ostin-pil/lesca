import chalk from 'chalk'
import { SingleBar } from 'cli-progress'

import { logger } from '@/shared/utils/src/index'

export interface ProgressStats {
  total: number
  completed: number
  successful: number
  failed: number
  skipped: number
  cacheHits: number
  cacheMisses: number
  startTime: number
}

export interface ProgressUpdate {
  current: string
  status: 'fetching' | 'converting' | 'saving' | 'done' | 'error'
}

/**
 * Enhanced progress manager for batch scraping operations
 */
export class ProgressManager {
  private bar: SingleBar
  private stats: ProgressStats
  private currentItem: string = ''
  private currentStatus: string = ''

  constructor(total: number) {
    this.stats = {
      total,
      completed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      cacheHits: 0,
      cacheMisses: 0,
      startTime: Date.now(),
    }

    this.bar = new SingleBar({
      format: this.getFormat(),
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: true,
    })
  }

  /**
   * Start the progress bar
   */
  start(): void {
    this.bar.start(this.stats.total, 0, this.getPayload())
  }

  /**
   * Update progress for current item
   */
  update(update: Partial<ProgressUpdate>): void {
    if (update.current) {
      this.currentItem = update.current
    }
    if (update.status) {
      this.currentStatus = this.formatStatus(update.status)
    }

    this.bar.update(this.stats.completed, this.getPayload())
  }

  /**
   * Increment on successful completion
   */
  incrementSuccess(fromCache: boolean = false): void {
    this.stats.completed++
    this.stats.successful++
    if (fromCache) {
      this.stats.cacheHits++
    } else {
      this.stats.cacheMisses++
    }
    this.bar.update(this.stats.completed, this.getPayload())
  }

  /**
   * Increment on failure
   */
  incrementFailure(): void {
    this.stats.completed++
    this.stats.failed++
    this.bar.update(this.stats.completed, this.getPayload())
  }

  /**
   * Increment on skip
   */
  incrementSkip(): void {
    this.stats.completed++
    this.stats.skipped++
    this.bar.update(this.stats.completed, this.getPayload())
  }

  /**
   * Stop and finalize the progress bar
   */
  stop(): void {
    this.bar.stop()
  }

  /**
   * Get progress format string
   */
  private getFormat(): string {
    return (
      chalk.cyan('Progress') +
      ' {bar} ' +
      chalk.cyan('{percentage}%') +
      ' | {completed}/{total} | ' +
      chalk.green('✓{successful}') +
      ' ' +
      chalk.red('✗{failed}') +
      ' | {eta_formatted}\\n' +
      chalk.gray('  {current_item}') +
      ' {current_status}'
    )
  }

  /**
   * Get current payload for progress bar
   */
  private getPayload() {
    const eta = this.calculateETA()
    return {
      completed: this.stats.completed,
      total: this.stats.total,
      successful: this.stats.successful,
      failed: this.stats.failed,
      eta_formatted: this.formatETA(eta),
      current_item: this.currentItem,
      current_status: this.currentStatus,
    }
  }

  /**
   * Calculate ETA in seconds
   */
  private calculateETA(): number {
    if (this.stats.completed === 0) return 0

    const elapsed = (Date.now() - this.stats.startTime) / 1000
    const avgTimePerItem = elapsed / this.stats.completed
    const remaining = this.stats.total - this.stats.completed
    return Math.ceil(avgTimePerItem * remaining)
  }

  /**
   * Format ETA for display
   */
  private formatETA(seconds: number): string {
    if (seconds === 0) return chalk.gray('calculating...')
    if (seconds < 60) return chalk.cyan(`${seconds}s`)

    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return chalk.cyan(`${minutes}m ${secs}s`)
  }

  /**
   * Format status for display
   */
  private formatStatus(status: ProgressUpdate['status']): string {
    switch (status) {
      case 'fetching':
        return chalk.yellow('fetching...')
      case 'converting':
        return chalk.blue('converting...')
      case 'saving':
        return chalk.cyan('saving...')
      case 'done':
        return chalk.green('✓')
      case 'error':
        return chalk.red('✗')
      default:
        return ''
    }
  }

  /**
   * Get final summary
   */
  getSummary(): string {
    const elapsed = (Date.now() - this.stats.startTime) / 1000
    const minutes = Math.floor(elapsed / 60)
    const seconds = Math.ceil(elapsed % 60)
    const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`

    logger.log()
    logger.log(chalk.bold('Summary:'))
    logger.log(chalk.gray('─'.repeat(50)))
    logger.log(chalk.green('  Success:  '), `${this.stats.successful} problems`)
    if (this.stats.failed > 0) {
      logger.log(chalk.red('  Failed:   '), `${this.stats.failed} problems`)
    }
    if (this.stats.skipped > 0) {
      logger.log(chalk.yellow('  Skipped:  '), `${this.stats.skipped} problems`)
    }
    logger.log(chalk.gray('  Time:     '), timeStr)
    if (this.stats.cacheHits > 0 || this.stats.cacheMisses > 0) {
      logger.log(
        chalk.gray('  Cache:    '),
        `${this.stats.cacheHits} hits, ${this.stats.cacheMisses} misses`
      )
    }
    logger.log(chalk.gray('─'.repeat(50)))
    logger.log()

    return `Completed ${this.stats.successful}/${this.stats.total} problems in ${timeStr}`
  }
}
