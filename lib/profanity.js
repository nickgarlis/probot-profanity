const Filter = require('./filter')
const schema = require('./schema')
const maxActionsPerRun = 30

module.exports = class Profanity {
  constructor (github, {owner, repo, logger = console, ...config}) {
    this.github = github
    this.logger = logger
    this.remainingActions = 0

    const {error, value} = schema.validate(config)

    this.config = value

    this.configureFilter()

    if (error) {
      // Report errors to sentry
      logger.warn({err: new Error(error), owner, repo}, 'Invalid config')
    }

    Object.assign(this.config, {owner, repo})
  }

  configureFilter () {
    const extraWords = this.config.extraWords
    const placeholder = this.config.placeholder
    this.filter = new Filter({list: extraWords, placeHolder: placeholder})
  }

  async markAndSweep (type) {
    const {only} = this.config
    if (only && only !== type) {
      return
    }
    if (!this.getConfigValue(type, 'perform')) {
      return
    }

    this.logger.info(this.config, `starting mark and sweep of ${type}`)

    const limitPerRun = this.getConfigValue(type, 'limitPerRun') || maxActionsPerRun
    this.remainingActions = Math.min(limitPerRun, maxActionsPerRun)

    const censor = this.getConfigValue(type, 'censor')
    await this.ensureProfanityLabelExists(type)

    this.getIssues(type).then(res => {
      res.data.items.filter(issue => !issue.locked)
        .forEach(issue => {
          if (censor) {
            this.getIssueComments(issue).then(comments => {
              this.censor(type, issue, comments.data)
            })
          } else {
            this.mark(type, issue)
          }
        })
    })

    const {daysUntilClose, owner, repo} = this.config

    if (daysUntilClose) {
      this.logger.trace({owner, repo}, 'Configured to close profane issues')
      this.getClosable(type).then(res => {
        res.data.items.filter(issue => !issue.locked)
          .forEach(issue => this.close(type, issue))
      })
    } else {
      this.logger.trace({owner, repo}, 'Configured to leave profane issues open')
    }
  }

  isProfane (profane) {
    const profaneTitle = (typeof profane.title !== 'undefined')
    const profaneBody = (typeof profane.body !== 'undefined')
    const profaneComments = (Object.keys(profane.comments).length !== 0)

    return (profaneTitle || profaneBody || profaneComments)
  }

  getProfanity (issue, comments) {
    var CleanTitle
    var CleanBody
    var CleanComments = {}

    this.filter.escMarkdown = false
    CleanTitle = (this.filter.isProfane(issue.title)) ? this.filter.clean(issue.title) : CleanTitle

    this.filter.escMarkdown = true
    CleanBody = (this.filter.isProfane(issue.body)) ? this.filter.clean(issue.body) : CleanBody

    if (comments) {
      comments.forEach(comment => {
        if (this.filter.isProfane(comment.body)) {
          let id = comment.id
          let body = comment.body
          CleanComments[id] = this.filter.clean(body)
        }
      })
    }

    return {
      title: CleanTitle,
      body: CleanBody,
      comments: CleanComments
    }
  }

  getIssues (type) {
    const profanityLabel = this.getConfigValue(type, 'profanityLabel')
    const exemptLabels = this.getConfigValue(type, 'exemptLabels')
    const exemptProjects = this.getConfigValue(type, 'exemptProjects')
    const exemptMilestones = this.getConfigValue(type, 'exemptMilestones')
    const labels = [profanityLabel].concat(exemptLabels)

    const queryParts = labels.map(label => `-label:"${label}"`)
    queryParts.push(Profanity.getQueryTypeRestriction(type))

    queryParts.push(exemptProjects ? 'no:project' : '')
    queryParts.push(exemptMilestones ? 'no:milestone' : '')

    const query = queryParts.join(' ')

    return this.search(type, query)
  }

  getIssueComments (issue) {
    const {owner, repo} = this.config
    const number = issue.number
    return this.github.issues.getComments({owner, repo, number})
  }

  getClosable (type) {
    const profanityLabel = this.getConfigValue(type, 'profanityLabel')
    const queryTypeRestriction = Profanity.getQueryTypeRestriction(type)

    const days = this.getConfigValue(type, 'daysUntilClose')
    const timestamp = this.since(days).toISOString().replace(/\.\d{3}\w$/, '')

    const query = `updated:<${timestamp} label:"${profanityLabel}" ${queryTypeRestriction}`

    return this.search(type, query)
  }

  static getQueryTypeRestriction (type) {
    if (type === 'pulls') {
      return 'is:pr'
    } else if (type === 'issues') {
      return 'is:issue'
    }
    throw new Error(`Unknown type: ${type}. Valid types are 'pulls' and 'issues'`)
  }

  search (type, query) {
    const {owner, repo} = this.config

    query = `repo:${owner}/${repo} is:open ${query}`

    const params = {q: query, sort: 'updated', order: 'desc', per_page: maxActionsPerRun}

    this.logger.info(params, 'searching %s/%s for issues', owner, repo)
    return this.github.search.issues(params)
  }

  async censor (type, issue, comments) {
    const profane = this.getProfanity(issue, comments)

    if (this.remainingActions === 0 || !this.isProfane(profane)) {
      return
    }
    this.remainingActions--

    const {owner, repo} = this.config
    const perform = this.getConfigValue(type, 'perform')
    const number = issue.number

    if (perform) {
      this.logger.info('%s/%s#%d is being censored', owner, repo, number)

      if (profane.title) {
        await this.github.issues.edit({owner, repo, number, title: profane.title})
      }

      if (profane.body) {
        await this.github.issues.edit({owner, repo, number, body: profane.body})
      }

      if (Object.keys(profane.comments).length) {
        const promises = []

        for (const id in profane.comments) {
          const body = profane.comments[id]
          const orderPromise = this.github.issues.editComment({owner, repo, id, body: body})
          promises.push(orderPromise)
        }
        await Promise.all(promises)
      }
    } else {
      this.logger.info('%s/%s#%d would have been censored (dry-run)', owner, repo, number)
    }
  }

  async mark (type, issue) {
    const profane = this.getProfanity(issue)

    if (this.remainingActions === 0 || !this.isProfane(profane)) {
      return
    }
    this.remainingActions--

    const {owner, repo} = this.config
    const perform = this.getConfigValue(type, 'perform')
    const profanityLabel = this.getConfigValue(type, 'profanityLabel')
    const markComment = this.getConfigValue(type, 'markComment')
    const number = issue.number

    if (perform) {
      this.logger.info('%s/%s#%d is being marked', owner, repo, number)
      if (markComment) {
        await this.github.issues.createComment({owner, repo, number, body: markComment})
      }
      return this.github.issues.addLabels({owner, repo, number, labels: [profanityLabel]})
    } else {
      this.logger.info('%s/%s#%d would have been marked (dry-run)', owner, repo, number)
    }
  }

  async close (type, issue) {
    if (this.remainingActions === 0) {
      return
    }
    this.remainingActions--

    const {owner, repo} = this.config
    const perform = this.getConfigValue(type, 'perform')
    const closeComment = this.getConfigValue(type, 'closeComment')
    const number = issue.number

    if (perform) {
      this.logger.info('%s/%s#%d is being closed', owner, repo, number)
      if (closeComment) {
        await this.github.issues.createComment({owner, repo, number, body: closeComment})
      }
      return this.github.issues.edit({owner, repo, number, state: 'closed'})
    } else {
      this.logger.info('%s/%s#%d would have been closed (dry-run)', owner, repo, number)
    }
  }

  async unmark (type, issue) {
    const {owner, repo} = this.config
    const perform = this.getConfigValue(type, 'perform')
    const profanityLabel = this.getConfigValue(type, 'profanityLabel')
    const unmarkComment = this.getConfigValue(type, 'unmarkComment')
    const number = issue.number

    if (perform) {
      this.logger.info('%s/%s#%d is being unmarked', owner, repo, number)

      if (unmarkComment) {
        await this.github.issues.createComment({owner, repo, number, body: unmarkComment})
      }

      return this.github.issues.removeLabel({owner, repo, number, name: profanityLabel}).catch((err) => {
        // ignore if it's a 404 because then the label was already removed
        if (err.code !== 404) {
          throw err
        }
      })
    } else {
      this.logger.info('%s/%s#%d would have been unmarked (dry-run)', owner, repo, number)
    }
  }

  hasProfanityLabel (type, issue) {
    const profanityLabel = this.getConfigValue(type, 'profanityLabel')
    return issue.labels.map(label => label.name).includes(profanityLabel)
  }

  // returns a type-specific config value if it exists, otherwise returns the top-level value.
  getConfigValue (type, key) {
    if (this.config[type] && typeof this.config[type][key] !== 'undefined') {
      return this.config[type][key]
    }
    return this.config[key]
  }

  async ensureProfanityLabelExists (type) {
    const {owner, repo} = this.config
    const profanityLabel = this.getConfigValue(type, 'profanityLabel')

    return this.github.issues.getLabel({owner, repo, name: profanityLabel}).catch(() => {
      return this.github.issues.createLabel({owner, repo, name: profanityLabel, color: 'dc3023'})
    })
  }

  since (days) {
    const ttl = days * 24 * 60 * 60 * 1000
    let date = new Date(new Date() - ttl)

    // GitHub won't allow it
    if (date < new Date(0)) {
      date = new Date(0)
    }
    return date
  }
}
