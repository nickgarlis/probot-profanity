const createScheduler = require('probot-scheduler')
const Filter = require('bad-words-relaxed')
const Profanity = require('./lib/profanity')

module.exports = async robot => {
  // Visit all repositories to mark and sweep stale issues
  const scheduler = createScheduler(robot)

  const events = [
    'issues.edited',
    'pull_request.edited'
  ]

  robot.on(events, unmark)
  robot.on('schedule.repository', markAndSweep)

  async function unmark (context) {
    if (!context.isBot) {
      const filter = new Filter()
      const profanity = await forRepository(context)
      let issue = context.payload.issue || context.payload.pull_request
      const type = context.payload.issue ? 'issues' : 'pulls'

      // Some payloads don't include labels
      if (!issue.labels) {
        issue = (await context.github.issues.get(context.issue())).data
      }

      const profanityLabelAdded = context.payload.action === 'labeled' &&
        context.payload.label.name === profanity.config.profanityLabel

      if (profanity.hasProfanityLabel(type, issue) && issue.state !== 'closed' && !profanityLabelAdded) {
        if (!filter.isProfane(issue.title + ' ' + issue.body)) {
          profanity.unmark(type, issue)
        }
      }
    }
  }

  async function markAndSweep (context) {
    const profanity = await forRepository(context)
    await profanity.markAndSweep('pulls')
    await profanity.markAndSweep('issues')
  }

  async function forRepository (context) {
    let config = await context.config('profanity.yml')

    if (!config) {
      scheduler.stop(context.payload.repository)
      // Don't actually perform for repository without a config
      config = {perform: false}
    }

    config = Object.assign(config, context.repo({logger: robot.log}))

    return new Profanity(context.github, config)
  }
}
