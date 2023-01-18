import { tmd } from "./core";
import { LinkedList } from "./linkedlist";
import { ProcessingContext, TraxComputeFn, TraxEvent, TraxLogProcessStart, TraxProcessor, TrxObjectType } from "./types";

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
    compute(trigger?: "Init" | "Reconciliation" | "DirectCall", reconciliationIdx?: number): void;
    /**
     * Dispose the processor so that it can't be executed anymore
     * Called by the parent store when store.delete() is called
     */
    dispose(): void;
}

export function createTraxProcessor(
    processorId: string,
    priority: number,
    compute: TraxComputeFn,
    processorStack: LinkedList<TraxInternalProcessor>,
    getDataObject: (id: string) => any,
    logTraxEvent: (e: TraxEvent) => void,
    startProcessingContext: (event: TraxLogProcessStart) => ProcessingContext,
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
    /** Log processing context */
    let processingContext: ProcessingContext | null = null;
    /** Reconciliation id used during the last compute() call - used to track invalid cycles */
    let reconciliationId = -1;
    /** Generator returned by the compute function in case of async processors */
    let generator: Generator<Promise<any>, void, any> | undefined;

    function error(msg: string) {
        logTraxEvent({ type: "!ERR", data: msg });
    }

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
        get isDirty() {
            return dirty;
        },
        get isRenderer() {
            return isRenderer;
        },
        get isDisposed() {
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
        compute(trigger: "Init" | "Reconciliation" | "DirectCall" = "DirectCall", reconciliationIdx: number = -1) {
            if (disposed) return;
            if (!autoCompute && (trigger === "Init" || trigger === "Reconciliation")) return;

            if (dirty) {
                dirty = false;

                propDependencies.clear();
                const oldObjectDependencies = objectDependencies;
                objectDependencies = new Set<string>();

                // core compute
                processorStack.add(pr);
                computing = true;
                computeCount++;
                processingContext = startProcessingContext({
                    type: "!PCS",
                    name: "Compute",
                    processorId,
                    processorPriority: priority,
                    trigger,
                    isRenderer,
                    computeCount
                });
                reconciliationId = reconciliationIdx;

                let itr: IteratorResult<Promise<any>, void> | undefined;
                let done = true;
                try {
                    // compute will indirectly call registerDependency() through proxy getters
                    const v = compute();
                    if (!!v && v.next && typeof v.next === "function") {
                        generator = v;
                        // get the first iterator value
                        itr = v.next();
                        done = !!itr.done;
                    }
                } catch (ex) {
                    error(`(${processorId}) Compute error: ${ex}`);
                }
                processorStack.shift();
                computing = false;
                if (done) {
                    processingContext.end();
                    processingContext = null;
                } else {
                    processingContext.pause();
                    processIteratorPromise(itr, generator!);
                }

                updateDependencies(oldObjectDependencies);
                if (autoCompute && propDependencies.size === 0) {
                    error(`(${processorId}) No dependencies found: processor will never be re-executed`);
                }
            }
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            computing = false;
            generator = undefined;

            // unregister current dependencies
            for (const objectId of objectDependencies) {
                const md = tmd(getDataObject(objectId));
                if (md && md.propListeners) {
                    md.propListeners.delete(pr);
                }
            }
            logTraxEvent({ type: "!DEL", objectId: processorId, objectType: TrxObjectType.Processor });
        }
    }

    // initialization
    logTraxEvent({ type: "!NEW", objectId: processorId, objectType: TrxObjectType.Processor });
    pr.compute("Init");

    return pr;

    function propKey(objectId: string, propName: string) {
        return objectId + "." + propName;
    }

    function updateDependencies(oldObjectDependencies: Set<string>) {
        // remove old dependencies
        for (const objectId of oldObjectDependencies) {
            if (!objectDependencies.has(objectId)) {
                const md = tmd(getDataObject(objectId));
                if (md && md.propListeners) {
                    md.propListeners.delete(pr);
                }
            }
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

    function processIteratorPromise(itr: IteratorResult<Promise<any>, void> | undefined, g: Generator<Promise<any>>) {
        if (itr && !itr.done) {
            const yieldValue = itr.value;
            const logError = (err: any) => {
                error(`(${processorId}) Compute error: ${err}`);
            }

            if (!!yieldValue && (yieldValue as any).then) {
                // yield returned a promise
                yieldValue.then((v) => {
                    computeNext(v, g);
                }).catch(logError);
            } else {
                // yield did not return a promise - let's create one
                Promise.resolve().then(() => {
                    computeNext(yieldValue, g);
                }).catch(logError);
            }
        }
    }

    function computeNext(nextValue: any, g: Generator<Promise<any>, void, any>) {
        if (disposed || g !== generator || !processingContext) return;
        // note: g !==generator when compute() was called before the previous generator processing ended

        processorStack.add(pr);
        computing = true;
        processingContext.resume();

        let itr: IteratorResult<Promise<any>, void> | undefined;
        let done = true;

        try {
            // compute will indirectly call registerDependency() through proxy getters
            itr = g.next(nextValue);
            done = !!itr.done;
        } catch (ex) {
            error(`(${processorId}) Compute error: ${ex}`);
            done = true;
        }

        processorStack.shift();
        computing = false;
        if (done) {
            processingContext.end();
        } else {
            processingContext.pause();
            processIteratorPromise(itr, g);
        }
    }
}