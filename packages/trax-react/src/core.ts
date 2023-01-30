import React, { useEffect, useRef, useState } from 'react';
import { Store, trax, TraxProcessor } from '@traxjs/trax';
import { StoreWrapper, traxEvents } from '@traxjs/trax/lib/types';

interface TraxReactCptCtxt {
    id?: string;
    props: any;
    processor?: TraxProcessor;
    jsx: JSX.Element;
}

interface ReactData {
    creationCounts: { [cptName: string]: number }
}

/** Global counter used to trigger dirty state in react components */
let CHANGE_COUNT = 0;

function buildProcessorId(name: string, instanceCount: number) {
    return "FC:" + name + ":" + instanceCount;
}

function createReactStore() {
    return trax.createStore("React", (store: Store<ReactData>) => {
        const root = store.init({
            creationCounts: {}
        });
        const creationCounts = root.creationCounts;
        return {
            addProcessor(name: string, reactFunctionCpt: (prop?: any) => JSX.Element, cc: TraxReactCptCtxt, setRefreshCount: (c: number) => void) {
                cc.jsx = "" as any;
                let instanceCount = 1;
                if (!creationCounts[name]) {
                    creationCounts[name] = 1;
                } else {
                    instanceCount = ++creationCounts[name];
                }
                // FC: Function Component
                const id = buildProcessorId(name, instanceCount);
                cc.id = id;

                const pr = store.compute(id, () => {
                    try {
                        cc.jsx = reactFunctionCpt(cc.props);
                    } catch (ex) {
                        trax.log.error(`[@traxjs/trax-react] Processing Error: ${ex}`);
                    }
                }, false, true);
                pr.onDirty = () => {
                    // onDirty is synchronous
                    // mark react component as dirty
                    queueMicrotask(() => setRefreshCount(++CHANGE_COUNT));
                };
                cc.processor = pr;
            }
        }
    });
}

/** React store: gathers all react processors in the same store */
let reactStore = createReactStore();

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
            reactStore.addProcessor(name, reactFunctionCpt, cc, $$setTraxRefreshCount);
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
        cc.processor!.compute();
        return cc.jsx;
    }

    // use a dynamic function to keep the component name (will show in react dev tools)
    const fcName = name.replace(/\:/g, "_");
    const func = new Function("fc", `return function ${fcName}(props){ return fc(props) }`);
    return React.memo(func(fc)) as any;
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
export function resetReactEnv() {
    reactStore.dispose()
    reactStore = createReactStore();
}

/**
 * Helper function to create or retrieve a store instance
 * attached to the caller component
 * @param factory a factory function to create the store instance
 * @returns the store object
 */
export function useStore<T = any>(factory: () => T): T {
    const ref = (useRef({})).current as any;
    let store: T = ref.store;
    if (!store) {
        // create it
        ref.store = store = factory();
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
        const name = "State[" + componentId().replace(/(^[^\/]+\/)|(%)/g, "") + "]";
        return trax.createStore(name, state);
    });
    return store.root as T;
}
