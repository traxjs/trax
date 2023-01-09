
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
    /** Id of another event that the current event relates to */
    parentId?: string;
}

/**
 * Log entry in the log stream
 */
export interface $StreamEvent extends $Event {
    next?: $StreamEvent;
};

/**
 * Start a processing context that allows to virtually group events together
 * The processing context can be either synchronous or asynchronous
 * If synchronous, the end() method is expected to be called before the end of the current cycle
 * If asynchronous, the pause() or the end() methods are expected to be called before the end of the current cycle
 * If pause() is called, resume() may be called into another cycle (until end() is eventually called - but this
 * is not mandatory as the async processing could be stopped)
 */
export interface $ProcessingContext {
    id: string;
    /** Raise a pause event in the event stream */
    pause(): void;
    /** Raise a resume event in the event stream */
    resume(): void;
    /** Raise an end event in the event stream */
    end(): void;
}

export type $SubscriptionId = Object;

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
     * Create a processing context and raise a start event in the event stream
     * Processing contexts are used to virtually regroup events that occur in a given context
     * Processing contexts can be stacked
     */
    startProcessingContext(data?: $LogData): $ProcessingContext;
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
     * @param eventProcessor the function called for each event - can return false to stop the scan
     */
    scan(eventProcessor: (itm: $Event) => void | boolean): void;
    /**
     * Await a certain event. Typical usage:
     * await log.await(trxEvents.CycleComplete);
     * @param evenType 
     */
    await(evenType: string | "*"): Promise<$Event>;
    /**
     * Register an event consumer that will be synchronously called when a given event occurs
     * @param eventType an event type or "*" to listen to all events
     * @param callback 
     * @returns a subcribtion id that will be used to unsubscribe
     */
    subscribe(eventType: string | "*", callback: (e: $Event) => void): $SubscriptionId;
    /**
     * Unregister an event consumer
     * @param subscriptionId 
     * @returns true if the consumer was found and succesfully unregistered
     */
    unsubscribe(subscriptionId: $SubscriptionId): boolean;
}