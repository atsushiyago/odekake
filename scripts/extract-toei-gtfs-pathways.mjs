#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

function usage() {
  console.error('Usage: node scripts/extract-toei-gtfs-pathways.mjs ZIP STATION_ID STATION_NAME SOURCE_URL LICENSE FEED_VERSION OUTPUT_JSON [OFFICIAL_ZIP_SHA256]')
  process.exit(1)
}

const [, , zipPath, stationId, stationName, sourceUrl, license, feedVersion, outputPath, officialZipSha256] = process.argv
if (![zipPath, stationId, stationName, sourceUrl, license, feedVersion, outputPath].every(Boolean)) usage()
if (officialZipSha256 && !/^[a-f\d]{64}$/i.test(officialZipSha256)) throw new Error('OFFICIAL_ZIP_SHA256 must be a 64-character hexadecimal hash')

function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1 } else quoted = !quoted
    } else if (char === ',' && !quoted) { row.push(cell); cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(cell); if (row.some(value => value !== '')) rows.push(row); row = []; cell = ''
    } else cell += char
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [header, ...values] = rows
  return values.map(valuesRow => Object.fromEntries(header.map((key, index) => [key.replace(/^\uFEFF/, ''), valuesRow[index] ?? ''])))
}

function readZipEntry(entry) {
  return execFileSync('unzip', ['-p', zipPath, entry], { encoding: 'utf8' })
}

const stops = parseCsv(readZipEntry('stops.txt')).map(row => ({
  stopId: row.stop_id, stopName: row.stop_name || undefined, stopLat: row.stop_lat, stopLon: row.stop_lon, locationType: row.location_type,
  parentStation: row.parent_station || undefined, levelId: row.level_id || undefined, platformCode: row.platform_code || undefined
}))
const levels = parseCsv(readZipEntry('levels.txt')).map(row => ({ levelId: row.level_id, levelIndex: row.level_index }))
const pathways = parseCsv(readZipEntry('pathways.txt')).map(row => ({
  pathwayId: row.pathway_id, fromStopId: row.from_stop_id, toStopId: row.to_stop_id, pathwayMode: row.pathway_mode, isBidirectional: row.is_bidirectional, length: row.length
}))

const stationStop = stops.find(stop => stop.stopId === stationId && stop.locationType === '1')
if (!stationStop) throw new Error(`Station ID ${stationId} was not found as a location_type=1 station in stops.txt`)
if (stationStop.stopName !== stationName) throw new Error(`Station ID ${stationId} is named ${stationStop.stopName ?? '(blank)'}, not ${stationName}`)

// Keep only the station and recursively its parent_station descendants. No name or coordinate inference.
const included = new Set([stationId]); let changed = true
while (changed) {
  changed = false
  for (const stop of stops) if (stop.parentStation && included.has(stop.parentStation) && !included.has(stop.stopId)) { included.add(stop.stopId); changed = true }
}

const output = {
  source: { name: '東京都交通局 鉄道関連情報（GTFS-Pathways）', url: sourceUrl, license, feedVersion, retrievedAt: new Date().toISOString().slice(0, 10) },
  // The extracted files do not prove the checksum of the publisher's ZIP.
  // Record a package hash only when that official checksum is supplied explicitly.
  artifact: { sha256: officialZipSha256 ?? null },
  station: { id: stationId, name: stationName },
  levels,
  stops: stops.filter(stop => included.has(stop.stopId)),
  pathways: pathways.filter(pathway => included.has(pathway.fromStopId) && included.has(pathway.toStopId))
}
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(`Wrote ${output.stops.length} stops and ${output.pathways.length} pathways for ${stationName} to ${outputPath}`)
