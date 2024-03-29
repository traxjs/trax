
/**
 * Object Id - can be either a string or an array that will be joined to produce a unique id
 * e.g. ["foo",42] -> will generate id "foo:42" if used on the root store or "contextid/foo:42"
 * if used on a sub-store
 * Note: the array can also contain another trax object in the first position - in this case the object id will be used as prefix
 */
export type TraxIdDef = string | (string | number | boolean | TraxObject)[];

export type TraxObject = Object;

export type StoreWrapper = {
    readonly id: string;
    dispose: () => void;
}

/**
 * Trax object types
 */
export enum TraxObjectType {
    NotATraxObject = "",
    Object = "O",
    Array = "A",
    Store = "S",
    Processor = "P"
}

export interface Trax {
    /**
     * Create a root store
     * @param id the store id
     * @param initFunction the function that will be called to initialize the store. This function must
     * define the store "root" object otherwise an error will be generated
     */
    createStore<T extends Object, R>(
        id: TraxIdDef,
        initFunction: (store: Store<T>) => R
    ): R extends void ? Store<T> : R & StoreWrapper;
    /**
     * Create a root store
     * @param id the store id
     * @param data the root object to initialize the store
     */
    createStore<T extends Object>(id: TraxIdDef, data: T): Store<T>;
    /**
     * The trax event logs
     */
    log: EventStream;
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
    getTraxObjectType(obj: any): TraxObjectType;
    /**
     * Get a processor from its id
     * @param id
     */
    getProcessor(id: string): TraxProcessor | void;
    /**
     * Retrieve a store from its id. Note: this method returns the internal trax store object,
     * not the store API that may be returned by createStore
     * @param id
     */
    getStore<T>(id: string): Store<T> | void;
    /**
     * Get a trax data object (object / array or dictionary). Note: only objects that have already been
     * accessed can be returned (otherwise their id is not yet defined)
     * @param id
     */
    getData<T>(id: string): T | void;
    /**
     * Return the processor that is being computing (if getActiveProcessor() is called in a compute call stack).
     * Return undefined otherwise.
     * @seealso componentId in trax-react
     */
    getActiveProcessor(): TraxProcessor | void;
    /**
     * Tell if some changes are pending (i.e. dirty processors)
     * Return false if there are no dirty processors - which means that all computed values
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
     * Get a promise that will be fulfilled when trax reconciliation is complete
     * (i.e. at the end of the current cycle)
     * If there is no cycle on-going, the promise will be immediately fulfilled
     */
    reconciliation(): Promise<void>;
    /**
     * Helper function to update the content of an array without changing its reference
     * Must be used in processors generating computed array collections
     * Note: this method will also flag the array as computed and will ensure errors are raised
     * if changes are made outside this processor
     * @param array the array to update
     * @param newContent the new array content
     */
    updateArray(array: any[], newContent: any[]): void;
    /**
     * Helper function to update the content of a dictionary without changing its reference
     * Must be used in processors generating computed dictionary collections
     * Note: this method will also flag the dictionary as computed and will ensure errors are raised
     * if changes are made outside this processor
     * @param dict the dictionary to update
     * @param newContent the new dictionary content
     */
    updateDictionary<T>(dict: { [k: string]: T }, newContent: { [k: string]: T }): void;
    /**
     * Wrapper around Object.keys() that should be used in processors
     * that read objects as dictionaries. This will allow processors to get dirty when
     * properties are added or removed
     * @param o
     */
    getObjectKeys(o: TraxObject): string[];
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
export interface Store<T> {
    /**
     * The store id
     */
    readonly id: string;
    /**
     * Store root data object
     * All objects, arrays and dictionaries that are not reachable through this object will be
     * automatically garbage-collected
     */
    readonly data: T,
    /**
     * Initialize the root data object - must be only called in the store init function
     * @param contentProcessors optional compute functions associated to the root object. The processor associated to these functions will follow the object life cycle.
     * @param data
     */
    init(data: T, contentProcessors?: TraxLazyComputeDescriptor<T>): T;
    /**
     * Tell if the store is disposed and should be ignored
     */
    readonly disposed: boolean;
    /**
     * Create a sub-store
     * @param id the store id
     * @param initFunction the function that will be called to initialize the store. This function must
     * define the store "root" data object otherwise an error will be generated
     */
    createStore<T extends Object, R>(
        id: TraxIdDef,
        initFunction: (store: Store<T>) => R
    ): R extends void ? Store<T> : R & StoreWrapper;
    /**
     * Create a sub-store
     * @param id the store id
     * @param data the root data object to initialize the store
     */
    createStore<T extends Object>(id: TraxIdDef, data: T): Store<T>;
    /**
     * Retrieve a sub-store
     * @param id
     */
    getStore<T>(id: TraxIdDef): Store<T> | void;
    /**
    * Get or create a data object associated to the given id
    * @param id the object id - must be unique with the store scope
    * @param initValue the object init value (empty object if nothing is provided)
    * @param contentProcessors optional compute functions associated to this object. The processor associated to these functions will follow the object life cycle.
    */
    add<T extends Object | Object[]>(id: TraxIdDef, initValue: T, contentProcessors?: TraxLazyComputeDescriptor<T>): T;
    /**
     * Retrieve a data object/array/dictionary that has been previously created
     * (Doesn't work for processors or stores)
     * Note: if this object is not indirectly referenced by the root data object, it may habe been garbage collected
     * @returns the tracked object or undefined if not found
     */
    get<T extends Object>(id: TraxIdDef): T | void;
    /**
     * Delete a data object from the store
     * @param idOrObject
     * @returns true if an object was successfully deleted
     */
    remove<T extends Object>(dataObject: T): boolean;
    /**
     * Create or retrieve an **eager** compute processor (eager processors are always called even if the data they compute are not read). These processors may be **synchronous** or **asynchronous** (cf. $TraxComputeFn)
     * If a processor with the same id is found, it will be returned instead of creating a new one
     * but its compute function will be updated in order to benefit from new closure values that may not exist
     * in the previous function.
     * @param id the processor id - must be unique with the store scope
     * @param compute the compute function
     * @param autoCompute if true (default) the processor will be automatically called after getting dirty.
     *                   (i.e. at the end of a cycle when trax.processChanges() is called)
     *                   If false, the process function will need to be explicitely called (useful for React renderers for instance)
     */
    compute(id: TraxIdDef, compute: TraxComputeFn, autoCompute?: boolean, isRenderer?: boolean): TraxProcessor;
    /**
     * Retrieve a processor created on this store
     * @param id
     */
    getProcessor(id: TraxIdDef): TraxProcessor | void;
    /**
     * Dispose the current store and all its sub-stores and processor
     * so that they can be garbage collected
     */
    dispose(): boolean;
    /**
     * Create an async function from a generator function
     * in order to have its logs properly tracked in the trax logger
     * This is meant to be used in store wrapper objects to expose action functions
     * @param fn
     */
    async<F extends (...args: any[]) => Generator<Promise<any>, any, any>>(fn: F): (...args: Parameters<F>) => Promise<any>;
    /**
     * Create an async function from a generator function
     * in order to have its logs properly tracked in the trax logger
     * This can be used to define an async block that will be called asychronously (e.g. store async initialization)
     * @param name the name of the function as it should appear in the logs
     * @param fn
     */
    async<F extends (...args: any[]) => Generator<Promise<any>, any, any>>(name: string, fn: F): (...args: Parameters<F>) => Promise<any>;
}

/**
 * Context passed to compute functions.
 * Allows to stop a processor after a certain amount of counts
 */
export interface TraxComputeContext {
    readonly processorId: string;
    readonly processorName: string;
    readonly computeCount: number;
    maxComputeCount: number;
}

/**
 * Trax compute function
 * Define the processing instructions associated to a processor
 * Asynchronous compute functions must return a Generator, whereas synchronous
 * compute functions shall not return anything
 */
export type TraxComputeFn = (cc: TraxComputeContext) => (void | Generator<Promise<any>, void, any>);

/**
 * Trax object compute function
 * Create a processor associated to an object. The processor will be automatically disposed when the object is disposed.
 * Asynchronous compute functions must return a Generator, whereas synchronous
 * compute functions shall not return anything
 */
export type TraxObjectComputeFn<T> = (o: T, cc: TraxComputeContext) => (void | Generator<Promise<any>, void, any>);

/**
 * Trax object compute descriptor
 * Allows to add extra arguments to a compute function
 */
export interface TraxObjectComputeDescriptor<T> {
    /** Processor name (default = argument index in the store.add() call */
    processorName?: string;
    /** Compute function */
    compute: TraxObjectComputeFn<T>;
}

/**
 * Ordered map of lazy compute processors associated to a trax object
 */
export interface TraxLazyComputeDescriptor<T> {
    [computeName: string]: TraxObjectComputeFn<T>;
}

/**
 * Processor id
 */
export type TraxProcessorId = string;

/**
 * Trax processor
 * This object track the dependencies of its compute function and will automatically
 * re-call the compute function in case of dependency changes
 */
export interface TraxProcessor {
    readonly id: TraxProcessorId;
    /**
     * Tell if the processor should automatically re-run the compute function
     * when it gets dirty or not (in which case the processor creator should use
     * the onDirty callback and eventually call compute() explicitely)
     */
    readonly autoCompute: boolean;
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
     * Tell if the processor is dirty (following a dependency update) and must be reprocessed.
     */
    readonly dirty: boolean;
    /**
    * Tell if the processor was labeled as a renderer (debug info)
    */
    readonly isRenderer: boolean;
    /**
     * Tell if the processor is lazy (name must start with "~" and must be associated to a target object)
     */
    readonly isLazy: boolean;
    /**
     * Tell if the processor is disposed and should be ignored
     */
    readonly disposed: boolean;
    /** Get the processor current dependencies */
    readonly dependencies: string[];
    /**
     * Callback to call when the processor value gets dirty
     * This callback is called synchronously, right after the processor gets dirty
     * Only one callback can be defined
     */
    onDirty: (() => void) | null;
    /**
     * Execute the compute function if the processor is dirty
     * @param forceExecution if true compute will be exececuted event if processor is not dirty
     */
    compute(forceExecution?: boolean): void;
    /**
     * Dispose the current processor to stop further compute and
     * have it garbage collected
     */
    dispose(): boolean;
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
    /** When a lazy processor is skipped */
    "ProcessorSkipped": "!SKP",

