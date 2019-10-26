const Joi = require('joi')

const fields = {
  language: Joi.any().valid(['de', 'en', 'es', 'fr', 'it', 'nl', 'pt', 'ru'])
    .description('Language to detect profanity in'),

  censor: Joi.boolean()
    .description('Set to true to censor issues (defaults to false)'),

  dictionaries: Joi.array().items(Joi.string().valid('profanity', 'racist')).min(1).single()
    .description('The dictionaries of forbidden words to use'),

  placeholder: Joi.string().max(1)
    .description('A letter to replace those of a forbidden word'),

  extraWords: Joi.alternatives().try(Joi.any().valid(null), Joi.array().single())
    .description('A list of extra forbidden words. Set to `[]` to disable'),

  exemptWords: Joi.alternatives().try(Joi.any().valid(null), Joi.array().single())
    .description('A list of forbidden words to be ignored. Set to `[]` to disable'),

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
  language: fields.language.default('en'),
  censor: fields.censor.default(false),
  dictionaries: fields.dictionaries.default(['profanity', 'racist']),
  placeholder: fields.placeholder.default('*'),
  extraWords: fields.extraWords.default([]),
  exemptWords: fields.exemptWords.default([]),
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
  issues: Joi.object().keys(fields),
  _extends: Joi.string().description('Repository to extend settings from')
})

module.exports = schema
