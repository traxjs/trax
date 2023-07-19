import { useEffect, useRef, useState } from 'preact/hooks';
import { createElement } from 'preact';
import { trax, TraxProcessor } from '@traxjs/trax';

interface TraxReactCptCtxt {
    id?: string;
    props: any;
    processor?: TraxProcessor;
    jsx: JSX.Element;
}

const REACT_STORE_ID = "Preact";

const creationCounts: Map<NamedCurve, number> = new Map();

/** Global counter used to trigger dirty state in react components */
let CHANGE_COUNT = 0;

function buildProcessorId(name: string, instanceCount: number) {
    return name + ":" + instanceCount;
}

function createPreactStore() {
    const rs = trax.getStore(REACT_STORE_ID);
    return rs || trax.createStore<{}>(REACT_STORE_ID, {});
}

/** React store: gathers all react processors in the same store */
let reactStore = createPreactStore();

function addProcessor(name: string, reactFunctionCpt: (prop?: any) => JSX.Element, cc: TraxReactCptCtxt, setRefreshCount: (c: number) => void) {
    cc.jsx = "" as any;
    let instanceCount = creationCounts.get(name);
    if (instanceCount === undefined) {
        instanceCount = 1;
    } else {
        instanceCount++;
    }
    creationCounts.set(name, instanceCount);

    const id = buildProcessorId(name, instanceCount);
    cc.id = id;

    const pr = reactStore.compute(id, () => {
        try {
            cc.jsx = reactFunctionCpt(cc.props);
        } catch (ex) {
            trax.log.error(`[@traxjs/trax-preact] Processing Error: ${ex}`);
        }
    }, false, true);
    pr.onDirty = () => {
        // onDirty is synchronous
        // mark react component as dirty
        queueMicrotask(() => setRefreshCount(++CHANGE_COUNT));
    };
    cc.processor = pr;
}

/**
 * Wrap a react function component into a trax processor
 * Note: the functional component will be then considered as a pure function and
 * will only be re-rendered if
 * - one of its trax dependencies changed (these dependencies can be passed by any means,
 * e.g. props, contexts or even global variables)
 * - a property reference changes (i.e. new reference for objects)
 * @param name the compontent name - usually the same as the component function
 * @param reactFunctionCpt the functional component
 * @returns
 */
export function component<T>(name: string, reactFunctionCpt: (props: T) => JSX.Element): (props: T) => JSX.Element {
    // Make the component pure (React.memo) to avoid re-processing if prop reference didn't change
    function fc(props: T) {
        // Use an internal state variable to trigger refresh
        const [$$traxRefreshCount, $$setTraxRefreshCount] = useState(0);
        let c: React.MutableRefObject<TraxReactCptCtxt> = useRef({} as any);
        const cc = c.current;
        if (!cc.processor) {
            addProcessor(name, reactFunctionCpt, cc, $$setTraxRefreshCount);
        }
        useEffect(() => {
            // processor cleanup
            return function cleanup() {
                if (cc.processor) {
                    cc.processor.dispose();
                    cc.processor = undefined;
                }
            };
        }, [cc]);
        cc.props = props;
        // compute must be forced as this function is called when component props have changed
        cc.processor!.compute(true);
        return cc.jsx;
    }

    // use a dynamic function to keep the component name (will show in react dev tools)
    const fcName = name.replace(/\:/g, "_");
    const func = new Function("fc", `return function ${fcName}(props){ return fc(props) }`);
    return memo(func(fc)) as any;
}

/**
 * Get the trax identifier associated to a trax object
 * Shortcut to trax.getTraxId(...)
 * @param o
 * @returns
 */
export function traxId(o: any) {
    return trax.getTraxId(o);
}

/**
 * Return the id of the trax processor associated to a react component
 * when called in in the component render function
 * Useful to insert the component id in the component HTML
 * (e.g. through the data-id attribute)
 */
export function componentId(): string {
    return trax.getActiveProcessor()?.id || "";
}

/**
 * Reset the internal React data to restart from a blank state
 * (Test environment only)
 */
export function resetPreactEnv() {
    creationCounts.clear();
    reactStore.dispose();
    reactStore = createPreactStore();
}

/**
 * Helper function to create or retrieve a store instance
 * attached to the caller component
 * @param factory a factory function to create the store instance
 * @returns the store object
 */
export function useStore<T = any>(factory: (...args: any[]) => T, ...args: any[]): T {
    const ref = (useRef({})).current as any;
    let store: T = ref.store;
    if (!store) {
        // create it
        ref.store = store = factory(...args);
    }
    if (typeof (store as any).dispose === "function") {
        useEffect(() => {
            return () => {
                (store as any)?.dispose!();
            }
        }, [store]);
    }
    return store;
}

/**
 * Create a trax state object to hold state values associated to a component.
 * Note: this function should only be called once in a given component as multiple state
 * values can be set in a given state object
 * @param state the default state value
 * @returns the current state value
 */
export function useTraxState<T extends Object>(state: T): T {
    const store = useStore(() => {
        const name = "State[" + componentId().replace(/(^[^\/\%]+(\/|\%))|(%)/g, "") + "]";
        return trax.createStore(name, state);
    });
    return store.data as T;
}

/**
 * Memoize a component, so that it only updates when the props actually have
 * changed. This was previously known as `React.pure`.
 * Imported from preact source code to avoid any dependency to preact/compat
 */
function memo(c: React.FunctionComponent, comparer?: (prev: object, next: object) => boolean): React.FunctionComponent {
    // extracted from https://github.com/preactjs/preact/blob/master/compat/src/memo.js
    function shouldUpdate(this: any, nextProps: any) {
        let ref = this.props.ref;
        let updateRef = (ref === nextProps.ref);
        if (!updateRef && ref) {
            ref.call ? ref(null) : (ref.current = null);
        }

        if (!comparer) {
            return shallowDiffers(this.props, nextProps);
        }

        return !comparer(this.props, nextProps) || !updateRef;
    }

    function Memoed(this: any, props: any) {
        this.shouldComponentUpdate = shouldUpdate;
        return createElement(c, props);
    }
    Memoed.displayName = 'Memo(' + (c.displayName || c.name) + ')';
    Memoed.prototype.isReactComponent = true;
    Memoed._forwarded = true;
    return Memoed;
}

/**
 * Check if two objects have a different shape
 */
export function shallowDiffers(a: Object, b: Object): boolean {
    // extracted from https://github.com/preactjs/preact/blob/master/compat/src/util.js
    for (let i in a) if (i !== '__source' && !(i in b)) return true;
    for (let i in b) if (i !== '__source' && (a as any)[i] !== (b as any)[i]) return true;
    return false;
}

