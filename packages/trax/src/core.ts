import { createEventStream } from "./eventstream";
import { wrapFunction } from "./functionwrapper";
import { LinkedList } from "./linkedlist";
import { TraxInternalProcessor, createTraxProcessor } from "./processor";
import { Store, StoreWrapper, Trax, TraxIdDef, TraxProcessor, TraxObjectType, TraxLogTraxProcessingCtxt, traxEvents, TraxComputeFn, TraxEvent, ProcessingContext, TraxProcessorId, TraxObject } from "./types";

/** Symbol used to attach meta data to trax objects */
export const traxMD = Symbol("trax.md");
/** Symbol used to attach the Object.keys() size to objects used as dictionaries - cf. getObjectKeys() */
const dictSize = Symbol("trax.dict.size");
const RX_INVALID_ID = /(\/|\>|\.|\%)/g;
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
/** Separator for sub-store ids */
const ID_SUB_STORE_SEPARATOR = ">";
/** Pseudo property name to track dict size */
const DICT_SIZE_PROP = '☆trax.dictionary.size☆';

/**
 * Meta-data object attached to each trax object (object, array, dictionary, processor, store)
 */
interface TraxMd {
    /** The trax unique id */
    id: string;
    /** The object type */
    type: TraxObjectType;
    /** Store that the object belongs to. Empty string for root stores */
    storeId: string;
    /**
     * Used by data objects (objects / array / dictionary) to track processors that have a dependency on their properties
     */
    propListeners?: Set<TraxInternalProcessor>;
    /**
     * Map of computed properties and their associated processor
     * Allows to detect if a computed property is illegaly changed
     */
    computedProps?: { [propName: string]: TraxProcessorId | undefined };
    /**
     * Property used when the trax object is a collection and its content is set by a processor
     * through updateArray or updateDictionary
     * In this case computedProps should be undefined
     */
    computedContent?: TraxProcessorId;
    /**
    * Auto-wrap level / Ref props computation
    * Tell how sub-objects properties should be handled and if sub-objects should be automatcially wrapped or if
    * they should be considered as references
    * If level is 1, properties will be considered as references and won't be wrapped
    * If level is >1, wrapped properties will be passed a decremented level (e.g. x-1 if x is the current level)
    * Default = 0 (sub-object will be wrapped)
    */
    awLevel?: number;
    /**
     * Number of properties set on an object - only used for objects used as dictionaries
     */
    dictSize?: number;
}

/**
 * Get the trax meta data associated to an object
 * @param o 
 * @returns 
 */
export function tmd(o: any): TraxMd | undefined {
    return o ? o[traxMD] : undefined;
}

/**
 * Create and attach meta data to a given object
*/
function attachMetaData(o: Object, id: string, type: TraxObjectType, storeId: string): TraxMd {
    const md: TraxMd = { id, type, storeId };
    (o as any)[traxMD] = md;
    return md;
}

/**
 * Create a trax environment
 */
