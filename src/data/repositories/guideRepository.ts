import type { PrintableGuide } from '../../domain/types'

/** Replace fixture implementation with an ODPT/server adapter; UI depends only on this interface. */
export interface GuideRepository { getInitialGuide(): Promise<PrintableGuide> }