    /** When a processing context starts */
    "ProcessingStart": "!PCS",
    /** When an async  processing context pauses */
    "ProcessingPause": "!PCP",
    /** When an async  processing context resumes */
    "ProcessingResume": "!PCR",
    /** When a processing context ends */
    "ProcessingEnd": "!PCE"
});

export const traxEventTypes = new Set<string>();
Object.getOwnPropertyNames(traxEvents).forEach((name) => {
    traxEventTypes.add((traxEvents as any)[name]);
});

export type TraxEvent = TraxLogMsg | TraxLogObjectLifeCycle | TraxLogPropGet | TraxLogPropSet | TraxLogProcDirty | TraxLogProcSkipped;

/** Reason that triggered a call to a processor's compute function */
export type TraxComputeTrigger = "Init" | "Reconciliation" | "DirectCall" | "TargetRead";

export type TraxLogEvent =
    TraxLogMsg
    | TraxLogCycle
    | TraxLogObjectLifeCycle
    | TraxLogPropSet
    | TraxLogPropGet
    | TraxLogProcDirty
    | TraxLogTraxProcessingCtxt
    | TraxLogProcessingCtxtEvent;

export type TraxLogObjectLifeCycle = TraxLogObjectCreate | TraxLogObjectDispose;
export interface TraxLogObjectCreate {
    type: "!NEW";
    objectId: string;
    objectType?: TraxObjectType
}

