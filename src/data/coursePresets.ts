import type { OfficialDeparturePlatformAssignment, OfficialPlatformAssignment } from '../domain/itineraryConnection'
import type { WalkingRoute } from '../domain/types'
import { akabanebashiOfficialDeparturePlatformAssignments, akabanebashiOfficialPlatformAssignments, aoyamaItchomeOfficialPlatformAssignments, azabuJubanOfficialPlatformAssignments, daimonOfficialDeparturePlatformAssignments, daimonOfficialPlatformAssignments, higashiShinjukuOfficialPlatformAssignments, higashiShinjukuToShinjukuNishiguchiOfficialDeparturePlatformAssignments, kokuritsuKyogijoOfficialPlatformAssignments, kokuritsuToYoyogiOfficialDeparturePlatformAssignments, roppongiOfficialDeparturePlatformAssignments, roppongiOfficialPlatformAssignments, roppongiToAoyamaOfficialDeparturePlatformAssignments, shinjukuNishiguchiOfficialPlatformAssignments, shinjukuNishiguchiToHigashiOfficialDeparturePlatformAssignments, shinjukuOfficialDeparturePlatformAssignments, shinjukuOfficialPlatformAssignments, tochomaeOfficialPlatformAssignments, uenoOkachimachiOfficialPlatformAssignments, yoyogiOfficialPlatformAssignments, yoyogiToShinjukuOfficialDeparturePlatformAssignments } from './fixtures/akabanebashi-arrival-itinerary'
// The walking fixture is kept in its existing destination module.
import { akabanebashiToTokyoTowerWalkingRoute as tokyoTowerWalkingRoute } from './fixtures/akabanebashi-to-tokyo-tower'
import { azabuJubanExit7ToPatioJubanWalkingRoute, aoyamaItchomeExit1ToJinguGaienWalkingRoute, daimonB2ToKyuShibaRikyuWalkingRoute, higashiShinjukuA2ToBunkaCenterWalkingRoute, kokuritsuA2ToStadiumWalkingRoute, roppongiExit7ToNationalArtCenterWalkingRoute, shinjukuA1ToSouthernTowerWalkingRoute, shinjukuNishiguchiD3ToOmoideYokochoWalkingRoute, tochomaeA4ToTokyoMetropolitanGovernmentWalkingRoute, uenoOkachimachiA7ToAmeyokoWalkingRoute, yoyogiA2ToMeijiJinguYoyogiGateWalkingRoute } from './fixtures/additional-outdoor-routes'

export interface OutingCoursePreset {
  id: string; label: string
  originStationId: string; originStationName: string
  arrivalStationId: string; arrivalStationName: string
  destination: { name: string; latitude?: number; longitude?: number; sourceUrl?: string }
  /** Optional official floor corroboration for the arrival platform. */
  arrivalPlatformFloor?: { label: string; levelIndex: number; sourceUrl: string }
  preferredExitId?: string | string[]
  departurePlatformAssignments: OfficialDeparturePlatformAssignment[]
  arrivalPlatformAssignments: OfficialPlatformAssignment[]
  walkingRoute?: WalkingRoute
  unavailableReason?: string
}

