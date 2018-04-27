const exec = require('child_process').exec
const pkg = require('./package')

const app = pkg.now['name']
const push = 'now -e NODE_ENV=production -e APP_ID=$APP_ID -e WEBHOOK_SECRET=$WEBHOOK_SECRET -e PRIVATE_KEY="$PRIVATE_KEY" --token $NOW_TOKEN --npm --public'
const alias = 'now alias --token=$NOW_TOKEN'
const remove = `now rm ${app} --token=$NOW_TOKEN --safe -y`
const deploy = `${push} && ${alias} && ${remove}`

exec(deploy, function (error, stdout, stderr) {
  console.log(stdout)
  console.log(stderr)
  if (error !== null) {
    console.log(error)
  }
})
