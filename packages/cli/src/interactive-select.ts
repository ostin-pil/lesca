import chalk from 'chalk'
import inquirer from 'inquirer'

interface Problem {
  titleSlug: string
  title: string
  difficulty: string
  questionFrontendId: string
  isPaidOnly: boolean
}

export interface InteractiveSelectOptions {
  message?: string
  multiSelect?: boolean
  pageSize?: number
}

/**
 * Interactive problem selector
 */
export class InteractiveSelector {
  /**
   * Present an interactive selection UI for problems
   */
  static async selectProblems(
    problems: Problem[],
    options: InteractiveSelectOptions = {}
  ): Promise<string[]> {
    const { message = 'Select problems to scrape:', multiSelect = true, pageSize = 10 } = options

    if (problems.length === 0) {
      return []
    }

    const choices = problems.map((p) => {
      const id = chalk.gray(p.questionFrontendId.padEnd(5))
      const difficulty = this.formatDifficulty(p.difficulty)
      const status = p.isPaidOnly ? chalk.yellow(' 🔒') : ''
      const title = `${id} ${p.title}`

      return {
        name: `${title} ${difficulty}${status}`,
        value: p.titleSlug,
        short: p.title,
      }
    })

    if (multiSelect) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const answers = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selected',
          message: chalk.cyan(message),
          choices,
          pageSize,
          loop: false,
        },
      ])
      return (answers as { selected: string[] }).selected
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'selected',
          message: chalk.cyan(message),
          choices,
          pageSize,
          loop: false,
        },
      ])
      return [(answers as { selected: string }).selected]
    }
  }

  /**
   * Confirm action with user
   */
  static async confirm(message: string, defaultValue: boolean = true): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: chalk.cyan(message),
        default: defaultValue,
      },
    ])
    return (answers as { confirmed: boolean }).confirmed
  }

  /**
   * Format difficulty with color
   */
  private static formatDifficulty(difficulty: string): string {
    const formatted = `(${difficulty})`
    if (difficulty === 'Easy') return chalk.green(formatted)
    if (difficulty === 'Medium') return chalk.yellow(formatted)
    if (difficulty === 'Hard') return chalk.red(formatted)
    return chalk.gray(formatted)
  }
}
