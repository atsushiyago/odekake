import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const reports = join(root, 'reports')
const fixtures = join(root, 'src/data/fixtures')
const stationMaps = join(root, 'src/data/stationMaps')
const output = join(fixtures, 'verified-pathway-crosswalk.json')
const normalize = value => value.toLowerCase().replace(/[^a-z0-9]/g, '')

export async function generate() {
  const audit = JSON.parse(await readFile(join(reports, 'gtfs-walking-pathway-crosswalk-audit.json'), 'utf8'))
  const directories = (await readdir(stationMaps, { withFileTypes: true })).filter(item => item.isDirectory()).map(item => item.name)
  const stations = {}
  for (const station of audit.stations) {
    if (station.completeness !== 'full') continue
    const name = `oedo2026-${station.key}-gtfs-pathways.json`
    const fixture = JSON.parse(await readFile(join(fixtures, name), 'utf8'))
    const directory = directories.find(item => normalize(item) === normalize(station.key))
    if (!directory) throw new Error(`No StationMap directory for ${station.key}`)
    const pathways = Object.fromEntries(station.pathways.filter(row => row.verified).map(row => [row.pathwayId, {
      walkingLinkId: row.walkingLinkId, gtfsMode: row.pathwayMode, fromStopId: row.fromStopId, toStopId: row.toStopId,
      walkingFromNodeId: row.walkingFromNodeId, walkingToNodeId: row.walkingToNodeId,
      fromWalkingFloor: row.fromFloor, toWalkingFloor: row.toFloor,
    }]))
    stations[fixture.station.id] = { feedVersion: fixture.source.feedVersion, stationMapDirectory: directory, pathways }
  }
  const count = Object.values(stations).reduce((n, station) => n + Object.keys(station.pathways).length, 0)
  if (count !== audit.total.productionEligibleVerified) throw new Error(`Manifest count ${count} != audited ${audit.total.productionEligibleVerified}`)
  await writeFile(output, JSON.stringify({ sourceAudit: 'reports/gtfs-walking-pathway-crosswalk-audit.json', stations }, null, 2) + '\n')
  return { stations: Object.keys(stations).length, pathways: count }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await generate()))