export const outingCoursePresets: OutingCoursePreset[] = [
  {
    id: 'daimon-akabanebashi-tokyo-tower', label: '東京タワー', originStationId: '421', originStationName: '大門', arrivalStationId: '422', arrivalStationName: '赤羽橋',
    destination: { name: '東京タワー（フットタウン）', latitude: 35.658581, longitude: 139.745433, sourceUrl: 'https://www.tokyotower.co.jp/access/railroad/' }, preferredExitId: '422N0012', arrivalPlatformFloor: { label: '地下2階', levelIndex: -2, sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/akabanebashi.html' },
    departurePlatformAssignments: daimonOfficialDeparturePlatformAssignments, arrivalPlatformAssignments: akabanebashiOfficialPlatformAssignments, walkingRoute: tokyoTowerWalkingRoute,
  },
  {
    id: 'daimon-roppongi-national-art-center', label: '国立新美術館', originStationId: '421', originStationName: '大門', arrivalStationId: '424', arrivalStationName: '六本木',
    destination: { name: '国立新美術館', latitude: 35.66519, longitude: 139.72636, sourceUrl: 'https://www.nact.jp/information/access/' }, preferredExitId: '424N0053',
    arrivalPlatformFloor: { label: '地下5階', levelIndex: -5, sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/roppongi.html' },
    departurePlatformAssignments: daimonOfficialDeparturePlatformAssignments, arrivalPlatformAssignments: roppongiOfficialPlatformAssignments, walkingRoute: roppongiExit7ToNationalArtCenterWalkingRoute,
  },
  {
    id: 'roppongi-kokuritsu-kyogijo-national-stadium', label: '国立競技場', originStationId: '424', originStationName: '六本木', arrivalStationId: '426', arrivalStationName: '国立競技場',
    destination: { name: '国立競技場', latitude: 35.677784, longitude: 139.713608, sourceUrl: 'https://jns-e.com/access/' }, preferredExitId: ['426N0139', '426N0241'], arrivalPlatformFloor: { label: '地下3階', levelIndex: -3, sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/kokuritsu-kyogijo.html' },
    departurePlatformAssignments: roppongiOfficialDeparturePlatformAssignments, arrivalPlatformAssignments: kokuritsuKyogijoOfficialPlatformAssignments, walkingRoute: kokuritsuA2ToStadiumWalkingRoute,
  },
  {
    id: 'akabanebashi-daimon-kyu-shiba-rikyu', label: '旧芝離宮恩賜庭園', originStationId: '422', originStationName: '赤羽橋', arrivalStationId: '421', arrivalStationName: '大門',
    destination: { name: '旧芝離宮恩賜庭園', latitude: 35.65545, longitude: 139.756697, sourceUrl: 'https://www.tokyo-park.or.jp/park/kyu-shiba-rikyu/' }, preferredExitId: '421N0015', arrivalPlatformFloor: { label: '地下5階', levelIndex: -5, sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/daimon.html' },
    departurePlatformAssignments: akabanebashiOfficialDeparturePlatformAssignments, arrivalPlatformAssignments: daimonOfficialPlatformAssignments, walkingRoute: daimonB2ToKyuShibaRikyuWalkingRoute,
  },
  {
    id: 'daimon-azabu-juban-patio-juban', label: 'パティオ十番', originStationId: '421', originStationName: '大門', arrivalStationId: '423', arrivalStationName: '麻布十番',
    destination: { name: 'パティオ十番（きみちゃん像）', latitude: 35.65517, longitude: 139.73512, sourceUrl: 'https://www.azabujuban.or.jp/about/' }, preferredExitId: '423N0063', arrivalPlatformFloor: { label: '地下6階', levelIndex: -6, sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/azabu-juban.html' },
    departurePlatformAssignments: daimonOfficialDeparturePlatformAssignments, arrivalPlatformAssignments: azabuJubanOfficialPlatformAssignments, walkingRoute: azabuJubanExit7ToPatioJubanWalkingRoute,
  },
  {
    id: 'roppongi-aoyama-itchome-jingu-gaien', label: '明治神宮外苑いちょう並木', originStationId: '424', originStationName: '六本木', arrivalStationId: '425', arrivalStationName: '青山一丁目',
    destination: { name: '明治神宮外苑いちょう並木', latitude: 35.672401, longitude: 139.720975, sourceUrl: 'https://www.meijijingugaien.jp/' }, preferredExitId: '425N0123', arrivalPlatformFloor: { label: '地下5階', levelIndex: -5, sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/aoyama-itchome.html' },
    departurePlatformAssignments: roppongiToAoyamaOfficialDeparturePlatformAssignments, arrivalPlatformAssignments: aoyamaItchomeOfficialPlatformAssignments, walkingRoute: aoyamaItchomeExit1ToJinguGaienWalkingRoute,
  },
  {
    id: 'kokuritsu-kyogijo-yoyogi-meiji-jingu', label: '明治神宮・代々木口', originStationId: '426', originStationName: '国立競技場', arrivalStationId: '427', arrivalStationName: '代々木',
    destination: { name: '明治神宮・代々木口', latitude: 35.682642, longitude: 139.701892, sourceUrl: 'https://www.meijijingu.or.jp/access/' }, preferredExitId: '427N0084', arrivalPlatformFloor: { label: '地下3階', levelIndex: -3, sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/yoyogi.html' },
    departurePlatformAssignments: kokuritsuToYoyogiOfficialDeparturePlatformAssignments, arrivalPlatformAssignments: yoyogiOfficialPlatformAssignments, walkingRoute: yoyogiA2ToMeijiJinguYoyogiGateWalkingRoute,
  },
  {
    id: 'shinjuku-nishiguchi-higashi-shinjuku-bunka-center', label: '新宿文化センター', originStationId: '402', originStationName: '新宿西口', arrivalStationId: '403', arrivalStationName: '東新宿',
    destination: { name: '新宿文化センター', latitude: 35.695443, longitude: 139.70945, sourceUrl: 'https://www.regasu-shinjuku.or.jp/bunka-center/traffic-access/' }, preferredExitId: ['403N0019', '403N0020'], arrivalPlatformFloor: { label: '地下3階', levelIndex: -3, sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/higashi-shinjuku.html' },
    departurePlatformAssignments: shinjukuNishiguchiToHigashiOfficialDeparturePlatformAssignments, arrivalPlatformAssignments: higashiShinjukuOfficialPlatformAssignments, walkingRoute: higashiShinjukuA2ToBunkaCenterWalkingRoute,
  },
  {
    id: 'yoyogi-shinjuku-southern-tower', label: 'サザンタワー', originStationId: '427', originStationName: '代々木', arrivalStationId: '428', arrivalStationName: '新宿',
    destination: { name: '小田急ホテルセンチュリーサザンタワー', latitude: 35.686442, longitude: 139.700367, sourceUrl: 'https://www.southerntower.co.jp/access/' }, preferredExitId: '428N0193', arrivalPlatformFloor: { label: '地下6階', levelIndex: -6, sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/shinjuku.html' },
    departurePlatformAssignments: yoyogiToShinjukuOfficialDeparturePlatformAssignments, arrivalPlatformAssignments: shinjukuOfficialPlatformAssignments, walkingRoute: shinjukuA1ToSouthernTowerWalkingRoute,
  },
  {
    id: 'higashi-shinjuku-shinjuku-nishiguchi-omoide-yokocho', label: '思い出横丁', originStationId: '403', originStationName: '東新宿', arrivalStationId: '402', arrivalStationName: '新宿西口',
    destination: { name: '新宿西口 思い出横丁', latitude: 35.693093, longitude: 139.699502, sourceUrl: 'https://shinjuku-omoide.com/access' }, preferredExitId: '402N0002', arrivalPlatformFloor: { label: '地下4階', levelIndex: -4, sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/shinjuku-nishiguchi.html' },
    departurePlatformAssignments: higashiShinjukuToShinjukuNishiguchiOfficialDeparturePlatformAssignments, arrivalPlatformAssignments: shinjukuNishiguchiOfficialPlatformAssignments, walkingRoute: shinjukuNishiguchiD3ToOmoideYokochoWalkingRoute,
  },
  {
    id: 'shinjuku-nishiguchi-ueno-okachimachi-ameyoko', label: 'アメ横', originStationId: '402', originStationName: '新宿西口', arrivalStationId: '410', arrivalStationName: '上野御徒町',
    destination: { name: 'アメ横', latitude: 35.7100241, longitude: 139.7745414, sourceUrl: 'https://www.ameyoko.net/access/' }, preferredExitId: '410N0016', arrivalPlatformFloor: { label: '地下2階', levelIndex: -2, sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/ueno-okachimachi.html' },
    departurePlatformAssignments: shinjukuNishiguchiToHigashiOfficialDeparturePlatformAssignments, arrivalPlatformAssignments: uenoOkachimachiOfficialPlatformAssignments, walkingRoute: uenoOkachimachiA7ToAmeyokoWalkingRoute,
  },
  {
    id: 'shinjuku-tochomae-tokyo-metropolitan-government', label: '東京都庁展望室', originStationId: '428', originStationName: '新宿', arrivalStationId: '429', arrivalStationName: '都庁前',
    destination: { name: '東京都庁展望室', latitude: 35.6902989, longitude: 139.6915456, sourceUrl: 'https://www.zaimu.metro.tokyo.lg.jp/tochousha/goannai/tenbou' }, preferredExitId: '429N0093', arrivalPlatformFloor: { label: '地下3階', levelIndex: -3, sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/tochomae.html' },
    departurePlatformAssignments: shinjukuOfficialDeparturePlatformAssignments, arrivalPlatformAssignments: tochomaeOfficialPlatformAssignments, walkingRoute: tochomaeA4ToTokyoMetropolitanGovernmentWalkingRoute,
  },
]

export const outingCoursePresetById = new Map(outingCoursePresets.map(course => [course.id, course]))
