/* eslint-disable camelcase */
process.env.LOG_LEVEL = 'fatal'

const {createRobot} = require('probot')
const Profanity = require('../lib/profanity')
const notFoundError = {
  code: 404,
  status: 'Not Found',
  headers: {}
}

describe('profanity', () => {
  let robot
  let github

  beforeEach(() => {
    robot = createRobot()

    const issueAction = jest.fn().mockImplementation(() => Promise.resolve(notFoundError))

    // Mock out the GitHub API
    github = {
      integrations: {
        getInstallations: jest.fn()
      },
      paginate: jest.fn(),
      issues: {
        removeLabel: issueAction,
        getLabel: jest.fn().mockImplementation(() => Promise.reject(notFoundError)),
        getComments: jest.fn().mockImplementation(() => Promise.reject(notFoundError)),
        createLabel: issueAction,
        addLabels: issueAction,
        createComment: issueAction,
        edit: issueAction,
        editComment: issueAction
      },
      search: {
        issues: issueAction
      }
    }

    // Mock out GitHub client
    robot.auth = () => Promise.resolve(github)
  })

  test(
    'censors profane issue',
    async () => {
      let profanity = new Profanity(github, {perform: true, owner: 'nickgarlis', repo: 'profanity', logger: robot.log})

      for (const type of ['pulls', 'issues']) {
        try {
          await profanity.censor(type, {number: 123, title: 'some title', body: 'fuck'})
        } catch (_) {
          throw new Error('Should not have thrown an error')
        }
      }
    }
  )

  test(
    'removes the profanity label and ignores if it has already been removed',
    async () => {
      let profanity = new Profanity(github, {perform: true, owner: 'nickgarlis', repo: 'profanity', logger: robot.log})

      for (const type of ['pulls', 'issues']) {
        try {
          await profanity.unmark(type, {number: 123})
        } catch (_) {
          throw new Error('Should not have thrown an error')
        }
      }
    }
  )

  test('should limit the number of actions it takes each run', async () => {
    const profanityLabel = 'profanity'
    const limitPerRun = 30

    const issueCount = 40
    const profanityCount = 3

    const issues = []
    for (let i = 1; i <= issueCount; i++) {
      const labels = (i <= profanityCount) ? [{name: profanityLabel}] : []
      const title = 'fuck'
      const body = 'fuck'
      issues.push({number: i, title: title, body: body, labels: labels})
    }

    const prs = []
    for (let i = 101; i <= 100 + issueCount; i++) {
      const labels = (i <= 100 + profanityCount) ? [{name: profanityLabel}] : []
      const title = 'fuck'
      const body = 'fuck'
      prs.push({number: i, title: title, body: body, labels: labels})
    }

    github.search.issues = ({q, sort, order, per_page}) => {
      let items = []
      if (q.includes('is:pr')) {
        items = items.concat(prs.slice(0, per_page))
      } else if (q.includes('is:issue')) {
        items = items.concat(issues.slice(0, per_page))
      } else {
        throw new Error('query should specify PullRequests or Issues')
      }

      if (q.includes(`-label:"${profanityLabel}"`)) {
        items = items.filter(item => !item.labels.map(label => label.name).includes(profanityLabel))
      } else if (q.includes(`label:"${profanityLabel}"`)) {
        items = items.filter(item => item.labels.map(label => label.name).includes(profanityLabel))
      }

      expect(items.length).toBeLessThanOrEqual(per_page)

      return Promise.resolve({
        data: {
          items: items
        }
      })
    }

    for (const type of ['pulls', 'issues']) {
      let comments = 0
      let closed = 0
      let labeledProfanity = 0
      github.issues.createComment = jest.fn().mockImplementation(() => {
        comments++
        return Promise.resolve(notFoundError)
      })
      github.issues.edit = ({owner, repo, number, state}) => {
        if (state === 'closed') {
          closed++
        }
      }
      github.issues.addLabels = ({owner, repo, number, labels}) => {
        if (labels.includes(profanityLabel)) {
          labeledProfanity++
        }
      }

      // Mock out GitHub client
      robot.auth = () => Promise.resolve(github)

      const profanity = new Profanity(github, {perform: true, owner: 'probot', repo: 'profanity', logger: robot.log})
      profanity.config.limitPerRun = limitPerRun
      profanity.config.profanityLabel = profanityLabel
      profanity.config.closeComment = 'closed'
      profanity.config.censor = false

      await profanity.markAndSweep(type)

      expect(comments).toEqual(limitPerRun)
      expect(closed).toEqual(profanityCount)
      expect(labeledProfanity).toEqual(limitPerRun - profanityCount)
    }
  })

  test(
    'should not close issues if daysUntilClose is configured as false',
    async () => {
      let profanity = new Profanity(github, {perform: true, owner: 'nickgarlis', repo: 'profanity', logger: robot.log})
      profanity.config.daysUntilClose = false
      profanity.getIssues = jest.fn().mockImplementation(() => Promise.resolve({data: {items: []}}))
      profanity.getClosable = jest.fn()

      await profanity.markAndSweep('issues')
      expect(profanity.getClosable).not.toHaveBeenCalled()

      await profanity.markAndSweep('pulls')
      expect(profanity.getClosable).not.toHaveBeenCalled()
    }
  )
})
