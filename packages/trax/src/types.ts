
/**
 * Object Id - can be either a string or an array that will be joined to produce a unique id
 * e.g. ["foo",42] -> will generate id "foo:42" if used on the root store or "contextid/foo:42"
 * if used on a sub-store
 */
export type $TraxIdDef = string | (string | number | boolean)[];

export type $StoreWrapper = {
    readonly id: string;
    dispose: () => void;
}

/**
 * Trax object types
 */
export enum $TrxObjectType {
    NotATraxObject = "",
    Object = "O",
    Array = "A",
    Dictionary = "D",
    Store = "S",
    Processor = "P"
}

export interface $Trax {
    /**
     * Create a root store
     * @param idPrefix the store id - if this id is already in use, a suffix will be automatically added
     * @param initFunction the function that will be called to initialize the store. This function must 
     * define the store "root" object otherwise an error will be generated
     */
    createStore<R, T extends Object>(
        idPrefix: $TraxIdDef,
        initFunction: (store: $Store<T>) => R
    ): R extends void ? $Store<T> : R & $StoreWrapper;
    /**
     * The trax event logs
     */
    log: $EventStream;
    /**
     * Tell if an object is a trax object
     */
    isTraxObject(obj: any): boolean;
    /**
     * Get the unique id associated to a trax object
     * Return an empty string if the object is not a trax object
     * @param obj 
     */
    getTraxId(obj: any): string;
    /**
     * Get the trax type associated to an object
     * @param obj 
     */
    getTraxObjectType(obj: any): $TrxObjectType;
    /**
     * Tell is some changes are pending (i.e. dirty processors)
     * Return true if there are some dirty processors - which means that all computed values
     * can be safely read with no risks of invalid value
     */
    readonly pendingChanges: boolean;
    /**
     * Process the pending changes - i.e. run the dirty processors dependency chain
     * This function will be automatically asynchronously called at the end of each trax cycle
     * but it can be also explictly called if a synchronous behaviour is required
     */
    processChanges(): void;
    /**
     * Get a promise that will be fulfilled when the current trax cycle completes
     * If no cycle is on-going, the promise will be immediately fulfilled
     */
    cycleComplete(): Promise<void>;
    /**
     * Helper function to pdate the content of an array without changing its reference
     * Must be used in processors generating computed array collections
     * @param array 
     * @param newContent 
     */
    // updateArray(array: any[], newContent: any[]): void;
}


/**
 * Trax Store
 * Gather trax objects in a same namespace (i.e. objects, arrays, dictionaries, processors and stores).
 * Allow to :
 * - create multiple instances of the same store type with no risks of id collisions
 * - manage local ids instead of global ids
 * - simplify troubleshooting
 * - easily dispose group of objects to make them ready for garbage collection
 */
