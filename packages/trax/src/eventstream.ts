import { traxMD } from "./core";
import { LinkedList } from "./linkedlist";
import { LogData, StreamListEvent, StreamEvent, EventStream, SubscriptionId, ProcessingContext, traxEvents, ProcessingContextData, JSONValue, TraxLogTraxProcessingCtxt, TraxLogObjectLifeCycle, TraxLogPropGet, TraxLogProcDirty, TraxLogPropSet } from "./types";

/**
 * Resolve function used in the await map
 * This function will check the event details
 * If the event matches the awaitEvent args, then it resolves the pending promise and returns true
 * Otherwise it will return false and keep the promis unfullfiled
 */
type awaitResolve = (e: StreamEvent) => boolean;

/**
 * Create an event stream
 * The key passed as argument will be used to authorize events with reserved types
 * @param internalSrcKey 
 * @returns 
 */
export function createEventStream(internalSrcKey: any, dataStringifier?: (data: any) => string, onCycleComplete?: () => void): EventStream {
    let size = 0;
    let maxSize = 500;
    let head: StreamListEvent | undefined;
    let tail: StreamListEvent | undefined;
    const awaitMap = new Map<string, awaitResolve[]>();
    const consumers: ((e: StreamEvent) => void)[] = [];
    let consoleOutput: "None" | "All" | "AllButGet" = "None";

    // ----------------------------------------------
    // cycle id managment
    let cycleCount = -1; // cycle counter, incremented for each new cycle
    let eventCount = -1; // event counter, incremented for each new event, reset for each new cycle
    let cycleCompletePromise: null | Promise<void> = null;
    let cycleTimeMs = 0; // Time stamp used to process elapsed time values

    function generateId() {
        if (cycleCompletePromise === null) {
            // no current cycle defined
            eventCount = -1;
            cycleCount++;
            cycleCompletePromise = Promise.resolve().then(processCycleEnd);
            logCycleEvent(traxEvents.CycleStart);
        }
        eventCount++;
        return cycleCount + ":" + eventCount;
    }

    function processCycleEnd() {
        emptyPcStack();
        logCycleEvent(traxEvents.CycleComplete);
        cycleCompletePromise = null;
    }

    function logCycleEvent(type: "!CS" | "!CC") {
        if (type === traxEvents.CycleComplete && onCycleComplete) {
            onCycleComplete();
        }
        const ts = Date.now();
        const elapsedTime = cycleTimeMs !== 0 ? ts - cycleTimeMs : 0;
        cycleTimeMs = ts;
        logEvent(type, { elapsedTime }, internalSrcKey);
    }

    // ----------------------------------------------
    // Processing context

    const START = 1, PAUSE = 2, END = 3;
    // Processing context stack
    const pcStack = new LinkedList<ProcessingContext>();

    function stackPc(pc: ProcessingContext) {
        pcStack.add(pc);
    }

    function unstackPc(pc: ProcessingContext) {
        let last = pcStack.shift();
        while (last && last !== pc) {
            error("[trax/processing context] Contexts must be ended or paused before parent:", last.id);
            last = pcStack.shift();
        }
    }

    function emptyPcStack() {
        // check that the Processing Context stack is empty at the end of a cycle
        if (pcStack.size !== 0) {
            let pc = pcStack.shift();
            while (pc) {
                error("[trax/processing context] Contexts must be ended or paused before cycle ends:", pc.id);
                pc = pcStack.shift();
            }
        }
    }

    function createProcessingContext(logId: string, data: ProcessingContextData): ProcessingContext {
        let state = START;
        const evtData = {
            processId: logId,
            ...data
        }
        const pc = {
            get id() {
                return logId;
            },
            pause() {
                if (state !== START) {
                    error("[trax/processing context] Only started or resumed contexts can be paused:", logId);
                } else {
                    unstackPc(pc);
                    logEvent(traxEvents.ProcessingPause, evtData, internalSrcKey);
                    state = PAUSE;
                }
            },
            resume() {
                if (state !== PAUSE) {
                    error("[trax/processing context] Only paused contexts can be resumed:", logId);
                } else {
                    stackPc(pc);
                    logEvent(traxEvents.ProcessingResume, evtData, internalSrcKey);
                    state = START;
                }
            },
            end() {
                if (state === END) {
                    error("[trax/processing context] Contexts cannot be ended twice:", logId);
                } else {
                    unstackPc(pc);
                    logEvent(traxEvents.ProcessingEnd, evtData, internalSrcKey);
                    state = END;
                }
            }
        }
        stackPc(pc);
        return pc;
    }

    function error(...data: LogData[]) {
        logEvent(traxEvents.Error, mergeMessageData(data));
    }

    function logEvent(type: string, data?: LogData, src?: any, parentId?: string) {
        let evt: StreamListEvent;
        if (size >= maxSize && maxSize > 1) {
            evt = head!;
            head = head!.next;
            size--;
            evt.id = "";
            evt.type = "";
            evt.next = evt.data = evt.parentId = undefined;
        } else {
            evt = { id: "", type: "" }
        }

        format(internalSrcKey, evt, type, dataStringifier, data, src);
        evt.id = generateId();
        evt.parentId = parentId;
        if (evt.type !== "") {
            if (head === undefined) {
                head = tail = evt;
                size = 1;
            } else {
                // append to tail
                tail!.next = evt;
                tail = evt;
                size++;
            }
            for (const c of consumers) {
                try {
                    c({ id: evt.id, type: evt.type, data: evt.data });
                } catch (ex) { }
            }
            resolveAwaitPromises(evt.type, evt);
        }
        if (consoleOutput !== "None") {
            // output the event on the console (debug mode)
            const etp = evt.type;
            if (etp !== traxEvents.CycleStart && etp !== traxEvents.CycleComplete && (etp !== traxEvents.Get || consoleOutput === "All")) {
                let data = formatEventData(evt.type, evt.data);
                let pid = "";
                if (evt.parentId) {
                    pid = " - parent:" + evt.parentId;
                }
                console.log(`${evt.id} ${evt.type}${data ? " - " + data : ""}${pid}`);
            }
        }
        return evt;
    }

    function resolveAwaitPromises(eventType: string, e: StreamEvent) {
        const resolveList = awaitMap.get(eventType);
        if (resolveList) {
            const ls = resolveList.filter((resolve) => {
                // if resolve returns true => resolution was ok, so we remove the resolve callback from the list
                return !resolve({ id: e.id, type: e.type, data: e.data, parentId: e.parentId });
            });
            if (ls.length === 0) {
                awaitMap.delete(eventType);
            } else {
                awaitMap.set(eventType, ls);
            }
        }
    }

    return {
        get consoleOutput() {
            return consoleOutput
        },
        set consoleOutput(v: "None" | "All" | "AllButGet") {
            consoleOutput = v;
        },
        event(type: string, data?: LogData, src?: any) {
            logEvent(type, data, src);
        },
        info(...data: LogData[]) {
            logEvent(traxEvents.Info, mergeMessageData(data));
        },
        warn(...data: LogData[]) {
            logEvent(traxEvents.Warning, mergeMessageData(data));
        },
        error,
        set maxSize(sz: number) {
            const prev = maxSize;
            if (sz < 0) {
                maxSize = -1; // no limits
            } else if (sz < 2) {
                maxSize = 2; // minimum size to remove corner cases
            } else {
                maxSize = sz;
            }
            if (maxSize > 0 && maxSize < prev && maxSize < size) {
                // we need to remove the oldest elements
                let count = size - maxSize;
                while (head && count) {
                    head = head.next;
                    count--;
                    size--;
                }
            }
        },
        startProcessingContext(data: ProcessingContextData, src?: any): ProcessingContext {
            // prevent reserved names usage
            let name = data.name;
            if (name.charAt(0) === "!" && src !== internalSrcKey) {
                error(`Processing Context name cannot start with reserved prefix: ${name}`);
                data.name = name.replace(/\!+/, "");
            }
            const last = pcStack.peek();
            const parentId = last ? last.id : undefined;
            const evt = logEvent(traxEvents.ProcessingStart, data, internalSrcKey, parentId);
            return createProcessingContext(evt.id, data);
        },
        get maxSize(): number {
            return maxSize;
        },
        get size() {
            return size;
        },
        scan(eventProcessor: (itm: StreamEvent) => void | boolean) {
            let itm = head, process = true;
            while (process && itm) {
                try {
                    if (eventProcessor(itm) === false) {
                        process = false;
                    };
                    itm = itm.next;
                } catch (ex) { }
            }
        },
        lastEvent(): StreamEvent | undefined {
            return tail;
        },
        async awaitEvent(eventType: string, targetData?: string | number | boolean | Record<string, string | number | boolean>): Promise<StreamEvent> {
            if (eventType === "" || eventType === "*") {
                logEvent(traxEvents.Error, `[trax/eventStream.await] Invalid event type: '${eventType}'`);
                return { id: tail!.id, type: tail!.type, data: tail!.data };
            }
            let resolveList = awaitMap.get(eventType);
            if (resolveList === undefined) {
                resolveList = [];
                awaitMap.set(eventType, resolveList);
            }

            let r: any, p = new Promise((resolve: (e: StreamEvent) => void) => {
                r = resolve;
            });

            resolveList.push((e: StreamEvent) => {
                if (checkPropMatch(e, targetData)) {
                    r(e);
                    return true;
                }
                return false;
            });
            return p;
        },
        subscribe(eventType: string | "*", callback: (e: StreamEvent) => void): SubscriptionId {
            let fn: (e: StreamEvent) => void;
            if (eventType === "*") {
                fn = (e: StreamEvent) => callback(e);
            } else {
                fn = (e: StreamEvent) => {
                    if (e.type === eventType) {
                        callback(e);
                    }
                };
            }
            consumers.push(fn);
            return fn;
        },
        unsubscribe(subscriptionId: SubscriptionId): boolean {
            const idx = consumers.indexOf(subscriptionId as any);
            if (idx > -1) {
                consumers.splice(idx, 1);
                return true;
            }
            return false;
        }
    }
}