export function createTraxEnv(): Trax {
    /** Private key to authorize reserved events in the log stream */
    const privateEventKey = {};
    /** counter used to de-dupe auto-generated ids */
    let dupeCount = 0;
    /** Global map containing all stores */
    const stores = new Map<string, Store<any>>();
    /** Global map containing weakrefs to all data */
    const dataRefs = new Map<string, WeakRef<any>>();
    /** Global processor map */
    const processors = new Map<string, TraxInternalProcessor>();
    const isArray = Array.isArray;
    /** Count of processors that have been created - used to set processor priorities */
    let processorPriorityCounter = 0;
    /** Total number of active processors */
    let processorCount = 0;
    /** Call stack of the processors in compute mode */
    let processorStack = new LinkedList<TraxInternalProcessor>();
    /** Reconciliation linked list: list of processors that need to be reconciled */
    let reconciliationList = new LinkedList<TraxInternalProcessor>();
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
            idPrefix: TraxIdDef,
            initFunctionOrRoot: Object | ((store: Store<T>) => R)
        ): R extends void ? Store<T> : R & StoreWrapper {
            return createStore(idPrefix, "", initFunctionOrRoot);
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
                    name: "!Reconciliation",
                    index: reconciliationCount,
                    processorCount
                });
                let p = reconciliationList.shift();
                while (p) {
                    if (p.reconciliationId === reconciliationCount) {
                        error(`(${p.id}) Circular reference: Processors cannot run twice during reconciliation`);
                    } else {
                        p.compute(false, "Reconciliation", reconciliationCount);
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
                await log.awaitEvent(traxEvents.CycleComplete);
            }
        },
        isTraxObject(obj: any): boolean {
            return tmd(obj) !== undefined;
        },
        getTraxId(obj: any): string {
            return tmd(obj)?.id || "";
        },
        getTraxObjectType(obj: any): TraxObjectType {
            return tmd(obj)?.type || TraxObjectType.NotATraxObject;
        },
        getProcessor(id: TraxProcessorId): TraxProcessor | void {
            return processors.get(id);
        },
        getStore<T>(id: string): Store<T> | void {
            return stores.get(id);
        },
        getData<T>(id: string): T | void {
            return getDataObject(id) || undefined;
        },
        getActiveProcessor(): TraxProcessor | void {
            return processorStack.peek();
        },
        updateArray(array: any[], newContent: any[]) {
            if (!isArray(array) || !isArray(newContent)) {
                error(`updateArray: Invalid argument (array expected)`);
                return;
            }
            const id = checkComputedContent(array);
            const ctxt = startProcessingContext({ type: traxEvents.ProcessingStart, name: "!ArrayUpdate", objectId: id });
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
        updateDictionary<T>(dict: { [k: string]: T }, newContent: { [k: string]: T }): void {
            if (dict === null || typeof dict !== "object") {
                error(`updateDictionary: Invalid argument (object expected)`);
                return;
            }
            const id = checkComputedContent(dict);
            const ctxt = startProcessingContext({ type: traxEvents.ProcessingStart, name: "!DictionaryUpdate", objectId: id });

            const oldContentKeys = trx.getObjectKeys(dict);
            const newContentKeys = trx.getObjectKeys(newContent);

            // delete values that are not in newContent
            for (const k of oldContentKeys) {
                if (!newContentKeys.includes(k)) {
                    delete dict[k]
                }
            }

            // create or update values in newContent
            for (const k of newContentKeys) {
                dict[k] = newContent[k];
            }
            ctxt.end();
        },
        getObjectKeys(o: TraxObject): string[] {
            const md = tmd(o);
            if (!md) {
                return Object.keys(o);
            } else {
                // force read of dictSize to create a dependency on this property
                const sz: number = (o as any)[dictSize];
                if (sz) return Object.keys(o);
                return [];
            }
        }
    }

    function checkComputedContent(o: Object) {
        const md = tmd(o);
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
            return md.id;
        }
        return "";
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
            } else if (prop === "toJSON") {
                // JSON.stringify call on a proxy will get here
                return undefined;
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
                    addLog = ((prop !== "then" && prop !== "constructor") || v !== undefined);
                    if (target[prop] !== undefined) {
                        // don't set the value if undefined (otherwise it may create items in arrays)
                        v = target[prop] = wrapPropObject(target[prop], prop, md);
                    }
                    addLog && logTraxEvent({ type: "!GET", objectId: md.id, propName: prop as string, propValue: v });
                } else {
                    v = target[prop];
                }
                return v;
            } else if (prop === dictSize) {
                if (md) {
                    let v = md.dictSize;
                    if (v === undefined) {
                        // first time
                        md.dictSize = v = Object.keys(target).length;
                    }
                    const pr = processorStack.peek();
                    if (pr) {
                        pr.registerDependency(target, md.id, DICT_SIZE_PROP);
                    }
                    logTraxEvent({ type: "!GET", objectId: md.id, propName: DICT_SIZE_PROP, propValue: v });
                    return v;
                }
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
                    sanitizeComputedMd(md);
                    if (pr) {
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
                    } else {
                        // not in processor stack
                        if (md.computedContent) {
                            error(`Computed content conflict: ${md.id}.${prop} can only be set by ${md.computedContent}`);
                            value = v;
                        }
                    }

                    if (v !== value) {
                        let lengthChange = false, dictSizeChange = false;
                        if (isArray(target)) {
                            // we need to notify length change as functions like Array.push won't explicitely do it
                            const len = target.length;
                            value = target[prop as any] = wrapPropObject(value, "" + prop, md);
                            lengthChange = target.length !== len;
                        } else {
                            value = target[prop] = wrapPropObject(value, "" + prop, md);

                            // Compute dictSize if object is used as a dictionary
                            const dictSize1 = md.dictSize;
                            if (v === undefined && dictSize1 !== undefined) {
                                const dictSize2 = Object.keys(target).length;
                                if (dictSize2 !== dictSize1) {
                                    md.dictSize = dictSize2;
                                    dictSizeChange = true;
                                }
                            }
                        }

                        logTraxEvent({ type: "!SET", objectId: md.id, propName: prop as string, fromValue: v, toValue: value });
                        if (typeof prop === "string") {
                            notifyPropChange(md, prop);
                        }
                        if (lengthChange) {
                            notifyPropChange(md, "length");
                        }
                        if (dictSizeChange) {
                            notifyPropChange(md, DICT_SIZE_PROP);
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
                const md = tmd(target);

                if (md && md.dictSize) {
                    // prop is in target so we can safely decrease dictSize
                    md.dictSize--;
                    notifyPropChange(md, DICT_SIZE_PROP);
                }
                delete target[prop];
                return true;
            }
            return false;
        }
    };

    /**
     * Auto-wrap a trax object property into a sub trax object
     */
    function wrapPropObject(v: any, propName: string, targetMd: TraxMd) {
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
                    v = getProxy(targetMd.id + ID_SEPARATOR2 + propName, v, targetMd.storeId, true);
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

    function getProxy(id: string, obj: any, storeId: string, generateNewId = false) {
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

        // create a new proxy
        let md: TraxMd;
        if (isArray(obj)) {
            // TODO
            md = attachMetaData(obj, id, TraxObjectType.Array, storeId);
        } else {
            md = attachMetaData(obj, id, TraxObjectType.Object, storeId);
        }
        logTraxEvent({ type: "!NEW", objectId: id, objectType: md.type });
        const prx = new Proxy(obj, proxyHandler);
        storeDataObject(id, prx);
        return prx;
    }

    return trx;

    function registerProcessorForReconciliation(pr: TraxInternalProcessor) {
        const prio = pr.priority;
        reconciliationList.insert((prev?: TraxInternalProcessor, next?: TraxInternalProcessor) => {
            if (!next || prio <= next.priority) {
                return pr;
            }
        });
    }

    function buildIdSuffix(id: TraxIdDef, storeId?: string) {
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

    function buildId(id: TraxIdDef, storeId: string, isProcessor: boolean) {
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
    function sanitizeComputedMd(md?: TraxMd, propName?: string) {
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

    function logTraxEvent(e: TraxEvent) {
        if (e.type === traxEvents.Error) {
            error("" + e.data);
        } else {
            log.event(e.type, e as any, privateEventKey);
        }
    }

    function startProcessingContext(event: TraxLogTraxProcessingCtxt): ProcessingContext {
        return log.startProcessingContext(event as any, privateEventKey);
    }

    function notifyPropChange(md: TraxMd, propName: string) {
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
            let objectType = TraxObjectType.NotATraxObject;
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
        idPrefix: TraxIdDef,
        parentStoreId: string,
        initFunctionOrRoot: Object | ((store: Store<T>) => R),
        onDispose?: (id: string) => void
    ): R extends void ? Store<T> : R & StoreWrapper {
        const storeId = buildStoreId(idPrefix, parentStoreId, true);
        let root: any;
        let initPhase = true;
        let disposed = false;
        const storeInit = startProcessingContext({ type: "!PCS", name: "!StoreInit", storeId: storeId });
        const initFunction = typeof initFunctionOrRoot === "function" ? initFunctionOrRoot : (store: Store<T>) => {
            store.init(initFunctionOrRoot as any);
        }
        /** Set of processor ids associated to this store */
        const storeProcessors = new Set<string>();
        /** Set of sub-store ids associated to this store */
        const storeSubStores = new Set<string>();

        const store: Store<T> = {
            get id() {
                return storeId;
            },
            get root() {
                // root should always be defined if initFunction is correctly implemented
                return root;
            },
            get disposed(): boolean {
                return disposed;
            },
            createStore<R, T extends Object>(
                id: TraxIdDef,
                initFunctionOrRoot: Object | ((store: Store<T>) => R)
            ): R extends void ? Store<T> : R & StoreWrapper {
                const st = createStore(id, storeId, initFunctionOrRoot, detachChildStore);
                storeSubStores.add(st.id);
                return st;
            },
            init(r: T) {
                if (initPhase) {
                    root = getOrAdd(ROOT, r, true);
                } else {
                    error(`(${storeId}) Store.init can only be called during the store init phase`);
                }
                return root;
            },
            add<T extends Object | Array<any>>(id: TraxIdDef, o: T): T {
                return getOrAdd(id, o, false);
            },
            get<T extends Object>(id: TraxIdDef): T | void {
                const sid = buildId(id, storeId, false);
                return getDataObject(sid) || undefined;
            },
            delete<T extends Object>(o: T): boolean {
                const md = tmd(o);
                let id = "";
                if (md) {
                    id = md.id;
                    if (md.type === TraxObjectType.Processor) {
                        error(`(${id}) Processors cannot be disposed through store.delete()`);
                    } else if (md.type === TraxObjectType.Store) {
                        error(`(${id}) Stores cannot be disposed through store.delete()`);
                    } else {
                        return removeDataObject(id);
                    }
                }
                return false;
            },
            compute(id: TraxIdDef, compute: TraxComputeFn, autoCompute?: boolean, isRenderer?: boolean): TraxProcessor {
                let pid = buildId(id, storeId, true);
                let pr = processors.get(pid);
                if (pr) {
                    return pr;
                }
                processorPriorityCounter++; // used for priorities
                processorCount++; // used to track potential memory leaks
                pr = createTraxProcessor(
                    pid,
                    processorPriorityCounter,
                    compute,
                    processorStack,
                    getDataObject,
                    logTraxEvent,
                    startProcessingContext,
                    detachChildProcessor,
                    autoCompute,
                    isRenderer
                );
                attachMetaData(pr, pid, TraxObjectType.Processor, storeId);
                processors.set(pid, pr);
                storeProcessors.add(pid);
                return pr;
            },
            getProcessor(id: TraxIdDef): TraxProcessor | undefined {
                const sid = buildId(id, storeId, true);
                return processors.get(sid) as any;
            },
            getStore<T>(id: TraxIdDef): Store<T> | void {
                const subStoreId = buildStoreId(id, storeId, false);
                return stores.get(subStoreId);
            },
            dispose(): boolean {
                return dispose();
            },
            async<F extends (...args: any[]) => Generator<Promise<any>, any, any>>(
                nameOrFn: string | F,
                fn?: F
            ): (...args: Parameters<F>) => Promise<any> {
                let name = "[ASYNC]";
                let func: F;
                if (typeof nameOrFn === "string") {
                    name = nameOrFn;
                    func = fn!;
                } else {
                    func = nameOrFn as F;
                }

                const f = wrapFunction(
                    func,
                    () => log.startProcessingContext({ name: storeId + "." + name + "()", storeId }),
                    (ex) => { error(`(${storeId}.${name}) error: ${ex}`) }
                );
                (f as any).updateAsyncName = (nm: string) => {
                    name = nm;
                }
                return f as any;
            }
        };
        // attach meta data
        attachMetaData(store, storeId, TraxObjectType.Store, "");
        logTraxEvent({ type: "!NEW", objectId: storeId, objectType: TraxObjectType.Store });

        // register store in parent
        stores.set(storeId, store);

        function dispose(): boolean {
            if (disposed) return false;
            stores.delete(storeId);
            disposed = true;

            // detach from parent store
            if (onDispose) {
                // onDispose is not provided for root stores
                onDispose(storeId);
            }

            // dispose root
            dataRefs.delete(trx.getTraxId(root));

            // dispose all sub-stores
            storeSubStores.forEach((stId) => {
                const st = stores.get(stId);
                if (st && !st.disposed) {
                    st.dispose();
                }
            });
            storeSubStores.clear();

            // dispose all sub-processors
            storeProcessors.forEach((processorId) => {
                const pr = processors.get(processorId);
                if (pr && !pr.disposed) {
                    pr.dispose();
                }
            });
            storeProcessors.clear();
            return true;
        }

        function detachChildStore(id: string) {
            storeSubStores.delete(id);
        }

        function detachChildProcessor(id: string) {
            const ok = processors.delete(id);
            if (ok) {
                processorCount--;
                storeProcessors.delete(id);
            }
        }

        function wrapStoreAPIs(obj: Object) {
            const o = obj as any;
            for (const name of Object.keys(o)) {
                if (typeof o[name] === "function") {
                    const fn = o[name];
                    if (typeof (fn as any).updateAsyncName === "function") {
                        // this function was already wrapped through store.async()
                        (fn as any).updateAsyncName(name);
                    } else {
                        o[name] = wrapFunction(
                            fn,
                            () => log.startProcessingContext({ name: storeId + "." + name + "()", storeId }),
                            (ex) => { error(`(${storeId}.${name}) error: ${ex}`) }
                        );
                    }
                }
            }
        }

        let r: R;
        try {
            r = initFunction(store);
            initPhase = false;
            if (r !== undefined) {
                if (r !== null && typeof r === "object") {
                    wrapStoreAPIs(r);
                } else {
                    error(`createStore init function must return a valid object (${storeId})`);
                    r = {} as R;
                }
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
                originalDispose.call(r); // already wrapped
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
                error(`(${storeId}) createStore init must define a root object - see also: init()`);
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

        function buildStoreId(idPrefix: TraxIdDef, parentStoreId: string, makeUnique = true) {
            let storeId = buildIdSuffix(idPrefix);
            if (parentStoreId !== "") {
                storeId = parentStoreId + ID_SUB_STORE_SEPARATOR + storeId;
            }
            let suffix = "";
            if (makeUnique) {
                let st = stores.get(storeId);
                let count = 0;
                while (st) {
                    suffix = "" + (++count);
                    st = st = stores.get(storeId + suffix);
                }
            }
            return storeId + suffix;
        }

        /**
         * Function behind store.add - support an extra argument to prevent ROOT id
         * @param id 
         * @param o 
         * @reeturns 
         */
        function getOrAdd<T extends Object>(id: TraxIdDef, o: T, acceptRootId: boolean): T {
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
                return getProxy(buildId(idSuffix, storeId, false), o, storeId);
            } else {
                return o as any;
            }
        }

    }
}




