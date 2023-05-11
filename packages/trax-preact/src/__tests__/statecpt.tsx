import React from 'react';
import { component, traxId } from "..";
import { useTraxState } from '..';

export const StateCpt = component("StateCpt", () => {
    const state1 = useTraxState({
        count1: 42,
        count2: 1984
    });
    const state2 = useTraxState({
        count: 123
    });

    return <div className="statecpt">
        <span className='value' onClick={() => state1.count1++}>{state1.count1}</span>
        <span className='value' onClick={() => state1.count2++}>{state1.count2}</span>
        <span className='value' onClick={() => state2.count++}>{state2.count}</span>
        <span className='value' >{traxId(state1)}</span>
        <span className='value' >{traxId(state2)}</span>
    </div>
});

