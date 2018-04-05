const Joi = require('joi')

const fields = {
  censor: Joi.boolean()
    .description('Forbidden words will be censored. Set to true to enable'),

  placeholder: Joi.string().max(1)
    .description('A letter to replace those of a forbidden word'),

  daysUntilClose: Joi.alternatives().try(Joi.number(), Joi.boolean().only(false))
    .error(() => '"daysUntilClose" must be a number or false')
    .description('Number of days of inactivity before an inappropriate Issue or Pull Request is closed. If disabled, issues still need to be closed manually, but will remain marked as stale.'),

  exemptLabels: Joi.alternatives().try(Joi.any().valid(null), Joi.array().single())
    .description('Issues or Pull Requests with these labels will never be considered profane. Set to `[]` to disable'),

  exemptProjects: Joi.boolean()
    .description('Set to true to ignore issues in a project (defaults to false)'),

  exemptMilestones: Joi.boolean()
    .description('Set to true to ignore issues in a milestone (defaults to false)'),

  profanityLabel: Joi.string()
    .description('Label to use when marking as inappropriate'),

  markComment: Joi.alternatives().try(Joi.string(), Joi.any().only(false))
    .error(() => '"markComment" must be a string or false')
    .description('Comment to post when marking as inappropriate. Set to `false` to disable'),

  unmarkComment: Joi.alternatives().try(Joi.string(), Joi.boolean().only(false))
    .error(() => '"unmarkComment" must be a string or false')
    .description('Comment to post when removing the inappropriate label. Set to `false` to disable'),

  closeComment: Joi.alternatives().try(Joi.string(), Joi.boolean().only(false))
    .error(() => '"closeComment" must be a string or false')
    .description('Comment to post when closing an inappropriate Issue or Pull Request. Set to `false` to disable'),

  limitPerRun: Joi.number().integer().min(1).max(30)
    .error(() => '"limitPerRun" must be an integer between 1 and 30')
    .description('Limit the number of actions per hour, from 1-30. Default is 30')
}

const schema = Joi.object().keys({
  censor: fields.censor.default(false),
  placeholder: fields.placeholder.default('*'),
  daysUntilClose: fields.daysUntilClose.default(2),
  exemptLabels: fields.exemptLabels.default([]),
  exemptProjects: fields.exemptProjects.default(false),
  exemptMilestones: fields.exemptMilestones.default(false),
  profanityLabel: fields.profanityLabel.default('inappropriate'),
  markComment: fields.markComment.default(
    'This issue has been automatically marked as inappropriate because ' +
    'it contains forbidden words. It will be closed if no further edit ' +
    'occurs. Thank you for your contributions.'
  ),
  unmarkComment: fields.unmarkComment.default(false),
  closeComment: fields.closeComment.default(false),
  limitPerRun: fields.limitPerRun.default(30),
  perform: Joi.boolean().default(!process.env.DRY_RUN),
  only: Joi.any().valid('issues', 'pulls', null).description('Limit to only `issues` or `pulls`'),
  pulls: Joi.object().keys(fields),
  issues: Joi.object().keys(fields)
})

module.exports = schema
