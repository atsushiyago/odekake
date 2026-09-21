export interface ElderlyRouteRecommendation {
  stationId: string
  carPosition: string
  equipment: string
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
  '421': { stationId: '421', carPosition: '5号車付近', equipment: 'エレベーター', equipmentRelation: 'official-layered', paperDisplay: 'car-position-only', targetGate: 'B2出口方面', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/daimon.html' },
  '422': { stationId: '422', carPosition: '4号車付近', equipment: 'エレベーター', equipmentRelation: 'official-options', paperDisplay: 'car-position-only', targetGate: '赤羽橋口方面', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/akabanebashi.html' },
  '425': { stationId: '425', carPosition: '3号車・6号車付近', equipment: 'エスカレーター等', equipmentRelation: 'official-options', paperDisplay: 'car-position-only', targetGate: '1出口方面', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/aoyama-itchome.html' },
  '428': { stationId: '428', carPosition: '3〜8号車付近', equipment: 'エスカレーター等', equipmentRelation: 'official-options', paperDisplay: 'car-position-only', targetGate: 'A1出口方面', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/shinjuku.html' },
  '402': { stationId: '402', carPosition: '7号車付近', equipment: 'エスカレーター', equipmentRelation: 'official-layered', paperDisplay: 'official-layered-rejoin', targetGate: 'D3出口方面', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/shinjuku-nishiguchi.html' },
  '410': { stationId: '410', carPosition: '6号車付近', equipment: 'エスカレーター', equipmentRelation: 'official-layered', paperDisplay: 'official-layered-rejoin', targetGate: 'A7出口方面', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/ueno-okachimachi.html' },
  '423': { stationId: '423', carPosition: '4号車付近', equipment: 'エレベーター', equipmentRelation: 'official-layered', paperDisplay: 'official-layered-rejoin', targetGate: '改札', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/initiatives/accessibility/subway/kanren/pdf/barrierfree_guide_oedo.pdf' },
  '427': { stationId: '427', carPosition: '5号車付近', equipment: 'エレベーター', equipmentRelation: 'official-layered', paperDisplay: 'official-layered-rejoin', targetGate: '改札', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/initiatives/accessibility/subway/kanren/pdf/barrierfree_guide_oedo.pdf' },
  '403': { stationId: '403', carPosition: '5号車付近', equipment: 'エレベーター', equipmentRelation: 'official-layered', paperDisplay: 'official-layered-rejoin', targetGate: '改札', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/initiatives/accessibility/subway/kanren/pdf/barrierfree_guide_oedo.pdf' },
  '429': { stationId: '429', carPosition: '4号車付近', equipment: 'エレベーター', equipmentRelation: 'official-layered', paperDisplay: 'official-layered-rejoin', targetGate: '改札', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/initiatives/accessibility/subway/kanren/pdf/barrierfree_guide_oedo.pdf' },
  '426': { stationId: '426', carPosition: '4号車付近', equipment: 'エレベーター', targetGate: '国立競技場方面改札', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/initiatives/accessibility/subway/kanren/pdf/barrierfree_guide_oedo.pdf' },
  // The selected GTFS route uses both facilities in sequence; the official
  // guide also lists both for this car-position/gate pair. Avoid saying “or”
  // for a paper that follows the selected route.
  '424': { stationId: '424', carPosition: '8号車付近', equipment: 'エレベーター・エスカレーターの案内', equipmentRelation: 'official-options', targetGate: '東京ミッドタウン方面改札', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/initiatives/accessibility/subway/kanren/pdf/barrierfree_guide_oedo.pdf' },
}
