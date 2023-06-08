import { createTraxEnv } from "./core";
import { Trax } from "./types";

let _trax: Trax;

// trax must be unique
// this prevents bugs that would appear when trax is loaded multiple times
if ((globalThis as any)["trax"]) {
    _trax = (globalThis as any)["trax"];
} else {
    _trax = createTraxEnv();
}
(globalThis as any)["trax"] = _trax

export const trax = _trax;

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
