import React from 'react';
import { component, traxId } from '../index';
import { ListStore, ListItem } from './liststore';

export const SimpleList = component("SimpleList", (props: { list: ListStore }) => {
    const { list } = props;
    const data = list.data;
    const items = data.items

    return <div className="simplelist">
        <h1> Simple List </h1>
        <header>
            <button onClick={list.addItem}>Add Item</button> <button onClick={list.clear}>Clear List</button>
        </header>
        <ul>
            {items.length ?
                items.map((item) => <ListItem key={traxId(item)} item={item} list={list} />)
                : "[Empty List]"}
        </ul>
        <footer>
            <div>Urgent: {data.nbrOfUrgentItems}</div>
            <div>Total: {items.length}</div>
        </footer>
    </div>
});

const ListItem = component("ListItem", (props: { item: ListItem, list: ListStore }) => {
    const { item, list } = props;

    return <li className="listItem" data-id={traxId(item)}>
        {item.description} {item.urgent ? " (urgent) " : " "}
        <button onClick={removeItem} title="Delete Item"> x </button>
    </li>

    function removeItem() {
        list.removeItem(item)
    }
});

