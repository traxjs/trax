import { createEventStream } from "./eventstream";
import { LinkedList } from "./linkedlist";
import { $TraxInternalProcessor, createTraxProcessor } from "./processor";
import { $Store, $StoreWrapper, $Trax, $TraxIdDef, $TraxProcessor, $TrxObjectType, $TraxLogProcessStart, traxEvents, $TraxComputeFn, $TraxEvent, $ProcessingContext, $TraxProcessorId } from "./types";


export const traxMD = Symbol("trax.md");
const RX_INVALID_ID = /(\/|\>)/g;
const ROOT = "root";
/** Separator used to join array id definitions */
const ID_SEPARATOR1 = ":";
/** Separator used to create automatic ids while navigating JSON objects */
const ID_SEPARATOR2 = "*";
/** Separator used to replace "/" when creating ids from other ids */
const ID_SEPARATOR3 = "-";
/** Separator used to append a unique counter to dedupe a generated id that already exists */
const ID_SEPARATOR4 = "$";
/** Property prefix for reference properties */
const REF_PROP_PREFIX = "$";

/**
 * Meta-data object attached to each trax object (object, array, dictionary, processor, store)
 */
interface $TraxMd {
    /** The trax unique id */
    id: string;
    /** The object type */
    type: $TrxObjectType;
    /**
     * Used by data objects (objects / array / dictionary) to track processors that have a dependency on their properties
     */
    propListeners?: Set<$TraxInternalProcessor>;
    /**
     * Map of computed properties and their associated processor
     * Allows to detect if a computed property is illegaly changed
     */
    computedProps?: { [propName: string]: $TraxProcessorId | undefined };
    /**
     * Property used when the trax object is a collection and its content is set by a processor
     * through updateArray or updateDictionary
     * In this case computedProps should be undefined
     */
    computedContent?: $TraxProcessorId;
    /**
    * Auto-wrap level / Ref props computation
    * Tell how sub-objects properties should be handled and if sub-objects should be automatcially wrapped or if
    * they should be considered as references
    * If level is 1, properties will be considered as references and won't be wrapped
    * If level is >1, wrapped properties will be passed a decremented level (e.g. x-1 if x is the current level)
    * Default = 0 (sub-object will be wrapped)
    */
    awLevel?: number;
}

/**
 * Get the trax meta data associated to an object
 * @param o 
 * @returns 
 */
export function tmd(o: any): $TraxMd | undefined {
    return o ? o[traxMD] : undefined;
}

/**
 * Create and attach meta data to a given object
*/
function attachMetaData(o: Object, id: string, type: $TrxObjectType): $TraxMd {
    const md: $TraxMd = { id, type };
    (o as any)[traxMD] = md;
    return md;
}

/**
 * Create a trax environment
 */
