import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export function writeAuditReportIfRequested(path: string, contents: string): boolean {
  if (process.env.ODEKAKE_GENERATE_AUDIT_REPORTS !== '1') return false

  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, contents)
  return true
}
