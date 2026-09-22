export interface ElderlyRouteRecommendation {
  stationId: string
  carPosition: string
  equipment: string
  /** Optional equipment listed for the post-gate/exit-side portion; never used in the home-to-gate sentence. */
  postGateEquipment?: string
  /** Equipment named by official guidance for the platform-to-gate vertical action. */
  homeEquipment?: 'エレベーター' | 'エスカレーター'
  /** Official gate-floor label; rendered only after an exact graph-level match. */
  gateFloor?: { label: string; levelIndex: number; sourceUrl: string }
  equipmentRelation?: 'selected-route' | 'official-options' | 'official-layered'
  targetGate: string
  sourceUrl: string
  timeLimit?: string
  /** When the official equipment cannot be tied to the selected GTFS route,
   * show only the independently proven platform-to-gate level transition. */
  paperDisplay?: 'level-transition-only' | 'official-layered-rejoin' | 'car-position-only'
}

/**
 * Official accessibility guidance is a separate evidence layer from GTFS.
 * These records never identify a GTFS boarding_area or Facility ID.
 */
export const elderlyRouteRecommendations: Record<string, ElderlyRouteRecommendation> = {
  // The official station map places the B2 exit group near car 5. Keep this
  // as a boarding-position hint only; it is not a claim about the selected
  // GTFS Facility or pre-gate route.
  '421': { stationId: '421', carPosition: '5号車付近', equipment: 'エレベーター', homeEquipment: 'エレベーター', gateFloor: { label: '地下3階', levelIndex: -3, sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/daimon.html' }, equipmentRelation: 'official-layered', paperDisplay: 'car-position-only', targetGate: 'B2出口方面', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/daimon.html' },
  '422': { stationId: '422', carPosition: '4号車付近', equipment: 'エレベーター', equipmentRelation: 'official-options', paperDisplay: 'car-position-only', targetGate: '赤羽橋口方面', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/akabanebashi.html' },
  '425': { stationId: '425', carPosition: '3号車・6号車付近', equipment: 'エスカレーター等', homeEquipment: 'エスカレーター', equipmentRelation: 'official-options', paperDisplay: 'car-position-only', targetGate: '1出口方面', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/aoyama-itchome.html' },
  '428': { stationId: '428', carPosition: '1号車付近', equipment: 'エスカレーター等', homeEquipment: 'エレベーター', gateFloor: { label: '地下3階', levelIndex: -2, sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/kanren/inspection/pdf/inspection202509_04.pdf' }, equipmentRelation: 'official-options', paperDisplay: 'car-position-only', targetGate: 'A1出口方面', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/shinjuku.html' },
  '402': { stationId: '402', carPosition: '7号車付近', equipment: 'エスカレーター', equipmentRelation: 'official-layered', paperDisplay: 'official-layered-rejoin', targetGate: 'D3出口方面', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/shinjuku-nishiguchi.html' },
  '410': { stationId: '410', carPosition: '6号車付近', equipment: 'エスカレーター', equipmentRelation: 'official-layered', paperDisplay: 'official-layered-rejoin', targetGate: 'A7出口方面', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/ueno-okachimachi.html' },
  '423': { stationId: '423', carPosition: '4号車付近', equipment: 'エレベーター', homeEquipment: 'エレベーター', equipmentRelation: 'official-layered', paperDisplay: 'official-layered-rejoin', targetGate: '改札', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/initiatives/accessibility/subway/kanren/pdf/barrierfree_guide_oedo.pdf' },
  '427': { stationId: '427', carPosition: '5号車付近', equipment: 'エレベーター', homeEquipment: 'エレベーター', equipmentRelation: 'official-layered', paperDisplay: 'official-layered-rejoin', targetGate: '改札', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/initiatives/accessibility/subway/kanren/pdf/barrierfree_guide_oedo.pdf' },
  '403': { stationId: '403', carPosition: '5号車付近', equipment: 'エレベーター', homeEquipment: 'エレベーター', equipmentRelation: 'official-layered', paperDisplay: 'official-layered-rejoin', targetGate: '改札', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/initiatives/accessibility/subway/kanren/pdf/barrierfree_guide_oedo.pdf' },
  '429': { stationId: '429', carPosition: '4号車付近', equipment: 'エレベーター', homeEquipment: 'エレベーター', equipmentRelation: 'official-layered', paperDisplay: 'official-layered-rejoin', targetGate: '改札', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/initiatives/accessibility/subway/kanren/pdf/barrierfree_guide_oedo.pdf' },
  '426': { stationId: '426', carPosition: '4号車付近', equipment: 'エレベーター', homeEquipment: 'エレベーター', targetGate: '国立競技場方面改札', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/initiatives/accessibility/subway/kanren/pdf/barrierfree_guide_oedo.pdf' },
  // The selected GTFS route uses both facilities in sequence; the official
  // guide also lists both for this car-position/gate pair. Avoid saying “or”
  // for a paper that follows the selected route.
  // The home-to-gate official guidance is the elevator near car 8. The
  // escalator belongs to the post-gate route toward exit 7 and is kept in a
  // separate metadata field so the two semantic usages are not conflated.
  '424': { stationId: '424', carPosition: '8号車付近', equipment: 'エレベーター', homeEquipment: 'エレベーター', postGateEquipment: 'エスカレーター', equipmentRelation: 'official-layered', paperDisplay: 'official-layered-rejoin', targetGate: '東京ミッドタウン方面改札', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/initiatives/accessibility/subway/kanren/pdf/barrierfree_guide_oedo.pdf' },
}
