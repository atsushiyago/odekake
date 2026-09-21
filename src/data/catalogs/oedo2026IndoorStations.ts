export type IndoorDatasetImportStatus = 'fixture-loaded' | 'not-imported'
export interface Oedo2026IndoorStation { key: string; name: string; gtfsStationId: string; importStatus: IndoorDatasetImportStatus }

/** Names announced by the Challenge 2026 on 2026-09-17. Keys are local identifiers, not ODPT IDs. */
export const oedo2026IndoorStations: Oedo2026IndoorStation[] = [
  { key: 'shinjuku', name: '新宿', gtfsStationId: '428', importStatus: 'fixture-loaded' },
  { key: 'shinjuku-nishiguchi', name: '新宿西口', gtfsStationId: '402', importStatus: 'fixture-loaded' },
  { key: 'daimon', name: '大門', gtfsStationId: '421', importStatus: 'fixture-loaded' },
  { key: 'akabanebashi', name: '赤羽橋', gtfsStationId: '422', importStatus: 'fixture-loaded' },
  { key: 'aoyama-itchome', name: '青山一丁目', gtfsStationId: '425', importStatus: 'fixture-loaded' },
  { key: 'kokuritsu-kyogijo', name: '国立競技場', gtfsStationId: '426', importStatus: 'fixture-loaded' },
  { key: 'tochomae', name: '都庁前', gtfsStationId: '429', importStatus: 'fixture-loaded' },
  { key: 'azabu-juban', name: '麻布十番', gtfsStationId: '423', importStatus: 'fixture-loaded' },
  { key: 'higashi-shinjuku', name: '東新宿', gtfsStationId: '403', importStatus: 'fixture-loaded' },
  { key: 'roppongi', name: '六本木', gtfsStationId: '424', importStatus: 'fixture-loaded' },
  { key: 'ueno-okachimachi', name: '上野御徒町', gtfsStationId: '410', importStatus: 'fixture-loaded' },
  { key: 'yoyogi', name: '代々木', gtfsStationId: '427', importStatus: 'fixture-loaded' }
]
