const schema = require('../lib/schema')

const validConfigs = [
  [{language: 'en'}],
  [{censor: true}],
  [{censor: false}],
  [{dictionaries: ['profanity']}],
  [{dictionaries: ['racist', 'profanity']}],
  [{placeholder: '*'}],
  [{extraWords: ['duck']}],
  [{extraWords: 'duck'}, {extraWords: ['duck']}],
  [{extraWords: null}],
  [{extraWords: []}],
  [{exemptWords: ['damn']}],
  [{exemptWords: 'damn'}, {exemptWords: ['damn']}],
  [{exemptWords: null}],
  [{exemptWords: []}],
  [{daysUntilClose: false}],
  [{daysUntilClose: 1}],
  [{exemptLabels: ['foo']}],
  [{exemptLabels: 'foo'}, {exemptLabels: ['foo']}],
  [{exemptLabels: null}],
  [{exemptLabels: []}],
  [{exemptProjects: true}],
  [{exemptProjects: false}],
  [{exemptMilestones: true}],
  [{exemptMilestones: false}],
  [{profanityLabel: 'profanity'}],
  [{markComment: 'profanity yo'}],
  [{markComment: false}],
  [{unmarkComment: 'not profanity'}],
  [{unmarkComment: false}],
  [{closeComment: 'closing yo'}],
  [{closeComment: false}],
  [{limitPerRun: 1}],
  [{limitPerRun: 30}],
  [{only: null}],
  [{only: 'issues'}],
  [{only: 'pulls'}],
  [{pulls: {daysUntilClose: 2}}],
  [{issues: {profanityLabel: 'profanity-issue'}}],
  [{_extends: '.github'}],
  [{_extends: 'foobar'}]
]

const invalidConfigs = [
  [{language: 'bananas'}, 'must be one of [de, en, es, fr, it, nl, pt, ru]'],
  [{censor: 'nope'}, 'must be a boolean'],
  [{dictionaries: ['fake']}, 'must be one of [profanity, racist]'],
  [{dictionaries: []}, 'must contain at least 1 items'],
  [{placeholder: ''}, 'not allowed to be empty'],
  [{placeholder: false}, 'must be a string'],
  [{placeholder: ['a', 'b']}, 'must be a string'],
  [{placeholder: '**'}, 'length must be less than or equal to 1 characters long'],
  [{daysUntilClose: true}, 'must be a number or false'],
  [{exemptProjects: 'nope'}, 'must be a boolean'],
  [{exemptMilestones: 'nope'}, 'must be a boolean'],
  [{profanityLabel: ''}, 'not allowed to be empty'],
  [{profanityLabel: false}, 'must be a string'],
  [{profanityLabel: ['a', 'b']}, 'must be a string'],
  [{markComment: true}, 'must be a string or false'],
  [{unmarkComment: true}, 'must be a string or false'],
  [{closeComment: true}, 'must be a string or false'],
  [{limitPerRun: 31}, 'must be an integer between 1 and 30'],
  [{limitPerRun: 0}, 'must be an integer between 1 and 30'],
  [{limitPerRun: 0.5}, 'must be an integer between 1 and 30'],
  [{only: 'donuts'}, 'must be one of [issues, pulls, null]'],
  [{pulls: {lol: 'nope'}}, '"lol" is not allowed'],
  [{issues: {profanityLabel: ''}}, 'not allowed to be empty'],
  [{_extends: true}, 'must be a string'],
  [{_extends: false}, 'must be a string']
]

describe('schema', () => {
  test('defaults', async () => {
    expect(schema.validate({}).value).toEqual({
      language: 'en',
      censor: false,
      dictionaries: ['profanity', 'racist'],
      placeholder: '*',
      extraWords: [],
      exemptWords: [],
      daysUntilClose: 2,
      exemptLabels: [],
      exemptProjects: false,
      exemptMilestones: false,
      profanityLabel: 'inappropriate',
      perform: true,
      markComment: 'This issue has been automatically marked as inappropriate because ' +
      'it contains forbidden words. It will be closed if no further edit ' +
      'occurs. Thank you for your contributions.',
      unmarkComment: false,
      closeComment: false,
      limitPerRun: 30
    })
  })

  validConfigs.forEach(([example, expected = example]) => {
    test(`${JSON.stringify(example)} is valid`, () => {
      const result = schema.validate(example)
      expect(result.error).toBe(null)
      expect(result.value).toMatchObject(expected)
    })
  })

  invalidConfigs.forEach(([example, message]) => {
    test(`${JSON.stringify(example)} is invalid`, () => {
      const {error} = schema.validate(example)
      expect(error && error.toString()).toMatch(message)
    })
  })
})
