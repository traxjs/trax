import React from 'react';
import { component, componentId, traxId, useStore } from "..";
import { createListStore } from './liststore';

/**
 * Basic list that creates its own store
 */
export const BasicList = component("Test:BasicList", () => {
    const ls = useStore(createListStore);
    const data = ls.data, items = data.items;

    return <div className="basiclist" data-id={componentId()}>
        <h1> Basic List </h1>
        <header>
            <button className='addItem' onClick={ls.addItem}>Add Item</button>&nbsp;
            <button className='clearList' onClick={ls.clear}>Clear List</button>
        </header>
        <ul>
            {items.length === 0 ? "[Empty List]" :
                items.map((item) => <li key={traxId(item)}>
                    {item.description}
                </li>)
            }
        </ul>
        <footer>
            <div className='total'>Total: {items.length}</div>
        </footer>
    </div>
});


/**
 * Basic list embedded in a conditional statement
 * to validate that it gets properly disposed
 */
export const ConditionalList = component("Test:ConditionalList", (props: { context: { showList: boolean } }) => {
    const { context } = props;
    return <div className='conditionalList'>
        {context.showList ? <BasicList /> : ""}
    </div>
});

