import { createTraxEnv } from "./core";

export const trax = createTraxEnv();

export type {
    Trax,
    Store,
    TraxObject,
    TraxProcessor,
    EventStream,
    StreamEvent,
    TraxLogObjectLifeCycle,
    TraxLogProcDirty,
    TraxLogTraxProcessingCtxt,
    TraxLogPropGet,
    TraxLogPropSet,
    TraxComputeTrigger,
    TraxLogMsg,
    TraxLogEvent
} from "./types";

export {
    TraxObjectType,
    traxEvents
} from "./types";
