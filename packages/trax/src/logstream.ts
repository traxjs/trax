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

type $LogFormatter = (entry: $LogEntry, type: string, data?: $LogData, src?: any) => void;
type $IdGenerator = () => string;

/**
 * Create a log formatter that will only authorize reserved events if an internal key
 * is passed as event source
 * @param idGenerator 
 * @param internalSrcKey 
 * @returns 
 */
export function createLogFormatter(idGenerator: $IdGenerator, internalSrcKey: any): $LogFormatter {
    return function (entry: $LogEntry, type: string, data?: $LogData, src?: any) {
        entry.id = idGenerator();
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
}

export function createLogStream(format: $LogFormatter): $LogStream {
    let size = 0;
    let maxSize = 500;
    let head: $LogEntry | undefined;
    let tail: $LogEntry | undefined;

    return {
        event(type: string, data?: $LogData, src?: any) {
            // TODO maxSize and object reuse
            const itm: $LogEntry = { id: "", type: "", data: null };
            format(itm, type, data, src);
            if (itm.id === "" || itm.type === "") {
                // invalid formatter, there is nothing we can do here
                // as the formatter will also be called for errors
                console.error("[trax/createLogStream] Invalid Event Formatter");
            } else {
                if (head === undefined) {
                    head = tail = itm;
                } else {
                    // append to tail
                    tail!.next = itm;
                    tail = itm;
                }
                size++;
            }
        },
        info(...data: $LogData[]) {

        },
        warning(...data: $LogData[]) {

        },
        error(...data: $LogData[]) {

        },
        set maxSize(size: number) {

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

