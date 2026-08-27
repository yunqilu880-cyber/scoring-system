import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const dataDir = process.env.DATA_DIR || path.join(rootDir, 'data')
const uploadDir = process.env.UPLOAD_DIR || path.join(dataDir, 'uploads')
const backupDir = process.env.BACKUP_DIR || path.join(dataDir, 'backups')
const dbPath = path.join(dataDir, 'data.json')

const safeName = value => String(value || 'manual')
  .replace(/[^\w.-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60) || 'manual'

const reason = safeName(process.argv[2] || 'manual-cli')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const targetDir = path.join(backupDir, `${stamp}-${reason}`)

await fs.mkdir(targetDir, { recursive: true })

if (existsSync(dbPath)) {
  await fs.copyFile(dbPath, path.join(targetDir, 'data.json'))
} else {
  console.warn(`未找到数据文件：${dbPath}`)
}

if (existsSync(uploadDir)) {
  await fs.cp(uploadDir, path.join(targetDir, 'uploads'), { recursive: true })
} else {
  console.warn(`未找到上传目录：${uploadDir}`)
}

await fs.writeFile(
  path.join(targetDir, 'README.txt'),
  `评分系统数据备份\n时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n原因：${reason}\n内容：data.json 和 uploads 证明材料目录\n`,
  'utf8',
)

console.log(`数据已备份到：${targetDir}`)
