import { createTraxEnv } from "./core";


export const trax = createTraxEnv();

export type {
    Trax,
    Store,
    TraxProcessor,
    EventStream,
    StreamEvent,
    TraxLogObjectLifeCycle,
    TraxLogProcDirty,
    TraxLogProcessStart,
    TraxLogPropGet,
    TraxLogPropSet,
    TraxComputeTrigger
} from "./types";

export {
    TraxObjectType,
    traxEvents
} from "./types";


