// Creates .env files with a fresh random JWT secret if they don't exist yet.
import fs from 'fs'
import crypto from 'crypto'

const make = (target, example, fill = s => s) => {
  if (fs.existsSync(target)) return console.log(`kept existing ${target}`)
  fs.writeFileSync(target, fill(fs.readFileSync(example, 'utf8')))
  console.log(`created ${target}`)
}
make('server/.env', 'server/.env.example', s => s.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${crypto.randomBytes(64).toString('hex')}`))
make('.env', '.env.example')
console.log('\nNext: add your GEMINI_API_KEY to server/.env, then run:\n  npm run dev:server   (terminal 1)\n  npm run dev          (terminal 2)')
