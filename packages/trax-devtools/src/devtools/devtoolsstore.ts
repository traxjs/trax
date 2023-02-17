import { Store, StreamEvent, trax, traxEvents } from "@traxjs/trax"
import { TraxLogProcessCompute } from "@traxjs/trax/lib/types";
import { APP_EVENT_TYPE, DtClientAPI, DtDevToolsData, DtEventGroup, DtLogCycle, DtLogEvent, PCG_NAME_COMPUTE, PCG_NAME_RECONCILIATION, PROCESSING_GROUP_END, PROCESSING_GROUP_TYPE } from "./types";

export type DevToolsStore = ReturnType<typeof createDevToolsStore>;

export function createDevToolsStore(client: DtClientAPI) {

    return trax.createStore("DevToolsStore", (store: Store<DtDevToolsData>) => {
        const data = store.init({
            rootStores: [],
            rendererStores: [],
            logs: [],
            lastCycleId: -1,
            logFilters: {
                includePropertyGet: false,
                includeNew: false,
                includeDispose: false,
                includeProcessingEnd: false,
                includeProcessorSkip: false,
                includeEmptyProcessingGroups: true,
                includePropertySet: true,
                includeInfoMessages: true,
                includeWarningMessages: true,
                includeErrorMessages: true,
                includeProcessorDirty: true,
                includeAppEvents: true,
                includeRender: true,
                includeReconciliation: true,
                includeCompute: true,
            }
        });

        function reset() {
            client.startMonitoring();
            updateFilters();
            client.onChange(processEvents);
        }

        function processEvents(eventGroup: DtEventGroup) {
            ingestNewEvents(eventGroup, store);
        }

        function updateFilters(yesGroupActive: boolean = true, noGroupActive: boolean = false) {
            const filters = data.logFilters;
            filters.includePropertyGet = noGroupActive;
            filters.includeNew = noGroupActive;
            filters.includeDispose = noGroupActive;
            filters.includeProcessorSkip = noGroupActive;
            filters.includeProcessingEnd = noGroupActive;
            filters.includeEmptyProcessingGroups = yesGroupActive;
            filters.includePropertySet = yesGroupActive;
            filters.includeInfoMessages = yesGroupActive;
            filters.includeWarningMessages = yesGroupActive;
            filters.includeErrorMessages = yesGroupActive;
            filters.includeProcessorDirty = yesGroupActive;
            filters.includeAppEvents = yesGroupActive;
            filters.includeRender = yesGroupActive;
            filters.includeReconciliation = yesGroupActive;
            filters.includeCompute = yesGroupActive;
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
            resetFilters() {
                updateFilters();
            },
            /** Update filters to show or hide all logs */
            updateAllFilters(value: boolean) {
                updateFilters(value, value);
            }
        }

    });
}

