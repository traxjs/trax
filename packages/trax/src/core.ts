import { createEventStream } from "./eventstream";
import { $Store, $Trax, $TraxIdDef, traxEvents } from "./types";

/**
 * Create a trax environment
 */
export function createTraxEnv(): $Trax {
    const privateEventKey = {};
    const log = createEventStream(privateEventKey);
    let pendingChanges = false;

    const trx = {
        log,
        createStore<R extends Object & { dispose?: () => void }>(
            idPrefix: $TraxIdDef,
            initFunction: (store: $Store<any>) => R
        ): R & { dispose: () => void } {
            return createStore(initFunction);
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

    function createStore<R>(initFunction: (store: $Store<any>) => R): R & { dispose: () => void } {
        let root: any;

        const store: $Store<any> = {
            get root() {
                // root should always be defined if initFunction is correctly implemented
                return root;
            },
            getObject<T extends Object>(id: $TraxIdDef, initValue?: T): T {
                return {} as T;
            }
        }

        // TODO register store in parent

        let r: R;
        try {
            r = initFunction(store);
            if (r === null || r === undefined) {
                r = {} as R;
            } else if (typeof r !== "object") {
                // TODO error
                r = {} as R;
            }
        } catch (ex) {
            // TODO error
            r = {} as R;
        }
        // TODO: wrap existing dispose if any
        (r as any).dispose = () => {
            // TODO
        }
        return r as R & { dispose: () => void };
    }
}