export interface TraxLogObjectDispose {
    type: "!DEL";
    objectId: string;
}

export interface TraxLogPropGet {
    type: "!GET";
    objectId: string;
    propName: string;
    propValue: any;
}

export interface TraxLogPropSet {
    type: "!SET";
    objectId: string;
    propName: string;
    fromValue: any;
    toValue: any;
}

export interface TraxLogProcDirty {
    type: "!DRT";
    processorId: string;
    /** Object holding the value that triggered the dirty event */
    objectId: string;
    propName: string;
}

export interface TraxLogProcSkipped {
    type: "!SKP";
    processorId: string;
}

export interface TraxLogMsg {
    type: "!LOG" | "!WRN" | "!ERR";
    data?: JSONValue;
}

export interface TraxLogCycle {
    type: "!CS" | "!CC";
    elapsedTime: number;
}

export interface TraxLogProcessingCtxtEvent {
    type: "!PCS" | "!PCP" | "!PCR" | "!PCE";
    data?: JSONValue;
}

export type TraxLogTraxProcessingCtxt = TraxLogProcessStoreInit | TraxLogProcessCompute | TraxLogReconciliation | TraxLogCollectionUpdate;

export interface TraxLogProcessStoreInit {
    type: "!PCS" | "!PCE";
    name: "!StoreInit";
    storeId: string;
}
export interface TraxLogProcessCompute {
    type: "!PCS" | "!PCP" | "!PCR" | "!PCE";
    name: "!Compute";
    processorId: string;
    processorPriority: number;
    trigger: TraxComputeTrigger;
    isRenderer: boolean;
    computeCount: number;
}

export interface TraxLogCollectionUpdate {
    type: "!PCS" | "!PCE";
    name: "!ArrayUpdate" | "!DictionaryUpdate";
    objectId: string;
}

export interface TraxLogReconciliation {
    type: "!PCS" | "!PCE";
    name: "!Reconciliation";
    /** Counter incremented everytime a reconciliation runs */
    index: number;
    /** Number of active processors when a reconciliation starts (allows to track memory leaks) */
    processorCount: number;
}

