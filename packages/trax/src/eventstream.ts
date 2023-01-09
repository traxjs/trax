import { LinkedList } from "./linkedlist";
import { $LogData, $StreamEvent, $Event, $EventStream, $SubscriptionId, $ProcessingContext } from "./types";

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

    /** When a processing context starts */
    "ProcessingStart": "!PCS",
    /** When an async  processing context pauses */
    "ProcessingPause": "!PCP",
    /** When an async  processing context resumes */
    "ProcessingResume": "!PCR",
    /** When a processing context ends */
    "ProcessingeEnd": "!PCE"
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
    let head: $StreamEvent | undefined;
    let tail: $StreamEvent | undefined;
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
        emptyPcStack();
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
    // Processing context

    const START = 1, PAUSE = 2, END = 3;
    // Processing context stack
    const pcStack = new LinkedList<$ProcessingContext>();

    function stackPc(pc: $ProcessingContext) {
        pcStack.insert(pc);
    }

    function unstackPc(pc: $ProcessingContext) {
        let last = pcStack.shift();
        while (last && last!==pc) {
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

    function createProcessingContext(id: string, parentId?: string): $ProcessingContext {
        let state = START;
        const pc = {
            get id() {
                return id;
            },
            get parentId() {
                return parentId;
            },
            pause() {
                if (state !== START) {
                    error("[trax/processing context] Only started or resumed contexts can be paused:", id);
                } else {
                    unstackPc(pc);
                    logEvent(traxEvents.ProcessingPause, id, internalSrcKey);
                    state = PAUSE;
                }
            },
            resume() {
                if (state !== PAUSE) {
                    error("[trax/processing context] Only paused contexts can be resumed:", id);
                } else {
                    stackPc(pc);
                    logEvent(traxEvents.ProcessingResume, id, internalSrcKey);
                    state = START;
                }
            },
            end() {
                if (state === END) {
                    error("[trax/processing context] Contexts cannot be ended twice:", id);
                } else {
                    unstackPc(pc);
                    logEvent(traxEvents.ProcessingeEnd, id, internalSrcKey);
                    state = END;
                }
            }
        }
        stackPc(pc);
        return pc;
    }

    function error(...data: $LogData[]) {
        logEvent(traxEvents.Error, mergeMessageData(data));
    }

    function logEvent(type: string, data?: $LogData, src?: any, parentId?: string) {
        let evt: $StreamEvent;
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

        format(internalSrcKey, evt, type, data, src);
        evt.id = generateId();
        evt.parentId = parentId;
        if (evt.type === "") {
            // invalid formatter, there is nothing we can do here
            // as the formatter will also be called for errors
            console.error("[trax/createEventStream] Invalid Event Formatter");
        } else {
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
        return evt;
    }

    function resolveAwaitPromises(eventType: string, e: $Event) {
        const promiseData = awaitMap.get(eventType);
        if (promiseData) {
            awaitMap.delete(eventType);
            promiseData.resolve({ id: e.id, type: e.type, data: e.data, parentId: e.parentId });
        }
    }

    return {
        event(type: string, data?: $LogData, src?: any) {
            logEvent(type, data, src);
        },
        info(...data: $LogData[]) {
            logEvent(traxEvents.Info, mergeMessageData(data));
        },
        warn(...data: $LogData[]) {
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
        startProcessingContext(data?: $LogData): $ProcessingContext {
            const last = pcStack.peek();
            const parentId = last ? last.id : undefined;
            const evt = logEvent(traxEvents.ProcessingStart, data, internalSrcKey, parentId);
            return createProcessingContext(evt.id, parentId);
        },
        get maxSize(): number {
            return maxSize;
        },
        get size() {
            return size;
        },
        scan(eventProcessor: (itm: $Event) => void | boolean) {
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

function format(internalSrcKey: any, entry: $StreamEvent, type: string, data?: $LogData, src?: any) {
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
