import { StreamEvent, TraxComputeTrigger, TraxLogMsg, TraxLogObjectLifeCycle, TraxLogProcDirty, TraxLogPropGet, TraxLogPropSet, TraxObjectType } from "@traxjs/trax";
import { JSONValue } from "@traxjs/trax/lib/types";

/** Root data structure holding all dev tools data */
export interface DtDevToolsData {
    /** List of stores, sorted */
    rootStores: DtStore[];
    /** List of root stores with direct renderer processors - computed from rootStores */
    rendererStores: DtStore[];
    /** Logs received from the application */
    logs: DtLogCycle[];
    /** Log filters */
    logFilters: {
        /** Key signature to identify a certain filter type and allow result cachine */
        key: string;
        /** Show the property get logs (by far the largets number of log entries)  */
        includePropertyGet: boolean;
        /** Include object creation */
        includeNew: boolean;
        /** Include object disposal */
        includeDispose: boolean;
        /** Include processing groups event if all their events are filtered-out */
        includeEmptyProcessingGroups: boolean;
        // /** Show renderer logs only */
        // renderOnly: boolean;
        // /** Show only logs that set a processor dirty */
        // dirtyOnly: boolean;
        // /** Show logs that match certain object ids (store/data/processor) */
        // objectIds: string[];
        // showLongProcessing?
    },
    // TODO: logSelection to keep the selection cursor on a given log entry
}

/**
 * API used by the DevTools to retrieve data from the trax instance
 * running in the client application
 * Note: this API is composed of 2 types of functions
 * - Actions: sync function with no return values 
 * - Calls: async functions with a return value
 */
export interface DtClientAPI {
    /** Activate client log push */
    startMonitoring(): void;
    /** Deactivate client log push */
    stopMonitoring(): void;
    /** Register a listener to get cycle events (the listener will be called for each cycle with all event cycles) */
    onChange(listener: (events: DtEventGroup) => void): void;
}

/**
 * Group of all events belonging to a given cycle
 */
export interface DtEventGroup {
    cycleId: number;
    events: StreamEvent[];
}

/**
 * View object representing a Trax Store
 */
interface DtStore {
    /** Store id */
    readonly id: string;
    /** Parent store id - emtpty for root stores */
    readonly storeId: string;
    /** Object type */
    readonly type: TraxObjectType.Store;
    /** Tell if the store has been disposed - not visible in the UI, used for internal checks */
    disposed: boolean;
    /** Reference to the root data */
    readonly root: DtDataProperty;
    /** Sub-stores */
    readonly stores: DtStore[];
    /** Sub-processors */
    readonly processors: DtProcessor[];
}

/**
 * View object representing a Trax Processor
 */
interface DtProcessor {
    /** Processor Id */
    readonly id: string;
    /** Parent store id */
    readonly storeId: string;
    /** Object type */
    readonly type: TraxObjectType.Processor;
    /** Tell if the processor has been disposed - not visible in the UI, used for internal checks */
    disposed: boolean;
    /** Store priority - tell which processor should run first during reconciliation */
    readonly priority: number;
    /** Tell if the processor will be called during reconciliation or if it has to be re-processed manually */
    readonly autoCompute: boolean;
    /** Number of times the processor compute was called */
    computeCount: number;
    /** Tell if the processor is a renderer */
    readonly isRenderer: boolean;

    //TODO
    dependencies: string[]; // "[traxId].[propertyName"], sorted
    /** Event that triggered the last compute */
    lastTrigger: TraxComputeTrigger;
    /** Cycle id where the processor compute function was called last */
    lastComputeCycle: number;
    // TODO childProcessors: DtProcessor;
}

export interface DtLogCycle {
    /** Cycle id (incremental number) */
    readonly cycleId: number;
    /** Elapsed time since previous cycle */
    readonly elapsedMs: number;
    /** Cycle compute time */
    readonly computeMs: number;
    /** Logs */
    events: DtLogEvent[];
    /** Tell if the cycle is expanded in the log view */
    expanded: boolean;
    /** Tell if this item matches the current filter */
    matchFilter: boolean;
    /** Size of the content if expanded */
    contentSize: number;
    /** Last filter key used to process contentSize */
    filterKey: string;
}

export type DtLogEvent = { id: string; matchFilter: boolean; } & (DtEvent
    | TraxLogMsg
    | TraxLogObjectLifeCycle
    | TraxLogPropSet
    | TraxLogPropGet
    | TraxLogProcDirty
    | DtProcessingGroup | DtTraxPgStoreInit | DtTraxPgCompute | DtTraxPgCollectionUpdate | DtTraxPgReconciliation);

export interface DtEvent {
    type: "!EVT",
    eventType: string;
    data?: JSONValue
}

interface DtProcessingGroup {
    type: "!PCG";
    /** Processing group name - trax names are reserved and start with ! */
    name: string;
    /** Tell is this processing was async */
    async: boolean;
    /** Tell is this event is the follow-up of a computation that started earlier */
    resume: boolean;
    /** Processing events */
    events?: DtLogEvent[];
    /** Tell if the cycle is expanded in the log view */
    expanded: boolean;
    /** Size of the content if expanded */
    contentSize: number;
}

export interface DtTraxPgStoreInit extends DtProcessingGroup {
    name: "!StoreInit";
    storeId: string;
}

export interface DtTraxPgCompute extends DtProcessingGroup {
    name: "!Compute";
    processorId: string;
    processorPriority: number;
    trigger: TraxComputeTrigger;
    isRenderer: boolean;
    computeCount: number;
}

export interface DtTraxPgCollectionUpdate extends DtProcessingGroup {
    name: "!ArrayUpdate" | "!DictionaryUpdate";
    objectId: string;
}

export interface DtTraxPgReconciliation extends DtProcessingGroup {
    name: "!Reconciliation";
    objectId: string;
    /** Counter incremented everytime a reconciliation runs */
    index: number;
    /** Number of active processors when a reconciliation starts (allows to track memory leaks) */
    processorCount: number;
}

/**
 * Property value that can be read in a data object
 * When the value is another object (cf. refId), it may not be provided and has to be retrieved 
 * from the client API (if not in cache)
 */
interface DtDataProperty {
    /** Name of the property in its parent object */
    propName: string;
    /** Processor that computed this property (optional: only used by computed properties) */
    processor?: string;
    /** List of processor ids that have this property as a dependency (optional: some properties may not have any listener) */
    listeners?: string[];
    /** Id of the value objects hold by the property (optional: not provided for primitive types) */
    refId?: string;
    /** Property value - may not be present when the value is an object that hasn't been retrieved yet */
    value?: string | boolean | number | DtDataObject;
}

/**
 * Structure representing a data object
 */
interface DtDataObject {
    /** Trax id - unique within an application */
    id: string;
    /** Id of the store that holds this object */
    storeId: string;
    /** Object type */
    type: TraxObjectType.Object | TraxObjectType.Array;
    /** Properties or array values hold by the object */
    data: DtDataProperty[];
}

