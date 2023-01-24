import React, { useEffect, useRef, useState } from 'react';
import { Store, trax, TraxProcessor } from '@traxjs/trax';

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
 * Wrap a react functional component into a trax processor
 * Note: the functional component will be then considered as a pure function and 
 * will only be re-rendered if
 * - one of its trax dependencies changed (these dependencies can be passed by any means, 
 * e.g. props, contexts or even global variables)
 * - a property reference changes (i.e. new reference for objects)
 * @param name the compontent name - usually the same as the component function
 * @param reactFunctionCpt the functional component
 * @returns 
 */
export function component(name: string, reactFunctionCpt: (prop?: any) => JSX.Element) {
    // Make the component pure (React.memo) to avoid re-processing if prop reference didn't change
    return React.memo(function (props?: any) {
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
    });
}

/**
 * Get the trax identifier associated to a trax object
 * @param o 
 * @returns 
 */
export function traxId(o: any) {
    return trax.getTraxId(o);
}

/**
 * Return the id of the trax processor assiated to a react component
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
