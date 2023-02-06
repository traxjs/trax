import { Store, StreamEvent, trax, traxEvents } from "@traxjs/trax"
import { JSONValue, TraxLogCycle, TraxLogMsg } from "@traxjs/trax/lib/types";
import { DtClientAPI, DtDevToolsData, DtEventGroup, DtLogCycle, DtLogEvent } from "./types";

export type DevToolsStore = ReturnType<typeof createDevToolsStore>;

export function createDevToolsStore(client: DtClientAPI) {
    return trax.createStore("DevToolsStore", (store: Store<DtDevToolsData>) => {
        const data = store.init({
            rootStores: [],
            rendererStores: [],
            $$logs: []
        });

        function reset() {
            client.activateLogs();
            client.onChange(processEvents);
        }

        function processEvents(eventGroup: DtEventGroup) {
            ingestNewEvents(eventGroup, store);
        }

        reset();

        return {
            /** Devtools data */
            data,
            /** Re-initialize the store */
            reset,
            /** Dispose the devtools and stop log push */
            dispose() {
                client.deactivateLogs();
            }
        }

    });
}

function ingestNewEvents(eventGroup: DtEventGroup, store: Store<DtDevToolsData>) {
    const cycleId = eventGroup.cycleId;
    let elapsedMs = 0;
    let computeMs = 0;
    const evts: DtLogEvent[] = [];

    const groupEvents = eventGroup.events;
    let last = groupEvents.length - 1;
    let i = 1;

    if (groupEvents[0].type === traxEvents.CycleStart) {
        elapsedMs = parseData(groupEvents[0].data).elapsedTime;
    } else {
        // TODO
        console.error("[DevTools.ingestNewEvents] Invalid Event Group: CycleStart not found");
        i = 0;
    }
    if (groupEvents[last].type === traxEvents.CycleComplete) {
        computeMs = parseData(groupEvents[last].data).elapsedTime;
    } else {
        // TODO
        console.error("[DevTools.ingestNewEvents] Invalid Event Group: CycleComplete not found");
        last++;
    }
    while (i < last) {
        i = ingestEvent(i, groupEvents, evts);
    }

    // Add log data to $$logs
    const logCycle = store.add<DtLogCycle>(["LogCycle", cycleId], {
        cycleId,
        elapsedMs,
        computeMs,
        $$events: evts
    });
    store.root.$$logs.push(logCycle);
}

function parseData<T = any>(data?: string) {
    let d = "";
    if (data) {
        try {
            d = JSON.parse(data);
        } catch (ex) {
            // TODO
        }
    }
    return d as T;
}

function ingestEvent(idx: number, groupEvents: StreamEvent[], parent: DtLogEvent[]) {
    const event = groupEvents[idx];
    const id = event.id;
    const tp = event.type;
    // TODO: parentId
    let d = parseData(event.data);
    if (tp === traxEvents.Get) {
        // TraxLogPropGet
        parent.push({ id, type: tp, objectId: d.objectId, propName: d.propName, propValue: d.propValue });
    } else if (tp === traxEvents.Info || tp === traxEvents.Error || tp === traxEvents.Warning) {
        // TraxLogMsg
        parent.push({ id, type: tp, data: d });
    } else if (tp === traxEvents.New || tp === traxEvents.Dispose) {
        // TraxLogObjectLifeCycle
        parent.push({ id, type: tp, objectId: d.objectId, objectType: d.objectType });
    } else if (tp === traxEvents.ProcessingStart || tp === traxEvents.ProcessingResume) {
        // DtProcessingGroup | DtTraxPgStoreInit | DtTraxPgCompute | DtTraxPgCollectionUpdate | DtTraxPgReconciliation
        idx += 1;
        const name = d.name;
        let childEvent = groupEvents[idx];

        const pcgEvents: DtLogEvent[] = [];
        while (childEvent && childEvent.type !== traxEvents.ProcessingEnd && childEvent.type !== traxEvents.ProcessingPause) {
            idx = ingestEvent(idx, groupEvents, pcgEvents);
            childEvent = groupEvents[idx];
        }
        parent.push({ id, type: "!PCG", name, async: false, $$events: pcgEvents });
    } else if (tp === traxEvents.Set) {
        // TraxLogPropSet
        parent.push({ id, type: tp, objectId: d.objectId, propName: d.propName, fromValue: d.fromValue, toValue: d.toValue });
    } else {
        console.log("[DevTools.ingestEvent] Unsupported type", tp);
    }

    return idx + 1;
}
