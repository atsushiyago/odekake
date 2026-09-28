import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = process.cwd()
const vitestCli = resolve(root, 'node_modules/vitest/vitest.mjs')
const defaultTests = [
  'scripts/auditElderlyRouteScoringTrial.test.ts',
  'scripts/auditElderlyRouteSemantics.test.ts',
  'scripts/auditFacilityGroupingRegression.test.ts',
  'scripts/auditFiveStationElderlyRouteSelection.test.ts',
  'scripts/auditKokuritsuBoardingBestRoutes.test.ts',
  'scripts/auditKokuritsuCanonicalRoute.test.ts',
  'scripts/auditKokuritsuElderlyRoute.test.ts',
  'scripts/auditLevelTransitionConsensus.test.ts',
  'scripts/auditStationGuideRouteIntegrity.test.ts',
  'scripts/auditVerticalMovementConsensus.test.ts',
  'scripts/auditElderlyCarPosition.test.ts',
]
const tests = process.argv.slice(2)
const result = spawnSync(process.execPath, [vitestCli, 'run', ...(tests.length ? tests : defaultTests)], {
  cwd: root,
  env: { ...process.env, ODEKAKE_GENERATE_AUDIT_REPORTS: '1' },
  stdio: 'inherit',
})

if (result.error) throw result.error
process.exitCode = result.status ?? 1
