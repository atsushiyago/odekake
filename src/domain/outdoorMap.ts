export type LonLat = [number, number]

const SHORT_ROUTE_MAX_METERS = 300
const MEDIUM_ROUTE_MAX_METERS = 700
const DEFAULT_OUTDOOR_MAP_ZOOM = 17
const SHORT_ROUTE_ZOOM = 19
const MEDIUM_ROUTE_ZOOM = 18

/** Chooses a closer viewport for short walks without tying zoom to a station. */
export function outdoorMapZoomForDistance(distanceMeters?: number) {
  if (distanceMeters === undefined || !Number.isFinite(distanceMeters) || distanceMeters > MEDIUM_ROUTE_MAX_METERS) return DEFAULT_OUTDOOR_MAP_ZOOM
  if (distanceMeters <= SHORT_ROUTE_MAX_METERS) return SHORT_ROUTE_ZOOM
  return MEDIUM_ROUTE_ZOOM
}

export function webMercatorPixel([longitude, latitude]: LonLat, zoom: number) {
  const scale = 256 * 2 ** zoom
  const x = ((longitude + 180) / 360) * scale
  const sine = Math.sin((latitude * Math.PI) / 180)
  const y = (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * scale
  return [x, y] as const
}

export function fitOutdoorRouteGeometry(coordinates: LonLat[], zoom: number, width: number, height: number) {
  if (!coordinates.length) throw new Error('route geometry is empty')
  const longitudes = coordinates.map(point => point[0]), latitudes = coordinates.map(point => point[1])
  const center: LonLat = [(Math.min(...longitudes) + Math.max(...longitudes)) / 2, (Math.min(...latitudes) + Math.max(...latitudes)) / 2]
  let fittedZoom = Math.round(zoom)
  let centerPixel: readonly [number, number]
  let projected: LonLat[]
  do {
    centerPixel = webMercatorPixel(center, fittedZoom)
    projected = coordinates.map(point => {
      const [x, y] = webMercatorPixel(point, fittedZoom)
      return [x - centerPixel[0] + width / 2, y - centerPixel[1] + height / 2] as LonLat
    })
    const margin = 48
    const fits = projected.every(([x, y]) => x >= margin && x <= width - margin && y >= margin && y <= height - margin)
    if (fits || fittedZoom <= 1) break
    fittedZoom -= 1
  } while (true)
  return { center, zoom: fittedZoom, centerPixel, projected }
}
