import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AlternateExitPaper } from './AlternateExitPaper'

describe('AlternateExitPaper', () => {
  it('renders successfully with coordinates', () => {
    const html = renderToStaticMarkup(
      <AlternateExitPaper
        stationName="赤羽橋"
        exitLabel="中之橋口"
        destinationName="東京タワー"
        exitCoordinates={{ lat: 35.655186, lon: 139.7435 }}
      />,
    )
    expect(html).toContain('赤羽橋駅 中之橋口 周辺図')
    expect(html).toContain('exit-surroundings-map')
  })
})
