
/**
 * Data type that can be used in logs
 * Must be a valid parameter for JSON.stringify()
 */
export type $LogData = string | number | boolean | null | Object;

/**
 * Log entry in the log stream
 */
export interface $LogEntry {
    /** Unique id e.g. 42:12 where 42 is the cycle index and 12 the position within the cycle  */
    id: string;
    type: string;
    data?: $LogData;
    next?: $LogEntry;
};

export interface $LogStream {
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
    warning(...data: $LogData[]): void;
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
     * Use 0 to specify no limits
     * Otherwise minimum size will be 2
     * (Default: 500)
     */
    maxSize: number;
    /**
     * Scan all current entries in the log stream
     * (oldest to newest)
     * @param entryProcessor the function called for each item - can return false to stop the scan
     */
    scan(entryProcessor: (itm: $LogEntry) => void | boolean): void;
}