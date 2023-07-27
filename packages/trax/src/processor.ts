import { registerMdPropListener, tmd, unregisterMdPropListener } from "./core";
import { wrapFunction } from "./functionwrapper";
import { LinkedList } from "./linkedlist";
import { ProcessingContext, TraxComputeFn, TraxEvent, TraxLogTraxProcessingCtxt, TraxProcessor, TraxObjectType, TraxObjectComputeFn, TraxComputeContext, traxEvents } from "./types";

const LAZY_PREFIX = "~";

/**
 * Extend the public API with internal APIs
 */
export interface TraxInternalProcessor extends TraxProcessor {
    /**
     * Target object - only used by lazy processors attached to an object (the target)
     */
    readonly target: any | null;
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
     * - TargetRead = (for processors associated to an object cf. store.add) call made when a property from the target is being read
     * - DirectCall = explicit call (usually made by processors that are not auto-computed)
     */
    compute(forceExecution?: boolean, trigger?: "Init" | "Reconciliation" | "TargetRead" | "DirectCall", reconciliationIdx?: number): void;
    /**
     * Update the compute function associated to a processor (allows to get access to different closure variables)
     * @param fn
     */
    updateComputeFn(fn: TraxComputeFn | TraxObjectComputeFn<any>): void;
}

export function createTraxProcessor<T>(
    processorId: string,
    processorName: string,
    priority: number,
    compute: TraxComputeFn | TraxObjectComputeFn<T>,
    processorStack: LinkedList<TraxInternalProcessor>,
    getDataObject: (id: string) => any,
    logTraxEvent: (e: TraxEvent) => void,
    startProcessingContext: (event: TraxLogTraxProcessingCtxt) => ProcessingContext,
    /** Object associated to this processor */
    target: T | null,
    onDispose?: (id: string) => void,
    autoCompute = true,
    isRenderer = false
): TraxInternalProcessor {
    /** Number of time compute was called */
    let computeCount = 0;
    /** Maximum number of compute before the processor is disposed */
    let maxComputeCount = -1;
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
    let lastTrigger: "Init" | "Reconciliation" | "TargetRead" | "DirectCall" = "DirectCall";
    /** Current compute context */
    let cc: TraxComputeContext | undefined;
    /** Tell if this is a lazy processor */
    let lazy = false;
    if (processorName && processorName[0] === LAZY_PREFIX) {
        if (target != null) {
            lazy = true;
        } else {
            error(`(${processorId}) Eager processors must not use the ~ prefix`);
        }
    }

    function error(msg: string) {
        logTraxEvent({ type: traxEvents.Error, data: msg });
    }

    let wrappedCompute: TraxComputeFn | TraxObjectComputeFn<T>;
    let newComputeFn: TraxComputeFn | undefined;

    wrapComputeFn(compute as any);

    const pr: TraxInternalProcessor = {
        get id() {
            return processorId;
        },
        get target() {
            return target;
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
        get isLazy() {
            return lazy;
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
                logTraxEvent({ type: traxEvents.ProcessorDirty, processorId, objectId, propName });
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
            registerMdPropListener(pr, tmd(getDataObject(objectId)));
        },
        compute(forceExecution = false, trigger: "Init" | "Reconciliation" | "TargetRead" | "DirectCall" = "DirectCall", reconciliationIdx: number = -1) {
            if (disposed) return;
            if (!forceExecution && !autoCompute && (trigger === "Init" || trigger === "Reconciliation")) return;

            let process = true;
            // process must be done when the target is read in a processor context
            const mustProcess = trigger === "TargetRead" && processorStack.size > 0;
            if (lazy && !mustProcess) {
                process = tmd(target)?.hasExternalPropListener || false;
            }

            if ((process && dirty) || forceExecution) {
                dirty = false;

                propDependencies.clear();
                oldObjectDependencies = objectDependencies;
                objectDependencies = new Set<string>();

                // core compute
                computeCount++;
                reconciliationId = reconciliationIdx;
                lastTrigger = trigger;

                if (newComputeFn) {
                    wrapComputeFn(newComputeFn);
                    newComputeFn = undefined;
                }

                cc = {
                    processorId,
                    processorName,
                    computeCount,
                    maxComputeCount
                };

                let r;
                if (target !== null) {
                    r = (wrappedCompute as TraxObjectComputeFn<T>)(target, cc);
                } else {
                    r = (wrappedCompute as TraxComputeFn)(cc);
                }

                if (r && typeof r === "object" && typeof (r as any).catch === "function") {
                    // r is a promise
                    // no need to log the error as it was already caught up by the wrapped function
                    (r as any as Promise<any>).catch(() => { });
                }

                if (autoCompute && propDependencies.size === 0) {
                    error(`(${processorId}) No dependencies found: processor will never be re-executed`);
                }
            } else if (!process) {
                // process is only false in case of lazy processors
                logTraxEvent({ type: traxEvents.ProcessorSkipped, processorId });
            }
        },
        updateComputeFn(fn: TraxComputeFn): void {
            newComputeFn = fn;
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
                unregisterMdPropListener(pr, tmd(getDataObject(objectId)));
            }
            logTraxEvent({ type: traxEvents.Dispose, objectId: processorId });
            return true;
        }
    }

    // initialization
    logTraxEvent({ type: traxEvents.New, objectId: processorId, objectType: TraxObjectType.Processor });
    pr.compute(false, "Init");

    return pr;

    function propKey(objectId: string, propName: string) {
        return objectId + "." + propName;
    }

    function wrapComputeFn(fn: TraxComputeFn) {
        wrappedCompute = wrapFunction(
            fn,
            () => startProcessingContext({
                type: "!PCS",
                name: "!Compute",
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
            (done: boolean) => {
                // onProcessEnd
                computing = false;
                processorStack.shift();
                maxComputeCount = cc?.maxComputeCount || -1;
                if (done && maxComputeCount > -1 && computeCount >= maxComputeCount) {
                    pr.dispose();
                } else {
                    updateDependencies();
                }
            }
        );
    }

    function updateDependencies() {
        // remove old dependencies
        if (oldObjectDependencies) {
            for (const objectId of oldObjectDependencies) {
                if (!objectDependencies.has(objectId)) {
                    unregisterMdPropListener(pr, tmd(getDataObject(objectId)));
                }
            }
            oldObjectDependencies = undefined;
        }
    }
}
