import { createEventStream } from "./eventstream";
import { $Store, $StoreWrapper, $Trax, $TraxIdDef, traxEvents } from "./types";

/**
 * Create a trax environment
 */
export function createTraxEnv(): $Trax {
    const privateEventKey = {};
    const log = createEventStream(privateEventKey);
    let pendingChanges = false;
    const storeMap = new Map<string, $Store<any>>();

    const trx = {
        log,
        createStore<R>(
            idPrefix: $TraxIdDef,
            initFunction: (store: $Store<any>) => R
        ): R & $StoreWrapper {
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
        }
    }
    return trx;

    function error(msg: string) {
        trx.log.error('[trax] ' + msg);
    }

    function buildId(id: $TraxIdDef, storeId?: string) {
        let prefix = storeId ? storeId + "/" : "";
        return `${prefix}${Array.isArray(id) ? id.join(":") : id}`;
    }

    function createStore<R>(
        idPrefix: $TraxIdDef,
        initFunction: (store: $Store<any>) => R,
        storeMap: Map<string, $Store<any>>
    ): R & $StoreWrapper {
        let root: any;

        // find a unique id
        let id = buildId(idPrefix);
        let st = storeMap.get(id);
        let count = 0, suffix = "";
        while (st) {
            suffix = "" + (++count);
            st = st = storeMap.get(id + suffix);
        }
        id = id + suffix;

        const store: $Store<any> = {
            get id() {
                return id;
            },
            get root() {
                // root should always be defined if initFunction is correctly implemented
                return root;
            },
            getObject<T extends Object>(id: $TraxIdDef, initValue?: T): T {
                return {} as T;
            }
        }

        // register store in parent
        storeMap.set(id, store);

        function dispose() {
            // unregiser store in parent
            storeMap.delete(id);
        }

        let r: R;
        try {
            r = initFunction(store);
            if (r === null || r === undefined) {
                r = {} as R;
            } else if (typeof r !== "object") {
                error(`createStore init function must return a valid object (${id})`);
                r = {} as R;
            }
        } catch (ex) {
            error(`createStore init error (${id}): ${ex}`);
            r = {} as R;
        }

        // wrap existing dispose if any
        const res = r as any;
        if (typeof res.dispose === 'function') {
            const originalDispose = res.dispose;
            res.dispose = () => {
                try {
                    originalDispose.call(r);
                } catch (ex) {
                    error(`Store.dispose error (${id}): ${ex}`);
                }
                dispose();
            }
        } else res.dispose = dispose;
        // add id property
        if (res.id) {
            error(`Store id will be overridden and must not be provided by init function (${id})`);
        }
        res.id = id;
        return res;
    }
}