/** JSON type */
export type JSONValue = string | number | boolean | null | { [key: string]: JSONValue } | Array<JSONValue>;

/**
 * Data type that can be used in logs
 * Must be a valid parameter for JSON.stringify()
 */
export type LogData = JSONValue;

/**
 * Log Event
 */
export interface StreamEvent {
    /**
     * Unique id composed of 2 numbers: cycle id and event count
     * e.g. 42:12 where 42 is the cycle index and 12 the event count within cycle #42
     */
    id: string;
    /** Event type - allows to determine how to interprete data */
    type: string;
    /** Event data - JSON stringified */
    data?: string;
    /** Id of another event that the current event relates to */
    parentId?: string;
}

/**
 * Log entry in the log stream
 */
export interface StreamListEvent extends StreamEvent {
    next?: StreamListEvent;
};

/**
 * Start a processing context that allows to virtually group events together
 * The processing context can be either synchronous or asynchronous
 * If synchronous, the end() method is expected to be called before the end of the current cycle
 * If asynchronous, the pause() or the end() methods are expected to be called before the end of the current cycle
 * If pause() is called, resume() may be called into another cycle (until end() is eventually called - but this
 * is not mandatory as the async processing could be stopped)
 */
export interface ProcessingContext {
    id: string;
    /** Raise a pause event in the event stream */
    pause(): void;
    /** Raise a resume event in the event stream */
    resume(): void;
    /** Raise an end event in the event stream */
    end(): void;
}

export type ProcessingContextData = { name: string, id?: string } & { [key: string]: JSONValue };

export type SubscriptionId = Object;

/**
* Tell how logs should be logged on the console.
* Useful in jest/vitest environments where dev tools are not available
* Possible values:
* - "": no output
* - "Main": most significant events (writes + explicit logs + dirty changes + re-processing)
* - "AllButGet": log all events except Cycle Start/End and Property Getters
* - "All": log all events except Cycle Start/End
*/
export type ConsoleOutput = "" | "Main" | "AllButGet" | "All";

export interface EventStream {
    /**
     * Log an event
     * @param type unique event type - e.g. "namespace.name", cannot start with "!" (reserved for trax events)
     * @param data event data - must support JSON.stringify
     * @param src optional event source - used for internal events only
     */
    event(type: string, data?: LogData, src?: any): void;
    /**
     * Log info data in the trax logs
     * @param data
     */
    info(...data: LogData[]): void;
    /**
     * Log warning data in the trax logs
     * @param data
     */
    warn(...data: LogData[]): void;
    /**
     * Log error data in the trax logs
     * @param data
     */
    error(...data: LogData[]): void;
    /**
     * Create a processing context and raise a start event in the event stream
     * Processing contexts are used to virtually regroup events that occur in a given context
     * Processing contexts can be stacked
     * @param data data associated with the processing context. Must contain a name (e.g. process name)
     * and may contain an id (useful for awaitEvent())
     */
    startProcessingContext(data: ProcessingContextData, src?: any): ProcessingContext;
    /**
     * Number of items in the stream
     */
    size: number;
    /**
     * Stream max size
     * Use -1 to specify no limits
     * Otherwise minimum size will be 2
     * (Default: 1000)
     */
    maxSize: number;
    /**
     * Tell if logs should be logged on the console.
     */
    consoleOutput: ConsoleOutput;
    /**
     * Scan all current entries in the log stream
     * (oldest to newest)
     * @param eventProcessor the function called for each event - can return false to stop the scan
     */
    scan(eventProcessor: (itm: StreamEvent) => void | boolean): void;
    /**
     * Return the last event added to the stream
     */
    lastEvent(): StreamEvent | undefined;
    /**
     * Await a certain event. Typical usage:
     * await log.await(traxEvents.CycleComplete);
     * @param eventType
     * @param targetData [optional] value or fields that should be matched against the event data (depends on the event type)
     */
    awaitEvent(eventType: string | "*", targetData?: string | number | boolean | Record<string, string | number | boolean | RegExp>): Promise<StreamEvent>;
    /**
     * Register an event consumer that will be synchronously called when a given event occurs
     * @param eventType an event type or "*" to listen to all events
     * @param callback
     * @returns a subscribtion id that will be used to unsubscribe
     */
    subscribe(eventType: string | "*", callback: (e: StreamEvent) => void): SubscriptionId;
    /**
     * Unregister an event consumer
     * @param subscriptionId
     * @returns true if the consumer was found and succesfully unregistered
     */
    unsubscribe(subscriptionId: SubscriptionId): boolean;
}