function checkPropMatch(e: StreamEvent, targetData?: string | number | boolean | Record<string, string | number | boolean | RegExp>): boolean {
    if (targetData === undefined || e.data === undefined) return true;
    const data = JSON.parse(e.data);
    if (typeof targetData !== "object" && targetData !== null) {
        return data === targetData;
    } else if (targetData !== null && data !== null && typeof data === "object") {
        for (const k of Object.keys(targetData)) {
            const value = (data as any)[k];
            const target = targetData[k];
            if (target instanceof RegExp) {
                if (typeof value === "string") {
                    if (value.match(target) === null) return false;
                } else {
                    return false;
                }
            } else if (value !== targetData[k]) {
                return false;
            }
        }
        return true;
    }
    return false;
}

function mergeMessageData(data: LogData[]): LogData | undefined {
    let curMessage = "";
    const output: LogData[] = [];
    for (let d of data) {
        const tp = typeof d;
        if (tp === "string" || tp === "number" || tp === "boolean" || d === null) {
            if (curMessage) {
                curMessage += " " + d;
            } else {
                curMessage = "" + d;
            }
        } else {
            if (curMessage) {
                output.push(curMessage);
                curMessage = "";
            }
            output.push(d);
        }
    }
    if (curMessage) {
        output.push(curMessage);
    }
    if (output.length === 0) return undefined;
    if (output.length === 1) {
        return output[0];
    }
    return output;
}

