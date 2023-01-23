import React, { useEffect, useRef, useState } from 'react';
import { trax, TraxProcessor } from '@traxjs/trax';

interface TraxReactCptCtxt {
    id?: string;
    props: any;
    processor?: TraxProcessor;
    jsx: JSX.Element;
}

/** Global counter used to trigger dirty state in react components */
let CHANGE_COUNT = 0;

/** React store: gathers all react processors in the same store */
const reactStore = trax.createStore("ReactStore", {
    count: 0
});
const cptCounter = reactStore.root;

/**
 * Wrap a react functional component into a trax processor
 * Note: the functional component will be then considered as a pure function and 
 * will only be re-rendered if
 * - one of its trax dependencies changed (these dependencies can be passed by any means, 
 * e.g. props, contexts or even global variables)
 * - a property reference changes (i.e. new reference for objects)
 * @param name the compontent name - usually the same as the component function
 * @param reactFunctionalCpt the functional component
 * @returns 
 */
export function component(name: string, reactFunctionalCpt: (prop?: any) => JSX.Element) {
    // Make the component pure (React.memo) to avoid re-processing if prop reference didn't change
    return React.memo(function (props?: any) {
        // Use an internal state variable to trigger refresh
        const [$$traxRefreshCount, $$setTraxRefreshCount] = useState(0);
        let c: React.MutableRefObject<TraxReactCptCtxt> = useRef({} as any);
        const cc = c.current;
        if (!cc.processor) {
            cc.jsx = "" as any;
            cptCounter.count++;
            const id = "ReactCpt:" + name + ":" + cptCounter.count;
            cc.id = id;
            const p = reactStore.compute(id, () => {
                try {
                    cc.jsx = reactFunctionalCpt(cc.props);
                } catch (ex) {
                    console.error("[@traxjs/trax-react] Processing Error:", ex);
                    throw ex;
                }
            }, false, true);
            p.onDirty = () => {
                // onDirty is synchronous
                // mark react component as dirty
                queueMicrotask(() => $$setTraxRefreshCount(++CHANGE_COUNT));
            };
            cc.processor = p;
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
        cc.processor.compute();
        return cc.jsx;
    });
}

export function traxId(o: any) {
    return trax.getTraxId(o);
}
