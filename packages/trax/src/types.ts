
/**
 * Data type that can be used in logs
 * Must be a valid parameter for JSON.stringify()
 */
export type $LogData = string | number | boolean | null | Object | $LogData[];


/**
 * Log Evvent
 */
export interface $Event {
    /** 
     * Unique id composed of 2 numbers: cycle id and event count
     * e.g. 42:12 where 42 is the cycle index and 12 the event count within cycle #42
     */
    id: string;
    /** Event type - allows to determine how to interprete data */
    type: string;
    /** Event data */
    data?: $LogData;
}

/**
 * Log entry in the log stream
 */
export interface $StreamEntry extends $Event {
    next?: $StreamEntry;
};

export interface $EventStream {
    /**
     * Log an event
     * @param type unique event type - e.g. "namespace.name", cannot start with "!" (reserved for trax events)
     * @param data event data - must support JSON.stringify
     * @param src optional event source - used for internal events only
     */
    event(type: string, data?: $LogData, src?: any): void;
    /**
     * Log info data in the trax logs
     * @param data 
     */
    info(...data: $LogData[]): void;
    /**
     * Log warning data in the trax logs
     * @param data 
     */
    warn(...data: $LogData[]): void;
    /**
     * Log error data in the trax logs
     * @param data 
     */
    error(...data: $LogData[]): void;
    /**
     * Number of items in the stream
     */
    size: number;
    /**
     * Stream max size
     * Use -1 to specify no limits
     * Otherwise minimum size will be 2
     * (Default: 500)
     */
    maxSize: number;
    /**
     * Scan all current entries in the log stream
     * (oldest to newest)
     * @param entryProcessor the function called for each entry - can return false to stop the scan
     */
    scan(entryProcessor: (itm: $StreamEntry) => void | boolean): void;
    /**
     * Await a certain event. Typical usage:
     * await log.await(trxEvents.CycleComplete);
     * @param evenType 
     */
    await(evenType: string | "*"): Promise<$Event>;
}