function format(internalSrcKey: any, entry: StreamListEvent, type: string, dataStringifier?: (data: any) => string, data?: LogData, src?: any) {
    let hasError = false;
    let errMsg = "";
    if (type === "") {
        hasError = true;
        errMsg = "Event type cannot be empty";
    } else {
        if (type.charAt(0) === "!"
            && src !== internalSrcKey
            && type !== traxEvents.Error
            && type !== traxEvents.Warning
            && type !== traxEvents.Info) {
            // reserved 
            hasError = true;
            errMsg = "Event type cannot start with reserved prefix: " + type;
        } else {
            entry.type = type;
            if (data !== undefined) {
                try {
                    if (dataStringifier) {
                        entry.data = dataStringifier(data);
                    } else {
                        entry.data = JSON.stringify(data);
                    }
                } catch (ex) {
                    hasError = true;
                    errMsg = "Event strinfication error: " + ex;
                }
            } else {
                data = undefined;
            }
        }
    }
    if (hasError) {
        // transform event into an error event
        entry.type = traxEvents.Error;
        entry.data = errMsg;
    }
}

export function formatEventData(eventType: string, data?: any) {
    if (!data || !eventType || eventType.charAt(0) !== "!") return data;
    try {
        const sd = JSON.parse("" + data);

        if (eventType === traxEvents.CycleStart || eventType === traxEvents.CycleComplete) {
            return `0`; // 0 = elapsedTime
        } else if (eventType === traxEvents.Info
            || eventType === traxEvents.Warning
            || eventType === traxEvents.Error) {
            return `${data.replace(/"/g, "")}`;
        } else if (eventType === traxEvents.ProcessingPause
            || eventType === traxEvents.ProcessingResume
            || eventType === traxEvents.ProcessingEnd) {
            const d = JSON.parse(data);
            return `${(d as any).processId}`;
        } else if (eventType === traxEvents.ProcessingStart) {
            const d = sd as TraxLogTraxProcessingCtxt;
            if (d.name === "!StoreInit") {
                return `${d.name} (${d.storeId})`;
            } else if (d.name === "!Compute") {
                const R = d.isRenderer ? " R" : "";
                return `${d.name} #${d.computeCount} (${d.processorId}) P${d.processorPriority} ${d.trigger}${R}`;
            } else if (d.name === "!Reconciliation") {
                return `${d.name} #${d.index} - ${d.processorCount} processor${d.processorCount !== 1 ? "s" : ""}`;
            } else if (d.name === "!ArrayUpdate") {
                return `${d.name} (${d.objectId})`;
            } else {
                return `${(d as any).name}`;
            }
        } else if (eventType === traxEvents.New) {
            const d = sd as TraxLogObjectLifeCycle;
            if (d.objectId === undefined) return data;
            return `${d.objectType}: ${d.objectId}`;
        } else if (eventType === traxEvents.Dispose) {
            const d = sd as TraxLogObjectLifeCycle;
            if (d.objectId === undefined) return data;
            return `${d.objectType ? d.objectType + ": " : ""}${d.objectId}`;
        } else if (eventType === traxEvents.Get) {
            const d = sd as TraxLogPropGet;
            return `${d.objectId}.${d.propName} -> ${stringify(d.propValue)}`;
        } else if (eventType === traxEvents.Set) {
            const d = sd as TraxLogPropSet;
            return `${d.objectId}.${d.propName} = ${stringify(d.toValue)} (prev: ${stringify(d.fromValue)})`;
        } else if (eventType === traxEvents.ProcessorDirty) {
            const d = sd as TraxLogProcDirty;
            return `${d.processorId} <- ${d.objectId}.${d.propName}`;
        }
    } catch (ex) { }
    return data;
}

function stringify(v: any) {
    if (v === undefined) {
        return "undefined";
    } else if (v === null) {
        return "null";
    } else if (typeof v === "object") {
        if (v[traxMD]) return v[traxMD].id;
        return JSON.stringify(v);
    } else if (typeof v === "string") {
        return "'" + v.replace(/\'/g, "\\'") + "'"
    } else {
        return "" + v;
    }
}