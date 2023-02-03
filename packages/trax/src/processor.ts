import { tmd } from "./core";
import { wrapFunction } from "./functionwrapper";
import { LinkedList } from "./linkedlist";
import { ProcessingContext, TraxComputeFn, TraxEvent, TraxLogTraxProcessingCtxt, TraxProcessor, TraxObjectType } from "./types";

/**
 * Extend the public API with internal APIs
 */
export interface TraxInternalProcessor extends TraxProcessor {
    /**
     * Tell when the processor was last called for reconciliation
     * Negative if never reconciled
     */
    readonly reconciliationId: number;
    /**
     * Notify a property change on one of the objects that the processors
     * registered in its object dependency set
     * @param objId 
     * @param propName 
     * @returns true if the processor turned dirty
     */
    notifyChange(objId: string, propName: string): boolean;
    /**
     * Register a dependency on this processor
     * (Call will be ignored if the processor is not processing)
     * @param object 
     * @param objectID 
     * @param propName 
     */
    registerDependency(object: any, objectID: string, propName: string): void;
    /**
     * Re-execute the processor compute function if necessary (i.e. dirty)
     * @param trigger the reason that triggered the call to process
     * - Init = processor creation
     * - Reconcialiation = call made by trax at the end of each cycle (cf. processChanges)
     * - DirectCall = explicit call (usually made by processors that are not auto-computed)
     */
    compute(forceExecution?: boolean, trigger?: "Init" | "Reconciliation" | "DirectCall", reconciliationIdx?: number): void;
}

export function createTraxProcessor(
    processorId: string,
    priority: number,
    compute: TraxComputeFn,
    processorStack: LinkedList<TraxInternalProcessor>,
    getDataObject: (id: string) => any,
    logTraxEvent: (e: TraxEvent) => void,
    startProcessingContext: (event: TraxLogTraxProcessingCtxt) => ProcessingContext,
    onDispose?: (id: string) => void,
    autoCompute = true,
    isRenderer = false
): TraxInternalProcessor {
    /** Number of time compute was called */
    let computeCount = 0;
    /** Tell if the processor need to re-compute its output */
    let dirty = true;
    /** Tell if the processor is disposed and should be considered as deleted */
    let disposed = false;
    /** Tell that the processor is running the compute function */
    let computing = false;
    /** Set of property dependencies - e.g. myObjectId.propName  */
    let propDependencies = new Set<string>();
    /** 
     * Set of object ids that the processor depends on 
     * We cannot keep direct object references as it would prevent object garbage collection
     */
    let objectDependencies = new Set<string>();
    let oldObjectDependencies: Set<string> | undefined;
    /** Reconciliation id used during the last compute() call - used to track invalid cycles */
    let reconciliationId = -1;
    /** Last reason that triggered a compute call */
    let lastTrigger: "Init" | "Reconciliation" | "DirectCall" = "DirectCall";

    function error(msg: string) {
        logTraxEvent({ type: "!ERR", data: msg });
    }

    const wrappedCompute = wrapFunction(
        compute,
        () => startProcessingContext({
            type: "!PCS",
            name: "Compute",
            processorId,
            processorPriority: priority,
            trigger: lastTrigger,
            isRenderer,
            computeCount
        }),
        (ex) => { error(`(${processorId}) Compute error: ${ex}`); },
        () => {
            // onProcessStart
            computing = true;
            processorStack.add(pr);
            return disposed ? false : undefined;
        },
        () => {
            // onProcessEnd
            computing = false;
            processorStack.shift();
            updateDependencies();
        }
    );

    const pr: TraxInternalProcessor = {
        get id() {
            return processorId;
        },
        get reconciliationId() {
            return reconciliationId;
        },
        get autoCompute() {
            return autoCompute;
        },
        get priority() {
            return priority;
        },
        get computeCount() {
            return computeCount;
        },
        get dirty() {
            return dirty;
        },
        get isRenderer() {
            return isRenderer;
        },
        get disposed() {
            return disposed;
        },
        get dependencies() {
            if (disposed) return [];
            return Array.from(propDependencies).sort();
        },
        onDirty: null,
        notifyChange(objectId: string, propName: string): boolean {
            if (disposed || computing) return false; // a processor cannot setitself dirty
            if (!dirty && propDependencies.has(propKey(objectId, propName))) {
                dirty = true;
                logTraxEvent({ type: "!DRT", processorId, objectId, propName });
                if (this.onDirty) {
                    try {
                        this.onDirty();
                    } catch (ex) {
                        error(`(${processorId}) onDirty callback execution error: ${ex}`);
                    }
                }
                return true;
            }
            return false;
        },
        registerDependency(object: any, objectId: string, propName: string): void {
            if (!computing || disposed) return;
            if (propName === "then" && object.then === undefined) {
                return; // no need to track access to undefined promises
            }
            propDependencies.add(propKey(objectId, propName));
            objectDependencies.add(objectId);
        },
        compute(forceExecution = false, trigger: "Init" | "Reconciliation" | "DirectCall" = "DirectCall", reconciliationIdx: number = -1) {
            if (disposed) return;
            if (!forceExecution && !autoCompute && (trigger === "Init" || trigger === "Reconciliation")) return;

            if (dirty || forceExecution) {
                dirty = false;

                propDependencies.clear();
                oldObjectDependencies = objectDependencies;
                objectDependencies = new Set<string>();

                // core compute
                computeCount++;
                reconciliationId = reconciliationIdx;
                lastTrigger = trigger;

                const r = wrappedCompute();
                if (r && typeof r === "object" && typeof (r as any).catch === "function") {
                    // r is a promise
                    // no need to log the error as it was already caught up by the wrapped function
                    (r as any as Promise<any>).catch(() => { });
                }

                if (autoCompute && propDependencies.size === 0) {
                    error(`(${processorId}) No dependencies found: processor will never be re-executed`);
                }
            }
        },
        dispose(): boolean {
            if (disposed) return false;
            disposed = true;
            computing = false;
            // detach from parent store
            if (onDispose) {
                onDispose(processorId);
            }

            // unregister current dependencies
            for (const objectId of objectDependencies) {
                const md = tmd(getDataObject(objectId));
                if (md && md.propListeners) {
                    md.propListeners.delete(pr);
                }
            }
            logTraxEvent({ type: "!DEL", objectId: processorId, objectType: TraxObjectType.Processor });
            return true;
        }
    }

    // initialization
    logTraxEvent({ type: "!NEW", objectId: processorId, objectType: TraxObjectType.Processor });
    pr.compute(false, "Init");

    return pr;

    function propKey(objectId: string, propName: string) {
        return objectId + "." + propName;
    }

    function updateDependencies() {
        // remove old dependencies
        if (oldObjectDependencies) {
            for (const objectId of oldObjectDependencies) {
                if (!objectDependencies.has(objectId)) {
                    const md = tmd(getDataObject(objectId));
                    if (md && md.propListeners) {
                        md.propListeners.delete(pr);
                    }
                }
            }
            oldObjectDependencies = undefined;
        }
        // register current dependencies
        for (const objectId of objectDependencies) {
            const md = tmd(getDataObject(objectId));
            if (md) {
                if (!md.propListeners) {
                    md.propListeners = new Set();
                }
                md.propListeners.add(pr);
            }
        }
    }
}