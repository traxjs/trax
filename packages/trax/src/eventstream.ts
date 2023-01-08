import { $LogData, $StreamEntry, $Event, $EventStream, $SubscriptionId } from "./types";

/**
 * Trax event types
 * Internal code start with "!" to avoid collisions with external events
 * (not an enum to avoid potential minifier issues)
 */
export const traxEvents = Object.freeze({
    /** When info data are logged */
    "Info": "!LOG",
    /** When a warning is logged */
    "Warning": "!WRN",
    /** When an error is logged */
    "Error": "!ERR",
    /** When a cycle is created */
    "CycleStart": "!CS",
    /** When a cycle ends */
    "CycleComplete": "!CC",

    /** When a trax entity is created (e.g. object / processor / store)  */
    "New": "!NEW",
    /** When a trax entity is disposed (e.g. object / processor / store)  */
    "Dispose": "!DEL",
    /** When an object property is set (changed) */
    "Set": "!SET",
    /** When an object property is read */
    "Get": "!GET",
    /** When a processor is set dirty */
    "ProcessorDirty": "!DRT",
    /** When a compute process starts */
    "ComputeStart": "!CMS",
    /** When an async compute process pauses */
    "ComputePause": "!CMP",
    /** When an async compute process resumes */
    "ComputeResume": "!CMR",
    /** When a compute process ends */
    "ComputeEnd": "!CME",
    // TOOD: actions
});



/**
 * Create an event stream
 * The key passed as argument will be used to authorize events with reserved types
 * @param internalSrcKey 
 * @returns 
 */
export function createEventStream(internalSrcKey: any): $EventStream {
    let size = 0;
    let maxSize = 500;
    let head: $StreamEntry | undefined;
    let tail: $StreamEntry | undefined;
    const awaitMap = new Map<string, { p: Promise<$Event>, resolve: (e: $Event) => void }>();
    const consumers: ((e: $Event) => void)[] = [];

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
        logCycleEvent(traxEvents.CycleComplete);
        cycleCompletePromise = null;
    }

    function logCycleEvent(type: string) {
        const ts = Date.now();
        const elapsedTime = cycleTimeMs !== 0 ? ts - cycleTimeMs : 0;
        cycleTimeMs = ts;
        logEvent(type, { elapsedTime }, internalSrcKey);
    }
    // ----------------------------------------------

    function logEvent(type: string, data?: $LogData, src?: any) {
        let itm: $StreamEntry;
        if (size >= maxSize && maxSize > 1) {
            itm = head!;
            head = head!.next;
            size--;
            itm.id = "";
            itm.type = "";
            itm.next = itm.data = undefined;
        } else {
            itm = { id: "", type: "", data: null }
        }

        format(internalSrcKey, itm, type, data, src);
        itm.id = generateId();
        if (itm.type === "") {
            // invalid formatter, there is nothing we can do here
            // as the formatter will also be called for errors
            console.error("[trax/createEventStream] Invalid Event Formatter");
        } else {
            if (head === undefined) {
                head = tail = itm;
                size = 1;
            } else {
                // append to tail
                tail!.next = itm;
                tail = itm;
                size++;
            }
            for (const c of consumers) {
                try {
                    c({ id: itm.id, type: itm.type, data: itm.data });
                } catch (ex) { }
            }
            resolveAwaitPromises(itm.type, itm);
        }
    }

    function resolveAwaitPromises(eventType: string, e: $Event) {
        const pd = awaitMap.get(eventType);
        if (pd) {
            const r = pd.resolve;
            awaitMap.delete(eventType);
            r({ id: e.id, type: e.type, data: e.data });
        }
    }

    return {
        event: logEvent,
        info(...data: $LogData[]) {
            logEvent(traxEvents.Info, mergeMessageData(data));
        },
        warn(...data: $LogData[]) {
            logEvent(traxEvents.Warning, mergeMessageData(data));
        },
        error(...data: $LogData[]) {
            logEvent(traxEvents.Error, mergeMessageData(data));
        },
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
        get maxSize(): number {
            return maxSize;
        },
        get size() {
            return size;
        },
        scan(entryProcessor: (itm: $StreamEntry) => void | boolean) {
            let itm = head, process = true;
            while (process && itm) {
                try {
                    if (entryProcessor(itm) === false) {
                        process = false;
                    };
                    itm = itm.next;
                } catch (ex) { }
            }
        },
        async await(eventType: string): Promise<$Event> {
            if (eventType === "" || eventType === "*") {
                logEvent(traxEvents.Error, `[trax/eventStream.await] Invalid event type: '${eventType}'`);
                return { id: tail!.id, type: tail!.type, data: tail!.data };
            }
            let promiseData = awaitMap.get(eventType);
            if (promiseData === undefined) {
                let r: any, pd: any = {
                    p: new Promise((resolve: (e: $Event) => void) => {
                        r = resolve;
                    })
                }
                pd.resolve = r;
                awaitMap.set(eventType, pd);
                promiseData = pd;
            }
            return promiseData!.p;
        },
        subscribe(eventType: string | "*", callback: (e: $Event) => void): $SubscriptionId {
            let fn: (e: $Event) => void;
            if (eventType === "*") {
                fn = (e: $Event) => callback(e);
            } else {
                fn = (e: $Event) => {
                    if (e.type === eventType) {
                        callback(e);
                    }
                };
            }
            consumers.push(fn);
            return fn;
        },
        unsubscribe(subscriptionId: $SubscriptionId): boolean {
            const idx = consumers.indexOf(subscriptionId as any);
            if (idx > -1) {
                consumers.splice(idx, 1);
                return true;
            }
            return false;
        }
    }

}

function mergeMessageData(data: $LogData[]): $LogData | undefined {
    let curMessage = "";
    const output: $LogData[] = [];
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

function format(internalSrcKey: any, entry: $StreamEntry, type: string, data?: $LogData, src?: any) {
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
                    entry.data = JSON.stringify(data);
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
