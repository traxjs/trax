import { Store, StreamEvent, trax, traxEvents } from "@traxjs/trax"
import { JSONValue, TraxLogCycle, TraxLogMsg } from "@traxjs/trax/lib/types";
import { DtClientAPI, DtDevToolsData, DtEventGroup, DtLogCycle, DtLogEvent } from "./types";

export type DevToolsStore = ReturnType<typeof createDevToolsStore>;

export function createDevToolsStore(client: DtClientAPI) {

    return trax.createStore("DevToolsStore", (store: Store<DtDevToolsData>) => {
        const data = store.init({
            rootStores: [],
            rendererStores: [],
            $$logs: [],
            logFilters: {
                key: "", // computed
                includePropertyGet: false,
                includeNew: false,
                includeDispose: false,
                includeEmptyProcessingGroups: true
            }
        });
        const filters = data.logFilters;

        store.compute("FilterKey", () => {
            // create a unique key that represents the filter signature in order to cache the filter results
            const boolProps = ["includeEmptyProcessingGroups", "includePropertyGet", "includeNew", "includeDispose"];
            filters.key = boolProps.map((propName) => (filters as any)[propName] ? "Y" : "N").join("");
        });

        function reset() {
            client.activateLogs();
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

    const logs = store.root.$$logs;
    const len = logs.length;
    if (len > 0) {
        const lastCycleId = logs[len - 1].cycleId;
        if (cycleId > lastCycleId + 1) {
            // Some cycles were missed? -> raise a warning
            const errEvts: DtLogEvent[] = [];
            const msg = `"Missing log cycles detected: expected cycle #${lastCycleId + 1} instead of #${cycleId}"`; // JSON stringified -> keep the outer quotes
            ingestEvent(0, [{ id: `${lastCycleId + 1}:1`, type: traxEvents.Error, data: msg }], errEvts);
            addLogCycle(lastCycleId + 1, errEvts);
        }
    }
    addLogCycle(cycleId, evts, elapsedMs, computeMs);

    function addLogCycle(cycleId: number, events: DtLogEvent[], elapsedMs = 0, computeMs = 0) {
        const logCycle = store.add<DtLogCycle>(["LogCycle", cycleId], {
            cycleId,
            elapsedMs,
            computeMs,
            $$events: events,
            $filteredEvents: undefined, // avoid class polymorphism,
            filterKey: ""
        });

        logs.push(logCycle);

        // create a processor to process the filtered value
        store.compute(["LogView", cycleId], () => {
            const filter = store.root.logFilters;
            const fkey = filter.key;
            if (logCycle.filterKey !== fkey) {
                logCycle.filterKey = fkey;

                // TODO trax.buildIdSuffix() to avoid calculating the id twice
                const listId = `LogView:${cycleId}:${fkey}`;
                // use trax cache to avoid re-processing if filter key didn't change
                let lc = store.get<DtLogEvent[]>(listId);
                if (lc) {
                    logCycle.$filteredEvents = lc;
                } else {
                    // process the filter for this filter key
                    const r = filterEvents(events, filter);
                    if (r !== undefined) {
                        logCycle.$filteredEvents = store.add<DtLogEvent[]>(listId, r);
                    } else {
                        // Nothing to show for this cycle with the current filter
                        logCycle.$filteredEvents = undefined;
                    }
                }
            }
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

function ingestEvent(idx: number, groupEvents: StreamEvent[], parent: DtLogEvent[]) {
    const event = groupEvents[idx];
    const id = event.id;
    const tp = event.type;
    // TODO: parentId
    let d = parseData(event.data);
    if (tp === traxEvents.Get) {
        // TraxLogPropGet
        parent.push({ id, type: tp, objectId: d.objectId, propName: d.propName, propValue: d.propValue });
    } else if (tp === traxEvents.New || tp === traxEvents.Dispose) {
        // TraxLogObjectLifeCycle
        parent.push({ id, type: tp, objectId: d.objectId, objectType: d.objectType });
    } else if (tp === traxEvents.ProcessingStart || tp === traxEvents.ProcessingResume) {
        // DtProcessingGroup | DtTraxPgStoreInit | DtTraxPgCompute | DtTraxPgCollectionUpdate | DtTraxPgReconciliation
        idx += 1;
        const name = d.name;
        let childEvent = groupEvents[idx];
        let resume = (tp === traxEvents.ProcessingResume);
        let async = resume;

        const pcgEvents: DtLogEvent[] = [];
        while (childEvent && childEvent.type !== traxEvents.ProcessingEnd && childEvent.type !== traxEvents.ProcessingPause) {
            idx = ingestEvent(idx, groupEvents, pcgEvents);
            childEvent = groupEvents[idx];
        }
        if (!async && childEvent && childEvent.type === traxEvents.ProcessingPause) {
            async = true;
        }
        const type = "!PCG";
        if (name === "!StoreInit") {
            // DtTraxPgStoreInit
            parent.push({ id, type, storeId: d.storeId, name, async, resume, $$events: pcgEvents });
        } else if (name === "!Compute") {
            parent.push({
                id, type, storeId: d.storeId, name, async, resume, $$events: pcgEvents,
                processorId: d.processorId,
                computeCount: d.computeCount,
                processorPriority: d.processorPriority,
                trigger: d.trigger,
                isRenderer: d.isRenderer === true
            });
        } else if (name === "!ArrayUpdate" || name === "!DictionaryUpdate") {
            parent.push({ id, type, name, async, resume, objectId: d.objectId, $$events: pcgEvents });
        } else {
            // DtProcessingGroup
            parent.push({ id, type, name, async, resume, $$events: pcgEvents });
        }
    } else if (tp === traxEvents.Set) {
        // TraxLogPropSet
        parent.push({ id, type: tp, objectId: d.objectId, propName: d.propName, fromValue: d.fromValue, toValue: d.toValue });
    } else if (tp === traxEvents.ProcessorDirty) {
        parent.push({ id, type: tp, processorId: d.processorId, objectId: d.objectId, propName: d.propName });
    } else if (tp === traxEvents.Info || tp === traxEvents.Error || tp === traxEvents.Warning) {
        // TraxLogMsg
        parent.push({ id, type: tp, data: d });
    } else {
        // Custom event
        parent.push({ id, type: "!EVT", eventType: tp, data: d });
    }

    return idx + 1;
}

function filterEvents(events: (DtLogEvent[]) | undefined, filter: DtDevToolsData["logFilters"]): DtLogEvent[] | undefined {
    const r: DtLogEvent[] = [];
    if (!events) return undefined;

    // TODO: shortcut for All and Nothing
    for (const e of events) {
        const tp = e.type; // "!ERR" | "!EVT" | "!LOG" | "!WRN" | "!NEW" | "!DEL" | "!SET" | "!GET" | "!DRT" | "!PCG"
        if (tp === traxEvents.Get) {
            add(filter.includePropertyGet, e);
        } else if (tp === traxEvents.New) {
            add(filter.includeNew, e);
        } else if (tp === traxEvents.Dispose) {
            add(filter.includeDispose, e);
        } else if (tp === "!PCG") {
            const evts = filterEvents(e.$$events, filter);
            if (evts || filter.includeEmptyProcessingGroups) {
                r.push({
                    ...e,
                    $$events: evts
                });
            }
        } else {
            r.push(e);
        }
    }

    function add(condition: boolean, e: DtLogEvent) {
        if (condition) {
            r.push(e);
        }
    }

    return r.length ? r : undefined;
}
