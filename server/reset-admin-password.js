import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const dataDir = process.env.DATA_DIR || path.join(rootDir, 'data')
const dbPath = path.join(dataDir, 'data.json')
const newPassword = String(process.argv[2] || process.env.ADMIN_PASSWORD || '')

if (newPassword.length < 6 || newPassword === '123456') {
  console.error('请提供至少 6 位的新管理员密码，且不能使用 123456。')
  console.error('用法：npm run reset:admin-password -- "你的新密码"')
  process.exit(1)
}

if (!existsSync(dbPath)) {
  console.error(`未找到数据文件：${dbPath}`)
  process.exit(1)
}

const hashPassword = async password => {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, 64, (error, key) => {
      if (error) reject(error)
      else resolve(key.toString('hex'))
    })
  })
  return `${salt}:${derived}`
}

const raw = await fs.readFile(dbPath, 'utf8')
const data = JSON.parse(raw)
data.adminAccount = {
  ...(data.adminAccount || {}),
  username: process.env.ADMIN_USERNAME || data.adminAccount?.username || 'admin',
  name: data.adminAccount?.name || '审核管理员',
  passwordHash: await hashPassword(newPassword),
  updatedAt: new Date().toISOString(),
}

const tmpPath = `${dbPath}.tmp`
await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8')
await fs.rename(tmpPath, dbPath)

console.log(`管理员密码已重置，账号：${data.adminAccount.username}`)
