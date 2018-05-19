const getConfig = require('probot-config')
const createScheduler = require('probot-scheduler')
const Profanity = require('./lib/profanity')

module.exports = async robot => {
  const scheduler = createScheduler(robot)

  const targetEvents = [
    'issues.opened',
    'issues.edited',
    'issue_comment.created',
    'issue_comment.edited',
    'pull_request.opened',
    'pull_request.edited'
  ]

  const unmarkEvents = [
    'issues.edited',
    'issue_comment.edited',
    'pull_request.edited'
  ]

  robot.on(targetEvents, targetIssue)
  robot.on(unmarkEvents, unmark)
  robot.on('schedule.repository', markAndSweep)

  async function targetIssue (context) {
    if (!context.isBot) {
      const profanity = await forRepository(context)
      const issue = context.payload.issue || context.payload.pull_request
      const comments = context.payload.comment ? [context.payload.comment] : null
      const type = context.payload.issue ? 'issues' : 'pulls'

      await profanity.ensureProfanityLabelExists(type)

      // allow an action take place
      profanity.remainingActions++

      profanity.targetIssue(type, issue, comments)
    }
  }

  async function unmark (context) {
    if (!context.isBot) {
      const profanity = await forRepository(context)
      const filter = profanity.filter
      let issue = context.payload.issue || context.payload.pull_request
      const type = context.payload.issue ? 'issues' : 'pulls'

      // Some payloads don't include labels
      if (!issue.labels) {
        issue = (await context.github.issues.get(context.issue())).data
      }

      if (profanity.hasProfanityLabel(type, issue) && issue.state !== 'closed') {
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
    let config = await getConfig(context, 'profanity.yml')

    if (!config) {
      scheduler.stop(context.payload.repository)
      // Don't actually perform for repository without a config
      config = {perform: false}
    }

    config = Object.assign(config, context.repo({logger: robot.log}))

    return new Profanity(context.github, config)
  }
}
