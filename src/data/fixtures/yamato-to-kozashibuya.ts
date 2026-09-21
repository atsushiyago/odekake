import type { PrintableGuide } from '../../domain/types'

export const yamatoToKozashibuyaFixture: PrintableGuide = {
  contact: '家族：090-1234-5678',
  trip: {
    id: 'fixture-yamato-kozashibuya-weekday', serviceDate: '平日（fixture）', leaveHomeAt: '14:45', arriveBy: '15:30ごろ',
    originLabel: '大和駅', destinationLabel: '大和市渋谷学習センター',
    arrivalStation: { id: 'odpt.Station:Odakyu.Enoshima.KozaShibuya', name: '高座渋谷駅', operator: '小田急電鉄', line: '江ノ島線' },
    legs: [{ id: 'leg-1', from: { id: 'odpt.Station:Odakyu.Enoshima.Yamato', name: '大和駅', operator: '小田急電鉄', line: '江ノ島線' }, to: { id: 'odpt.Station:Odakyu.Enoshima.KozaShibuya', name: '高座渋谷駅', operator: '小田急電鉄', line: '江ノ島線' }, service: '各駅停車', platform: '2番ホーム', direction: '片瀬江ノ島・藤沢方面', boardAt: '15:00（fixture）', alightAt: '15:10（fixture）' }]
  },
  stationGuide: {
    id: 'fixture-koza-shibuya-west-exit', station: { id: 'odpt.Station:Odakyu.Enoshima.KozaShibuya', name: '高座渋谷駅', operator: '小田急電鉄', line: '江ノ島線' }, arrivalPlatform: '到着ホーム（要 実データ照合）', gate: '西口改札', exit: '西口',
    steps: [
      { id: '1', instruction: 'ホーム中央の上り階段・エスカレーターで上がる。', facility: 'escalator' },
      { id: '2', instruction: '案内板の「西口改札」へ進む。', facility: 'gate' },
      { id: '3', instruction: '西口改札を出る。', facility: 'exit' }
    ],
    officialSourceUrl: 'https://www.odakyu.jp/station/koza_shibuya/', verifiedAt: '2026-09-20', confidence: 'needs-review', safeAlternative: '不安になったら、駅員さんに「大和市渋谷学習センターへ行く西口改札はどちらですか」と、この紙を見せて聞いてください。'
  },
  walkingRoute: {
    id: 'fixture-koza-shibuya-west-to-learning-center', from: { label: '高座渋谷駅 西口' }, to: { label: '大和市渋谷学習センター' }, distanceMeters: 550, baseMinutes: 8, slowWalkingMultiplier: 1.5,
    directions: ['西口を出たら、目的地の案内を確認する。', 'この地図は概略図です。交差点では周囲の案内表示を確認する。', '大和市渋谷学習センターに着く。'], verifiedAt: '2026-09-20', confidence: 'needs-review'
  }
}
