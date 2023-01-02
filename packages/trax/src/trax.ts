
export interface $Store<T> {
    root: T;
    object<T extends Object>(id: string, defaultValue: T): T;
} 

// TODO: extendStore/createActions

// Create store function
export function createStore<R>(
    idPrefix: string,
    initFunction: (store: $Store<any>) => R): R & { dispose: () => void } {

    try {
        const store = new Store();
        const o = initFunction(store);
        (o as any).dispose = () => { };
        return o as any;
    } catch (ex) {
        console.error("[trax/createStore] Initialization error", ex);
    }

    return { dispose: () => { } } as any;
};

class Store<T> {
    root: T = {} as any;

    object<T extends Object>(id: string, defaultValue: T): T {
        return defaultValue;
    }
}
