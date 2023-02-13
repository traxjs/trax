import { Store, StreamEvent, trax, traxEvents } from "@traxjs/trax"
import { APP_EVENT_TYPE, DtClientAPI, DtDevToolsData, DtEventGroup, DtLogCycle, DtLogEvent } from "./types";

export type DevToolsStore = ReturnType<typeof createDevToolsStore>;

export function createDevToolsStore(client: DtClientAPI) {

    return trax.createStore("DevToolsStore", (store: Store<DtDevToolsData>) => {
        const data = store.init({
            rootStores: [],
            rendererStores: [],
            logs: [],
            logFilters: {
                key: "", // computed
                includePropertyGet: false,
                includeNew: false,
                includeDispose: false,
                includeEmptyProcessingGroups: true,
                includePropertySet: true,
                includeInfoMessages: true,
                includeWarningMessages: true,
                includeErrorMessages: true,
                includeProcessorDirty: true,
                includeAppEvents: true
            }
        });
        const filters = data.logFilters;

        store.compute("FilterKey", () => {
            // create a unique key that represents the filter signature in order to cache the filter results
            const boolProps = ["includeEmptyProcessingGroups", "includePropertyGet", "includeNew", "includeDispose"];
            filters.key = boolProps.map((propName) => (filters as any)[propName] ? "Y" : "N").join("");
        });

        function reset() {
            client.startMonitoring();
            client.onChange(processEvents);
        }

        function processEvents(eventGroup: DtEventGroup) {
            ingestNewEvents(eventGroup, store);
        }

        function resetFilters() {
            const filters = data.logFilters;
            filters.includePropertyGet = false;
            filters.includeNew = false;
            filters.includeDispose = false;
            filters.includeEmptyProcessingGroups = true;
            filters.includePropertySet = true;
            filters.includeInfoMessages = true;
            filters.includeWarningMessages = true;
            filters.includeErrorMessages = true;
            filters.includeProcessorDirty = true;
            filters.includeAppEvents = true;
        }

        reset();

        return {
            /** Devtools data */
            data,
            /** Re-initialize the store */
            reset,
            /** Dispose the devtools and stop log push */
            dispose() {
                client.stopMonitoring();
            },
            /** Reset filters to their default value */
            resetFilters,
            /** Update filters to show all logs */
            showAllLogs() {
                const filters = data.logFilters;
                filters.includeDispose = true;
                filters.includeNew = true;
                filters.includeDispose = true;
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
        console.error(`[DevToolsStore] Invalid Event Group #${cycleId}: CycleStart not found`);
        i = 0;
    }
    if (groupEvents[last].type === traxEvents.CycleComplete) {
        computeMs = parseData(groupEvents[last].data).elapsedTime;
    } else {
        // TODO
        console.error(`[DevToolsStore] Invalid Event Group #${cycleId}: CycleComplete not found`);
        last++;
    }
    while (i < last) {
        i = ingestEvent(i, groupEvents, evts, 0);
    }

    const logs = store.root.logs;
    const len = logs.length;
    if (len > 0) {
        const lastCycleId = logs[len - 1].cycleId;
        if (cycleId > lastCycleId + 1) {
            // Some cycles were missed? -> raise a warning
            const errEvts: DtLogEvent[] = [];
            const msg = `"Missing log cycles detected: expected cycle #${lastCycleId + 1} instead of #${cycleId}"`; // JSON stringified -> keep the outer quotes
            ingestEvent(0, [{ id: `${lastCycleId + 1}:1`, type: traxEvents.Error, data: msg }], errEvts, 0);
            addLogCycle(lastCycleId + 1, errEvts);
        }
    }
    addLogCycle(cycleId, evts, elapsedMs, computeMs);

    function addLogCycle(cycleId: number, events: DtLogEvent[], elapsedMs = 0, computeMs = 0) {
        const logCycle = store.add<DtLogCycle>(["LogCycle", cycleId], {
            cycleId,
            elapsedMs,
            computeMs,
            events: events,
            filterKey: "",
            expanded: true,
            matchFilter: true, // computed
            contentSize: 1     // computed
        });

        logs.push(logCycle);

        // create a processor to process the filtered value
        store.compute(["LogView", cycleId], () => {
            const filter = store.root.logFilters;
            const fkey = filter.key;
            logCycle.filterKey = fkey;

            // process the filter for this filter key
            const sz = filterEvents(logCycle.events, filter);
            logCycle.contentSize = sz;
            logCycle.matchFilter = sz > 0;
        });
    }
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

function ingestEvent(idx: number, groupEvents: StreamEvent[], parent: DtLogEvent[], level: number) {
    const event = groupEvents[idx];
    const id = event.id;
    const tp = event.type;
    // TODO: parentId
    let d = parseData(event.data);
    if (tp === traxEvents.Get) {
        // TraxLogPropGet
        parent.push({ id, type: tp, objectId: d.objectId, propName: d.propName, propValue: d.propValue, matchFilter: true });
    } else if (tp === traxEvents.New || tp === traxEvents.Dispose) {
        // TraxLogObjectLifeCycle
        parent.push({ id, type: tp, objectId: d.objectId, objectType: d.objectType, matchFilter: true });
    } else if (tp === traxEvents.ProcessingStart || tp === traxEvents.ProcessingResume) {
        // DtProcessingGroup | DtTraxPgStoreInit | DtTraxPgCompute | DtTraxPgCollectionUpdate | DtTraxPgReconciliation
        idx += 1;
        const name = d.name;
        let childEvent = groupEvents[idx];
        let resume = (tp === traxEvents.ProcessingResume);
        let async = resume;

        const pcgEvents: DtLogEvent[] = [];
        while (childEvent && childEvent.type !== traxEvents.ProcessingEnd && childEvent.type !== traxEvents.ProcessingPause) {
            idx = ingestEvent(idx, groupEvents, pcgEvents, level + 1);
            childEvent = groupEvents[idx];
        }
        if (!async && childEvent && childEvent.type === traxEvents.ProcessingPause) {
            async = true;
        }
        const type = "!PCG";
        const expanded = level < 2;
        if (name === "!StoreInit") {
            // DtTraxPgStoreInit
            parent.push({ id, type, storeId: d.storeId, name, async, resume, events: pcgEvents, contentSize: 1, matchFilter: true, expanded });
        } else if (name === "!Compute") {
            parent.push({
                id, type, storeId: d.storeId, name, async, resume, events: pcgEvents,
                processorId: d.processorId,
                computeCount: d.computeCount,
                processorPriority: d.processorPriority,
                trigger: d.trigger,
                isRenderer: d.isRenderer === true,
                contentSize: 1,
                expanded,
                matchFilter: true
            });
        } else if (name === "!ArrayUpdate" || name === "!DictionaryUpdate") {
            // Not expanded by default (little added value)
            parent.push({ id, type, name, async, resume, objectId: d.objectId, events: pcgEvents, contentSize: 1, matchFilter: true, expanded: false });
        } else {
            // DtProcessingGroup
            parent.push({ id, type, name, async, resume, events: pcgEvents, contentSize: 1, matchFilter: true, expanded });
        }
    } else if (tp === traxEvents.Set) {
        // TraxLogPropSet
        parent.push({ id, type: tp, objectId: d.objectId, propName: d.propName, fromValue: d.fromValue, toValue: d.toValue, matchFilter: true });
    } else if (tp === traxEvents.ProcessorDirty) {
        parent.push({ id, type: tp, processorId: d.processorId, objectId: d.objectId, propName: d.propName, matchFilter: true });
    } else if (tp === traxEvents.Info || tp === traxEvents.Error || tp === traxEvents.Warning) {
        // TraxLogMsg
        parent.push({ id, type: tp, data: d, matchFilter: true });
    } else {
        // Custom event
        parent.push({ id, type: APP_EVENT_TYPE, eventType: tp, data: d, matchFilter: true });
    }

    return idx + 1;
}

/** 
 * Update the contentSize attribute of a list of events according to the given filter and their expanded status
 */
function filterEvents(events: (DtLogEvent[]) | undefined, filter: DtDevToolsData["logFilters"]): number {
    if (!events) return 0;

    let count = 0;
    for (const e of events) {
        const tp = e.type; // "!ERR" | "!EVT" | "!LOG" | "!WRN" | "!NEW" | "!DEL" | "!SET" | "!GET" | "!DRT" | "!PCG"
        if (tp === traxEvents.Set) {
            update(filter.includePropertySet, e);
        } else if (tp === traxEvents.Get) {
            update(filter.includePropertyGet, e);
        } else if (tp === traxEvents.New) {
            update(filter.includeNew, e);
        } else if (tp === traxEvents.Dispose) {
            update(filter.includeDispose, e);
        } else if (tp === "!PCG") {
            let sz = filterEvents(e.events, filter);

            if (sz || filter.includeEmptyProcessingGroups) {
                e.matchFilter = true;
                e.contentSize = sz;
                count += 1;
                if (e.expanded) {
                    count += sz;
                }
            } else {
                e.matchFilter = false;
                e.contentSize = sz;
            }
        } else if (tp === APP_EVENT_TYPE) {
            update(filter.includeAppEvents, e);
        } else if (tp === traxEvents.Info) {
            update(filter.includeInfoMessages, e);
        } else if (tp === traxEvents.Warning) {
            update(filter.includeWarningMessages, e);
        } else if (tp === traxEvents.Error) {
            update(filter.includeErrorMessages, e);
        } else if (tp === traxEvents.ProcessorDirty) {
            update(filter.includeProcessorDirty, e);
        } else {
            update(true, e);
        }
    }

    function update(condition: boolean, e: DtLogEvent) {
        if (condition) {
            e.matchFilter = true;
            count++;
        } else {
            e.matchFilter = false;
        }
    }
    return count;
}
