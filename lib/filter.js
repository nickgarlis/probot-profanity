//overrides bad-words-relaxed
const Filter = require('bad-words-relaxed')

Filter.prototype.getEsc = function () {
  const format = /[!&@#*`]/

  if (format.test(this.placeHolder) && this.escMarkdown) {
    return '\\'
  } else {
    return ''
  }
}

Filter.prototype.replaceWord = function replaceWord (string) {
  return this.getEsc() + string.replace(this.regex, '').replace(this.replaceRegex, this.placeHolder)
}

module.exports = Filter
