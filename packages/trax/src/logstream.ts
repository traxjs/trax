import { $LogData, $LogEntry, $LogStream } from "./types";

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
    /** When a task is created */
    "TaskStart": "!TS",
    /** When a task ends */
    "TaskComplete": "!TC",

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
 * Create a log stream
 * The key passed as argument will be used to authorize logs with reserved types
 * @param internalSrcKey 
 * @returns 
 */
export function createLogStream(internalSrcKey: any): $LogStream {
    let size = 0;
    let maxSize = 500;
    let head: $LogEntry | undefined;
    let tail: $LogEntry | undefined;

    // ----------------------------------------------
    // task id managment
    let taskCount = -1; // task counter, incremented for each new task
    let logCount = -1; // log counter, incremented for each new log, reset for each new task
    let taskCompletePromise: null | Promise<void> = null;
    let taskTimeMs = 0; // Time stamp used to process elapsed time values

    function generateId() {
        if (taskCompletePromise === null) {
            // no current task defined
            logCount = -1;
            taskCount++;
            taskCompletePromise = Promise.resolve().then(processTaskEnd);
            logTaskEvent(traxEvents.TaskStart);
        }
        logCount++;
        return taskCount + ":" + logCount;
    }

    function processTaskEnd() {
        logTaskEvent(traxEvents.TaskComplete);
        taskCompletePromise = null;
    }

    function logTaskEvent(type: string) {
        const ts = Date.now();
        const elapsedTime = taskTimeMs !== 0 ? ts - taskTimeMs : 0;
        taskTimeMs = ts;
        logEvent(type, { elapsedTime }, internalSrcKey);
    }
    // ----------------------------------------------

    function logEvent(type: string, data?: $LogData, src?: any) {
        let itm: $LogEntry;
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
            console.error("[trax/createLogStream] Invalid Event Formatter");
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
        }
    }

    return {
        event: logEvent,
        info(...data: $LogData[]) {
            this.event(traxEvents.Info, mergeMessageData(data));
        },
        warning(...data: $LogData[]) {
            this.event(traxEvents.Warning, mergeMessageData(data));
        },
        error(...data: $LogData[]) {
            this.event(traxEvents.Error, mergeMessageData(data));
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
        scan(entryProcessor: (itm: $LogEntry) => void | boolean) {
            let itm = head, process = true;
            while (process && itm) {
                try {
                    if (entryProcessor(itm) === false) {
                        process = false;
                    };
                    itm = itm.next;
                } catch (ex) { }
            }
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

function format(internalSrcKey: any, entry: $LogEntry, type: string, data?: $LogData, src?: any) {
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
