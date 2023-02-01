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

/**
 * DevTools connection
 */

if ((globalThis as any)["__TRAX_DEVTOOLS__"]) {
    console.log("[Trax] DevTools detected");
    (globalThis as any)["__TRAX_DEVTOOLS__"].connectTrax(trax);
}
