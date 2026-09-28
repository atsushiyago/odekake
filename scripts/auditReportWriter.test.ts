import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { writeAuditReportIfRequested } from './auditReportWriter.ts'

const previousGenerationFlag = process.env.ODEKAKE_GENERATE_AUDIT_REPORTS
const tempDirectory = mkdtempSync(join(tmpdir(), 'odekake-audit-report-'))

afterEach(() => {
  if (previousGenerationFlag === undefined) delete process.env.ODEKAKE_GENERATE_AUDIT_REPORTS
  else process.env.ODEKAKE_GENERATE_AUDIT_REPORTS = previousGenerationFlag
  rmSync(tempDirectory, { recursive: true, force: true })
})

it('keeps report output in memory during normal tests', () => {
  delete process.env.ODEKAKE_GENERATE_AUDIT_REPORTS
  const path = join(tempDirectory, 'normal', 'report.md')

  expect(writeAuditReportIfRequested(path, 'generated report')).toBe(false)
  expect(existsSync(path)).toBe(false)
})

it('writes report files only when explicitly requested', () => {
  process.env.ODEKAKE_GENERATE_AUDIT_REPORTS = '1'
  const path = join(tempDirectory, 'explicit', 'report.md')

  expect(writeAuditReportIfRequested(path, 'generated report')).toBe(true)
  expect(readFileSync(path, 'utf8')).toBe('generated report')
})
