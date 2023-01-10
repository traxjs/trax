import { createEventStream } from "./eventstream";
import { $Store, $StoreWrapper, $Trax, $TraxIdDef, $TraxProcessor, $TrxLogObjectLifeCycle, $TrxLogPropGet, $TrxLogPropSet, $TrxObjectType, $TrxLogProcessStart, traxEvents } from "./types";


export const traxMD = Symbol("trax.md");
const RX_INVALID_ID = /(\/)/g;

/**
 * Meta-data object attached to each trax object (object, array, dictionary, processor, store)
 */
interface $TraxMd {
    /** The trax unique id */
    id: string;
    /** The object type */
    type: $TrxObjectType;
    /**
     * Used by value objects (objects / array / dictionary) to track processors that have a dependency
     * on this object
     */
    // processors?: Set<$TraxProcessor>;
}

/**
 * Create a trax environment
 */
export function createTraxEnv(): $Trax {
    const privateEventKey = {};
    const log = createEventStream(privateEventKey);
    let pendingChanges = false;
    let dupeCount = 0; // counter used to de-dupe auto-generated ids
    /** Global map containing all stores */
    const storeMap = new Map<string, $Store<any>>();
    /** Global map containing weakrefs to all data */
    const dataRefs = new Map<string, WeakRef<any>>();
    const isArray = Array.isArray;

    const trx = {
        log,
        createStore<R, T extends Object>(
            idPrefix: $TraxIdDef,
            initFunction: (store: $Store<T>) => R
        ): R extends void ? $Store<T> : R & $StoreWrapper {
            return createStore(idPrefix, initFunction, storeMap);
        },
        get pendingChanges() {
            return pendingChanges;
        },
        processChanges(): void {

        },
        async cycleComplete(): Promise<void> {
            if (pendingChanges) {
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
        }
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

                v = target[prop];
                if (md) {
                    logTraxEvent({ type: "!GET", objectId: md.id, propName: prop as string, propValue: v });
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
                let isTargetCollection = false;

                if (md) {
                    // TODO
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

    return trx;


    function tmd(o: any): $TraxMd | undefined {
        return o ? o[traxMD] : undefined;
    }

    function error(msg: string) {
        trx.log.error('[trax] ' + msg);
    }

    function buildId(id: $TraxIdDef, storeId?: string) {
        let prefix = storeId ? storeId + "/" : "";
        let suffix = isArray(id) ? id.join(":") : id;
        if (suffix.match(RX_INVALID_ID)) {
            const newSuffix = suffix.replace(RX_INVALID_ID, "");
            error(`Invalid trax id: ${suffix} (changed into ${newSuffix})`);
            suffix = newSuffix;
        }
        return `${prefix}${suffix}`;
    }

    function logTraxEvent(e: $TrxLogObjectLifeCycle | $TrxLogPropGet | $TrxLogPropSet) {
        log.event(e.type, e as any, privateEventKey);
    }

    function createStore<R, T extends Object>(
        idPrefix: $TraxIdDef,
        initFunction: (store: $Store<T>) => R,
        storeMap: Map<string, $Store<any>>
    ): R extends void ? $Store<T> : R & $StoreWrapper {
        const storeId = buildStoreId();
        let root: any;
        let initPhase = true;
        let isDisposed = false;
        const storeInitData: $TrxLogProcessStart = { type: "!PCS", name: "StoreInit", id: storeId };
        const storeInit = log.startProcessingContext({ ...storeInitData });

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
                    root = this.get("root", r)
                } else {
                    error(`(${storeId}) Store.initRoot can only be called during the store init phase`);
                }
                return root;
            },
            get<T extends Object | undefined>(id: $TraxIdDef, o?: T): T extends void ? T | undefined : T {
                if (checkNotDisposed()) {
                    if (o !== undefined) {
                        if (o === null || typeof (o) !== "object") {
                            error(`(${storeId}) Store.get: Invalid init object parameter: ${o}`);
                            o = {} as T;
                        } else if (isArray(o)) {
                            console.log("TODO : call getArray() + warning")
                        }
                    }
                    return getProxy(buildId(id, storeId), o);
                } else {
                    return o as any;
                }
            }
        };
        // attach meta data
        attachMetaData(store, storeId, $TrxObjectType.Store);

        // register store in parent
        storeMap.set(storeId, store);

        function dispose() {
            // unregiser store in parent
            storeMap.delete(storeId);
            isDisposed = true;
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
                root = store.get("root", {});
            }
        }

        function checkNotDisposed() {
            if (isDisposed) {
                error(`(${storeId}) Stores cannot be used after being disposed`);
                return false;
            }
            return true;
        }

        function buildStoreId() {
            let storeId = buildId(idPrefix);
            let st = storeMap.get(storeId);
            let count = 0, suffix = "";
            while (st) {
                suffix = "" + (++count);
                st = st = storeMap.get(storeId + suffix);
            }
            return storeId + suffix;
        }

        /**
         * Create an attach meta data to a given object
         */
        function attachMetaData(o: Object, id: string, type: $TrxObjectType): $TraxMd {
            const md: $TraxMd = { id, type };
            (o as any)[traxMD] = md;
            return md;
        }

        /** 
         * Return objects, arrays or dictionaries 
         */
        function getDataObject(id: string) {
            const ref = dataRefs.get(id);
            if (ref) {
                return ref.deref() || null;
            }
            return null;
        }

        function storeDataObject(id: string, data: Object) {
            dataRefs.set(id, new WeakRef(data));
            // TODO: store object id in the store -> extract the store id from the id
        }

        function getProxy(id: string, obj?: any, generateNewId = false, lazyCreation = false) {
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
                        id = initId + "#" + dupeCount;
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
    }
}