export interface $Store<T> {
    /**
     * The store id
     */
    readonly id: string;
    /**
     * Store root data object
     * All objects, arrays and dictionaries that are not reachable through this object will be
     * automatically garbage-collected
     */
    readonly root: T,
    /**
     * Initialize the root object - must be only called in the store init function
     * @param root 
     */
    initRoot(root: T): void;
    /**
     * Create a sub-store
     * @param id the store id - must be unique with the parent store scope
     * @param initFunction the function that will be called to initialize the store. This function must 
     * define the store "root" object otherwise an error will be generated
     */
    // createStore<R extends Object>(
    //     id: $TraxIdDef,
    //     initFunction: (store: $Store<any>) => R
    // ): R & { dispose: () => void };
    /**
     * Retrieve a data object/array/dictionary that has been previously created
     * (Doesn't work for processors or stores)
     * Note: if this object is not indirectly referenced by the root object, it may habe been garbage collected
     * @returns the tracked object or undefined if not found
     */
    get<T extends Object>(id: $TraxIdDef): T | void;
    /**
     * Get or create a data object associated to the given id
     * @param id the object id - must be unique with the store scope
     * @param initValue the object init value (empty object if nothing is provided)
     */
    add<T extends Object>(id: $TraxIdDef, initValue: T): T;
    /**
     * Delete a data object from the store
     * @param idOrObject 
     * @returns true if an object was successfully deleted
     */
    delete<T extends Object>(idOrObject: $TraxIdDef | T): boolean;
    /**
     * Get or create a data array associated to the given id
     * @param id the array id - must be unique with the store scope
     * @param initValue the array init value (empty array if nothing is provided)
     */
    // addArray<T extends Array<any>>(id: $TraxIdDef, initValue?: T): T;
    /**
     * Get or create a data dictionary associated to the given id
     * (Dictionaries are JS objects used as Map<string,any>)
     * @param id the dictionary id - must be unique with the store scope
     * @param initValue the dictionary init value (empty object if nothing is provided)
     */
    // addDictionary<T extends Record<string, any>>(id: $TraxIdDef, initValue?: T): T;
    /**
     * Create a compute processor
     * Processor may be synchronous or asynchronous (cf. $TraxComputeFn)
     * @param id the processor id - must be unique with the store scope
     * @param compute the compute function
     * @param autoUpdate if true (default) the processor will be automatically called after getting dirty. 
     *                   (i.e. at the end of a cycle when trax.processChanges() is called)
     *                   If false, the process function will need to be explicitely called (useful for React renderers for instance)
     */
    // compute(id: $TraxIdDef, compute: $TraxComputeFn, autoUpdate?: boolean): $TraxProcessor;
    /**
     * Dispose the current store
     * Main actions: de-reference the root object and allow for transparent garbage collection,
     * de-reference the store in its parent collection
     */
    // dispose(): void;
}

/**
 * Trax compute function
 * Define the processing instructions associated to a processor
 * Asynchronous compute functions must return a Generator, whereas synchronous
 * compute functions shall not return anything
 */
export type $TraxComputeFn = () => (void | Generator<Promise<any>, void, any>);

/**
 * Trax processor
 * This object track the dependencies of its compute function and will automatically
 * re-call the compute function in case of dependency changes
 */
export interface $TraxProcessor {
    /**
     * Processor priority - tell how/when this processor should be called
     * compared to other processors (in practice priority = creation order)
     */
    readonly priority: number;
    /**
     * Compute count - tell how many times the processor compute function was called
     */
    readonly computeCount: number;
    /**
     * Tell if the processor internal value is dirty and if it must be reprocessed
     */
    readonly isDirty: boolean;
    /**
    * Tell if the processor was labeled as a renderer (debug info)
    */
    readonly isRenderer: boolean;
    /**
     * Tell if the processor is disposed and should be ignored
     */
    readonly isDisposed: boolean;
    /**
     * Callback to call when the processor value gets dirty
     * This callback is called synchronously, right after the processor gets dirty
     * Only one callback can be defined
     */
    onDirty: (() => void) | null;
    /**
     * Execute the compute function if the processor is dirty
     */
    process(): void;
    /**
     * Dispose the processor so that it can't be executed anymore
     */
    dispose(): void;
}

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

export interface $TrxLogObjectLifeCycle {
    type: "!NEW" | "!DEL",
    objectId: string;
    objectType: $TrxObjectType
}

export interface $TrxLogPropGet {
    type: "!GET",
    objectId: string;
    propName: string;
    propValue: any;
}

export interface $TrxLogPropSet {
    type: "!SET",
    objectId: string;
    propName: string;
    fromValue: any;
    toValue: any;
}

export interface $TrxLogProcessStart {
    type: "!PCS";
    name: "StoreInit";
    id: string;
}

/** JSON type */
type $JSONValue = string | number | boolean | null | { [key: string]: $JSONValue } | Array<$JSONValue>;

/**
 * Data type that can be used in logs
 * Must be a valid parameter for JSON.stringify()
 */
export type $LogData = $JSONValue;

/**
 * Log Event
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