export function createTraxEnv(): $Trax {
    /** Private key to authorize reserved events in the log stream */
    const privateEventKey = {};
    /** counter used to de-dupe auto-generated ids */
    let dupeCount = 0;
    /** Global map containing all stores */
    const storeMap = new Map<string, $Store<any>>();
    /** Global map containing weakrefs to all data */
    const dataRefs = new Map<string, WeakRef<any>>();
    /** Global processor map */
    const processors = new Map<string, $TraxInternalProcessor>();
    const isArray = Array.isArray;
    /** Count of processors that have been created - used to set processor priorities */
    let processorPriorityCounter = 0;
    /** Total number of active processors */
    let processorCount = 0;
    /** Call stack of the processors in compute mode */
    let processorStack = new LinkedList<$TraxInternalProcessor>();
    /** Reconciliation linked list: list of processors that need to be reconciled */
    let reconciliationList = new LinkedList<$TraxInternalProcessor>();
    /** Count the number of reconciliation executions */
    let reconciliationCount = 0;
    /** Log stream */
    const jsonReplacer = (d: any) => {
        return JSON.stringify(d, (key: string, value: any) => {
            if (typeof value === "object") {
                const md = tmd(value);
                return md ? `[TRAX ${md.id}]` : value;
            } else if (typeof value === "function") {
                return "[Function]";
            }
            return value;
        });
    }
    const log = createEventStream(privateEventKey, jsonReplacer, () => {
        trx.processChanges();
    });

    const trx = {
        log,
        createStore<R, T extends Object>(
            idPrefix: $TraxIdDef,
            initFunctionOrRoot: Object | ((store: $Store<T>) => R)
        ): R extends void ? $Store<T> : R & $StoreWrapper {
            return createStore(idPrefix, initFunctionOrRoot, storeMap);
        },
        get pendingChanges() {
            return reconciliationList.size > 0;
        },
        processChanges(): void {
            // reconciliation
            if (reconciliationList.size > 0) {
                reconciliationCount++;
                const recLog = startProcessingContext({
                    type: "!PCS",
                    name: "Reconciliation",
                    index: reconciliationCount,
                    processorCount
                });
                let p = reconciliationList.shift();
                while (p) {
                    if (p.reconciliationId === reconciliationCount) {
                        error(`(${p.id}) Circular reference: Processors cannot run twice during reconciliation`);
                    } else {
                        p.compute("Reconciliation", reconciliationCount);
                    }
                    p = reconciliationList.shift();
                }
                recLog.end();
            }
        },
        async reconciliation(): Promise<void> {
            const lastEvent = log.lastEvent();
            // wait for the end of the current cycle if a cycle already started
            // (reconcilation will be automatically triggered at the end of the cycle)
            if (lastEvent && lastEvent.type !== traxEvents.CycleComplete) {
                await log.await(traxEvents.CycleComplete);
            }
        },
        isTraxObject(obj: any): boolean {
            return tmd(obj) !== undefined;
        },
        getTraxId(obj: any): string {
            return tmd(obj)?.id || "";
        },
        getTraxObjectType(obj: any): $TrxObjectType {
            return tmd(obj)?.type || $TrxObjectType.NotATraxObject;
        },
        updateArray(array: any[], newContent: any[]) {
            if (!isArray(array) || !isArray(newContent)) {
                error(`updateAray: Invalid argument (array expected)`);
                return;
            }
            const md = tmd(array);
            if (md) {
                sanitizeComputedMd(md);
                const pr = processorStack.peek()
                if (pr) {
                    if (!md.computedContent) {
                        md.computedContent = pr.id;
                    } else {
                        // illegal change unless the previous processor has been disposed
                        if (pr.id !== md.computedContent) {
                            error(`Computed content conflict: ${md.id} can only be changed by ${md.computedContent}`);
                        }
                    }
                }
            }
            const ctxt = startProcessingContext({ type: traxEvents.ProcessingStart, name: "ArrayUpdate", objectId: md?.id || "" });
            const len1 = array.length;
            const len2 = newContent.length;
            for (let i = 0; len2 > i; i++) {
                array[i] = newContent[i];
            }
            if (len2 < len1) {
                for (let i = len2; len1 > i; i++) {
                    // explicitely set items to undefined to notify potential listeners
                    array[i] = undefined;
                }
                array.splice(len2, len1 - len2);
            }
            ctxt.end();
        },
    }

    const proxyHandler = {
        /**
         * Function called on each property get
         * @param target the original object that is proxied
         * @param prop the property name
         */
        get(target: any, prop: string | symbol) {
            const md = tmd(target);
            if (prop === traxMD) {
                return md;
            } else if (typeof prop === "string") {
                let v: any;
                let addLog = false;

                if (md) {
                    // register dependency
                    const pr = processorStack.peek();
                    if (pr) {
                        pr.registerDependency(target, md.id, prop);
                    }
                    // don't add log for common internal built-in props
                    addLog = ((prop !== "then" && prop !== "toJSON" && prop !== "constructor") || v !== undefined);
                    v = target[prop] = wrapPropObject(target[prop], target, prop, md);

                    addLog && logTraxEvent({ type: "!GET", objectId: md.id, propName: prop as string, propValue: v });
                } else {
                    v = target[prop];
                }
                return v;
            }
            return target[prop];
        },

        /**
         * Function called on each property set
         * @param target the original object that is proxied
         * @param prop the property name
         * @param value the value
         */
        set(target: any, prop: string | number | symbol, value: any) {
            if (prop === traxMD && value === undefined) {
                // delete metadata
                target[traxMD] = undefined;
            } else if (typeof prop !== "symbol") {
                const v = target[prop];
                const md = tmd(target);

                if (md) {
                    // Register computed props
                    const pr = processorStack.peek();
                    if (pr) {
                        sanitizeComputedMd(md);
                        let prId = md.computedContent || undefined;
                        // the current prop is computed:
                        // - either it is an independent prop
                        // - or it is part of a computed collection
                        if (!md.computedContent) {
                            // this is a computed property
                            let computedProps = md.computedProps;
                            if (!computedProps) {
                                computedProps = md.computedProps = {};
                            }
                            prId = computedProps[prop];
                            if (!prId) {
                                computedProps[prop] = pr.id;
                            }
                        }

                        if (prId) {
                            // a processor is already defined for the current property
                            if (prId !== pr.id) {
                                // illegal change unless the previous processor has been disposed
                                if (md.computedContent) {
                                    error(`Computed content conflict: ${md.id}.${prop} can only be set by ${prId}`);
                                } else {
                                    error(`Computed property conflict: ${md.id}.${prop} can only be set by ${prId}`);
                                }
                                value = v;
                            }
                        }
                    }

                    if (v !== value) {
                        let lengthChange = false;
                        if (isArray(target)) {
                            // we ned to notify length change as functions like Array.push won't explicitely do it
                            const len = target.length;
                            value = target[prop as any] = wrapPropObject(value, target, "" + prop, md);
                            lengthChange = target.length !== len;
                        } else {
                            value = target[prop] = wrapPropObject(value, target, "" + prop, md);
                        }

                        logTraxEvent({ type: "!SET", objectId: md.id, propName: prop as string, fromValue: v, toValue: value });
                        if (typeof prop === "string") {
                            notifyPropChange(md, prop);
                        }
                        if (lengthChange) {
                            notifyPropChange(md, "length");
                        }
                    }
                } else {
                    // object is disposed
                    target[prop] = value;
                }
            }
            return true;
        },

        /**
         * Proxy handler method called when a property is deleted through the delete operator
         * @param target 
         * @param prop 
         */
        deleteProperty(target: any, prop: string | symbol): boolean {
            if (typeof prop === "string" && prop in target) {
                return true;
            }
            return false;
        }
    };

    /**
     * Auto-wrap a trax object property into a sub trax object
     */
    function wrapPropObject(v: any, target: any, propName: string, targetMd: $TraxMd) {
        if (v !== null && v !== undefined && typeof v === "object") {
            // automatically wrap sub-objects
            let vmd = tmd(v);
            if (vmd) return v; // already wrapped

            // determine auto-wrap-level - if 1, direct properties must not be wrapped
            let awLevel = 0; // default = wrap
            if (propName[0] === REF_PROP_PREFIX) {
                // e.g. $myProp -> awLevel=1 / $$$myArray -> awLevel=3
                let idx = 0, plen = propName.length;
                while (idx < plen) {
                    if (propName[idx] === REF_PROP_PREFIX) {
                        awLevel++;
                    } else {
                        break;
                    }
                    idx++;
                }
            } else if (targetMd.awLevel) {
                awLevel = targetMd.awLevel;
            }
            if (awLevel !== 1) {
                // let's autowrap
                if (!vmd) {
                    // this value object is not wrapped yet
                    v = getProxy(targetMd.id + ID_SEPARATOR2 + propName, v, true);
                    if (awLevel && awLevel > 1) {
                        // propagate awLevel to child md
                        let vmd = tmd(v);
                        if (vmd && !vmd.awLevel) {
                            vmd.awLevel = awLevel - 1;
                        }
                    }
                }
            }
        }
        return v;
    }

    function getProxy(id: string, obj?: any, generateNewId = false) {
        const p = getDataObject(id);
        if (p) {
            // generateId is false when called from get() or getArray()
            // but true when called from getters (to generate proxies for sub-properties/sub-objects)
            if (obj && generateNewId) {
                // a new id must be generated because this is a new object
                // but an item with this id already exists
                // so we have to create a unique id thanks to the dupeCount counter
                const initId = id;
                while (true) {
                    dupeCount++;
                    id = initId + ID_SEPARATOR4 + dupeCount;
                    if (!dataRefs.get(id)) {
                        break;
                    }
                }
            } else {
                return p;
            }
        }
        if (obj === undefined) {
            // object not found, no default provided
            return undefined;
        }

        // create a new proxy
        let md: $TraxMd;
        if (isArray(obj)) {
            // TODO
            md = attachMetaData(obj, id, $TrxObjectType.Array);
        } else {
            md = attachMetaData(obj, id, $TrxObjectType.Object);
        }
        logTraxEvent({ type: "!NEW", objectId: id, objectType: md.type });
        const prx = new Proxy(obj, proxyHandler);
        storeDataObject(id, prx);
        return prx;
    }

    return trx;

    function registerProcessorForReconciliation(pr: $TraxInternalProcessor) {
        const prio = pr.priority;
        reconciliationList.insert((prev?: $TraxInternalProcessor, next?: $TraxInternalProcessor) => {
            if (!next || prio <= next.priority) {
                return pr;
            }
        });
    }

    function buildIdSuffix(id: $TraxIdDef, storeId?: string) {
        let suffix = "";
        if (isArray(id)) {
            suffix = id.map(item => {
                if (typeof item === "object") {

                    const md = tmd(item);
                    if (!md) {
                        error(`Invalid id param: not a trax object`);
                        return getRandomId();
                    } else {
                        const tid = md.id;
                        if (storeId) {
                            const slen = storeId.length + 1;
                            if (tid.length > slen && tid.slice(0, slen) === storeId + "/") {
                                // same store: return suffix
                                return tid.slice(slen);
                            }
                        }
                        // different store: replace "/"
                        return tid.replace(/\//g, ID_SEPARATOR3);
                    }
                }
                return "" + item;
            }).join(ID_SEPARATOR1);
        } else {
            suffix = id;
        }
        if (suffix.match(RX_INVALID_ID)) {
            const newSuffix = suffix.replace(RX_INVALID_ID, "");
            error(`Invalid trax id: ${suffix} (changed into ${newSuffix})`);
            suffix = newSuffix;
        }
        return suffix;
    }

    function getRandomId(): string {
        return "" + Math.floor(Math.random() * 100000);
    }

    function buildId(id: $TraxIdDef, storeId: string, isProcessor: boolean) {
        let suffix = buildIdSuffix(id, storeId);
        if (isProcessor) return storeId + "/%" + suffix;
        return storeId + "/" + suffix;;
    }

    /**
     * Check that processor meta data are still valid
     * (processor may have been disposed and ids still references in md)
     * @param md 
     * @param propName 
     */
    function sanitizeComputedMd(md?: $TraxMd, propName?: string) {
        if (md) {
            if (needReset(md.computedContent)) {
                md.computedContent = undefined;
            }
            const cps = md.computedProps;
            if (cps && propName && needReset(cps[propName])) {
                cps[propName] = undefined;
            }
        }

        function needReset(id?: string) {
            // return true if change required
            if (id && !processors.has(id)) {
                return true;
            }
            return false;
        }
    }

    function error(msg: string) {
        log.error('[TRAX] ' + msg);
    }

    function logTraxEvent(e: $TraxEvent) {
        if (e.type === traxEvents.Error) {
            error("" + e.data);
        } else {
            log.event(e.type, e as any, privateEventKey);
        }
    }

    function startProcessingContext(event: $TraxLogProcessStart): $ProcessingContext {
        return log.startProcessingContext(event as any);
    }

    function notifyPropChange(md: $TraxMd, propName: string) {
        // set processor dirty if they depend on this property
        const processors = md.propListeners;
        if (processors) {
            for (const pr of processors) {
                if (pr.notifyChange(md.id, propName)) {
                    // this processor turned dirty
                    registerProcessorForReconciliation(pr);
                }
            }
        }
    }

    /** 
     * Return objects, arrays or dictionaries 
     */
    function getDataObject(id: string): any {
        const ref = dataRefs.get(id);
        if (ref) {
            return ref.deref() || null;
        }
        return null;
    }

    function storeDataObject(id: string, data: Object) {
        dataRefs.set(id, new WeakRef(data));
    }

    function removeDataObject(id: string): boolean {
        const ref = dataRefs.get(id);
        if (ref) {
            const o = ref.deref() || null;
            let objectType = $TrxObjectType.NotATraxObject;
            if (o) {
                const md = tmd(o);
                if (md) {
                    // TODO: dirty all processor dependencies
                    o[traxMD] = undefined;
                    objectType = md.type;
                }
            }
            logTraxEvent({ type: "!DEL", objectId: id, objectType });
            return dataRefs.delete(id);
        }
        return false;
    }

    function createStore<R, T extends Object>(
        idPrefix: $TraxIdDef,
        initFunctionOrRoot: Object | ((store: $Store<T>) => R),
        storeMap: Map<string, $Store<any>>
    ): R extends void ? $Store<T> : R & $StoreWrapper {
        const storeId = buildStoreId();
        let root: any;
        let initPhase = true;
        let disposed = false;
        const storeInit = startProcessingContext({ type: "!PCS", name: "StoreInit", storeId: storeId });
        const initFunction = typeof initFunctionOrRoot === "function" ? initFunctionOrRoot : (store: $Store<T>) => {
            store.initRoot(initFunctionOrRoot as any);
        }

        const store: $Store<T> = {
            get id() {
                return storeId;
            },
            get root() {
                // root should always be defined if initFunction is correctly implemented
                return root;
            },
            initRoot(r: T) {
                if (initPhase) {
                    root = getOrAdd(ROOT, r, true);
                } else {
                    error(`(${storeId}) Store.initRoot can only be called during the store init phase`);
                }
                return root;
            },
            get<T extends Object>(id: $TraxIdDef, isProcessor = false): T | void {
                const sid = buildId(id, storeId, isProcessor);
                if (isProcessor) {
                    return processors.get(sid) as any;
                }
                return getDataObject(sid) || undefined;
            },
            add<T extends Object | Array<any>>(id: $TraxIdDef, o: T): T {
                return getOrAdd(id, o, false);
            },
            delete<T extends Object>(o: T): boolean {
                const md = tmd(o);
                let id = "";
                if (md) {
                    id = md.id;
                    if (md.type === $TrxObjectType.Processor) {
                        return deleteProcessor(o as any as $TraxInternalProcessor);
                    } else if (md.type !== $TrxObjectType.Store) {
                        return removeDataObject(id);
                    }
                }
                return false;
            },
            compute(id: $TraxIdDef, compute: $TraxComputeFn, autoCompute?: boolean, isRenderer?: boolean): $TraxProcessor {
                let pid = buildId(id, storeId, true);
                let pr = processors.get(pid);
                if (pr) {
                    return pr;
                }
                processorPriorityCounter++; // used for priorities
                processorCount++; // used to track potential memory leaks
                pr = createTraxProcessor(pid, processorPriorityCounter, compute, processorStack, getDataObject, logTraxEvent, startProcessingContext, autoCompute, isRenderer);
                attachMetaData(pr, pid, $TrxObjectType.Processor);
                processors.set(pid, pr);
                return pr;
            }
        };
        // attach meta data
        attachMetaData(store, storeId, $TrxObjectType.Store);

        // register store in parent
        storeMap.set(storeId, store);

        function dispose() {
            // unregiser store in parent
            storeMap.delete(storeId);
            disposed = true;
        }

        function deleteProcessor(pr: $TraxInternalProcessor) {
            const ok = processors.delete(pr.id);
            if (ok) {
                pr.dispose();
                processorCount--;
            }
            return ok;
        }

        let r: R;
        try {
            r = initFunction(store);
            initPhase = false;
            if (r !== undefined && (r === null || typeof r !== "object")) {
                error(`createStore init function must return a valid object (${storeId})`);
                r = {} as R;
            }
        } catch (ex) {
            error(`createStore init error (${storeId}): ${ex}`);
            r = {} as R;
        }
        initPhase = false;
        checkRoot();
        if (r === undefined) {
            // init function doesn't define any wrapper -> return the raw store object
            storeInit.end();
            return store as any;
        }

        // wrap existing dispose if any
        const res = r as any;
        if (typeof res.dispose === 'function') {
            const originalDispose = res.dispose;
            res.dispose = () => {
                try {
                    originalDispose.call(r);
                } catch (ex) {
                    error(`Store.dispose error (${storeId}): ${ex}`);
                }
                dispose();
            }
        } else res.dispose = dispose;
        // add id property
        if (res.id) {
            error(`Store id will be overridden and must not be provided by init function (${storeId})`);
        }
        res.id = storeId;
        storeInit.end();
        return res;

        function checkRoot() {
            if (root == undefined) {
                error(`(${storeId}) createStore init must define a root object - see also: initRoot()`);
                root = getOrAdd(ROOT, {}, true);
            }
        }

        function checkNotDisposed() {
            if (disposed) {
                error(`(${storeId}) Stores cannot be used after being disposed`);
                return false;
            }
            return true;
        }

        function buildStoreId() {
            let storeId = buildIdSuffix(idPrefix);
            let st = storeMap.get(storeId);
            let count = 0, suffix = "";
            while (st) {
                suffix = "" + (++count);
                st = st = storeMap.get(storeId + suffix);
            }
            return storeId + suffix;
        }

        /**
         * Function behind store.add - support an extra argument to prevent ROOT id
         * @param id 
         * @param o 
         * @reeturns 
         */
        function getOrAdd<T extends Object>(id: $TraxIdDef, o: T, acceptRootId: boolean): T {
            let idSuffix = buildIdSuffix(id, storeId);
            if (!acceptRootId) {
                if (idSuffix === ROOT) {
                    error("Store.add: Invalid id 'root' (reserved)");
                    idSuffix = getRandomId();
                }
            }
            if (checkNotDisposed()) {
                if (o === undefined || o === null || typeof o !== "object") {
                    error(`(${storeId}) Store.add(${id}): Invalid init object parameter: [${typeof o}]`);
                    o = {} as T;
                }
                return getProxy(buildId(idSuffix, storeId, false), o);
            } else {
                return o as any;
            }
        }

    }
}