function ingestNewEvents(eventGroup: DtEventGroup, store: Store<DtDevToolsData>) {
    const cycleId = eventGroup.cycleId;
    let elapsedMs = 0;
    let computeMs = 0;


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

    const data = store.root;
    const logs = data.logs;
    const len = logs.length;
    if (len > 0 && data.lastCycleId > -1) {
        const lastCycleId = data.lastCycleId;
        if (cycleId > lastCycleId + 1) {
            // Some cycles were missed? -> raise a warning
            const errEvts: DtLogEvent[] = [];
            const msg = `"Missing log cycles detected: expected cycle #${lastCycleId + 1} instead of #${cycleId}"`; // JSON stringified -> keep the outer quotes
            ingestEvent(0, [{ id: `${lastCycleId + 1}:1`, type: traxEvents.Error, data: msg }], errEvts, 0);
            addLogCycle(lastCycleId + 1, [{
                id: `${lastCycleId + 1}:1`, type: traxEvents.Error, data: msg
            }], 0, 0);
        }
    }
    addLogCycle(cycleId, groupEvents, i, last - 1, elapsedMs, computeMs);

    function addLogCycle(cycleId: number, groupEvents: StreamEvent[], startIdx: number, lastIdx: number, elapsedMs = 0, computeMs = 0) {
        const logCycle = store.add<DtLogCycle>(["LogCycle", cycleId], {
            cycleId,
            elapsedMs,
            computeMs,
            events: [],
            expanded: true,
            matchFilter: true, // computed
            contentSize: 1     // computed
        }, (logCycle, cc) => {
            // events ingestion (run once)
            cc.maxComputeCount = 1; // run once

            const evts: DtLogEvent[] = [];
            let i = startIdx
            while (i <= lastIdx) {
                i = ingestEvent(i, groupEvents, evts, 0);
            }
            logCycle.events = evts;
        }, (logCycle) => {
            // decorate events according to logFilters
            const filter = store.root.logFilters;

            // process the filter for this filter key
            const sz = filterEvents(logCycle.events, filter);
            logCycle.contentSize = sz;
            logCycle.matchFilter = sz > 0;
        });

        logs.push(logCycle);
        data.lastCycleId = cycleId;
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
        // DtProcessingGroup | DtTraxPgStoreInit | DtTraxPgCompute | DtTraxPgCollectionUpdate | DtTraxPgReconciliation | DtTraxPgEnd
        idx += 1;
        const name = d.name;
        let childEvent = groupEvents[idx];
        let resume = (tp === traxEvents.ProcessingResume);
        let async = resume;

        const pcgEvents: DtLogEvent[] = [];
        let endReached = false;
        while (childEvent && !endReached) {
            if (childEvent.type === traxEvents.ProcessingPause) {
                if (!async) {
                    async = true;
                }
                endReached = true;
            } else {
                endReached = childEvent.type === traxEvents.ProcessingEnd;
            }
            idx = ingestEvent(idx, groupEvents, pcgEvents, level + 1);
            childEvent = groupEvents[idx];
        }
        const type = PROCESSING_GROUP_TYPE;
        const expanded = level < 2;
        if (name === "!StoreInit") {
            // DtTraxPgStoreInit
            parent.push({ id, type, storeId: d.storeId, name, async, resume, events: pcgEvents, contentSize: 1, matchFilter: true, expanded });
        } else if (name === PCG_NAME_COMPUTE) {
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
        return idx;
    } else if (tp === traxEvents.ProcessingEnd || tp === traxEvents.ProcessingPause) {
        parent.push({ id, type: PROCESSING_GROUP_END, isPause: (tp === traxEvents.ProcessingPause), matchFilter: true })
    } else if (tp === traxEvents.Set) {
        // TraxLogPropSet
        parent.push({ id, type: tp, objectId: d.objectId, propName: d.propName, fromValue: d.fromValue, toValue: d.toValue, matchFilter: true });
    } else if (tp === traxEvents.ProcessorDirty) {
        parent.push({ id, type: tp, processorId: d.processorId, objectId: d.objectId, propName: d.propName, matchFilter: true });
    } else if (tp === traxEvents.ProcessorSkipped) {
        parent.push({ id, type: tp, processorId: d.processorId, matchFilter: true });
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
        } else if (tp === PROCESSING_GROUP_TYPE) {
            let sz = filterEvents(e.events, filter);
            let match = false;
            if (e.name === PCG_NAME_COMPUTE) {
                const lpc = (e as any as TraxLogProcessCompute);
                if (lpc.isRenderer) {
                    match = filter.includeRender || sz > 0;
                } else {
                    // standard compute
                    match = filter.includeCompute || sz > 0;
                }
            } else if (e.name === PCG_NAME_RECONCILIATION) {
                match = filter.includeReconciliation || sz > 0;
            } else if (sz || filter.includeEmptyProcessingGroups) {
                match = true;
            }
            if (match) {
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
        } else if (tp === PROCESSING_GROUP_END) {
            update(filter.includeProcessingEnd, e);
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
        } else if (tp === traxEvents.ProcessorSkipped) {
            update(filter.includeProcessorSkip, e);
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
