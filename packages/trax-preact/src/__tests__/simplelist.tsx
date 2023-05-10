import React from 'react';
import { component, componentId, traxId } from '..';
import { ListStore, ListItem } from './liststore';

/**
 * Simple list that uses a store passed as a prop
 */
export const SimpleList = component("Test:SimpleList", (props: { list: ListStore }) => {
    const { list } = props;
    const data = list.data;
    const items = data.items

    return <div className="simplelist" data-id={componentId()}>
        <h1> Simple List </h1>
        <header>
            <button className='addItem' onClick={list.addItem}>Add Item</button>&nbsp;
            <button className='clearList' onClick={list.clear}>Clear List</button>
        </header>
        <ul>
            {items.length ?
                items.map((item) => <LsItem key={traxId(item)} item={item} list={list} />)
                : "[Empty List]"}
        </ul>
        <footer>
            <div className='urgent'>Urgent: {data.nbrOfUrgentItems}</div>
            <div className='total'>Total: {items.length}</div>
        </footer>
    </div>
});

const LsItem = component("Test:ListItem", (props: { item: ListItem, list: ListStore }) => {
    const { item, list } = props;

    return <li className='listItem' data-id={componentId()}>
        <span className='text'>{item.description} {item.urgent ? " (urgent) " : " "}</span>
        <button className='del' onClick={removeItem} title="Delete Item"> x </button>
    </li>

    function removeItem() {
        list.removeItem(item)
    }
});

