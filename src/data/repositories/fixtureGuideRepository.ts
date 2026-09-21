import { yamatoToKozashibuyaFixture } from '../fixtures/yamato-to-kozashibuya'
import type { GuideRepository } from './guideRepository'
export const fixtureGuideRepository: GuideRepository = { async getInitialGuide() { return yamatoToKozashibuyaFixture } }
