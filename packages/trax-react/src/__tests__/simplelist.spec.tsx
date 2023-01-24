// @vitest-environment jsdom
import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { createListStore, ListStore } from './liststore';
import { SimpleList } from './simplelist';
import { act, Simulate } from 'react-dom/test-utils';
import { resetReactEnv } from '..';

// workaround to remove react-dom/test-utils warnings
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Simple List', () => {
    let host: HTMLDivElement, listStore: ListStore;

    beforeEach(() => {
        resetReactEnv();
        listStore = createListStore();
        host = document.createElement('div');
        act(() => {
            const root = ReactDOM.createRoot(host);
            root.render(<SimpleList list={listStore} />);
        });
    });

    function listUL() {
        return host.querySelector("div.simplelist ul")!;
    }

    function listLength() {
        return host.querySelectorAll("div.simplelist ul li")?.length || 0;
    }

    function listItem(idx: number) {
        return (listUL()?.childNodes[idx] as HTMLLIElement);
    }

    function listItemText(idx: number) {
        return listItem(idx).querySelector(".text")?.innerHTML.trim();
    }

    function listItemDelButton(idx: number) {
        return (listUL()?.childNodes[idx] as HTMLLIElement).querySelector("button.del")!;
    }

    function addItemButton() {
        return host.querySelector("div.simplelist button.addItem")!;
    }

    function clearListButton() {
        return host.querySelector("div.simplelist button.clearList")!;
    }

    function listTotal() {
        return host.querySelector("div.simplelist .total")!.innerHTML;
    }

    function listUrgent() {
        return host.querySelector("div.simplelist .urgent")!.innerHTML;
    }

    async function pause(timeMs = 10) {
        return new Promise((resolve) => {
            setTimeout(resolve, timeMs);
        });
    }

    async function click(e: Element) {
        await act(async () => {
            Simulate.click(e);
            await pause(1); // TODO change with proper event-based solution
        });
    }

    it('should load the list', async () => {
        const ls = host.querySelectorAll("div.simplelist");
        expect(ls.length).toBe(1);
        expect((ls[0] as HTMLDivElement)!.dataset.id).toBe("React/%FC:Test:SimpleList:1");
        expect(listUL().innerHTML).toBe("[Empty List]");
        expect(addItemButton().innerHTML).toBe("Add Item");
        expect(clearListButton().innerHTML).toBe("Clear List");
        expect(listTotal()).toBe("Total: 0");
        expect(listUrgent()).toBe("Urgent: 0");
    });

    it('should support adding items and clear all', async () => {
        expect(listLength()).toBe(0);

        // First Add
        await click(addItemButton());
        expect(listLength()).toBe(1);
        expect(listItemText(0)).toBe("Item #1  (urgent)");
        expect(listItem(0).dataset.id).toBe("React/%FC:Test:ListItem:1");
        expect(listTotal()).toBe("Total: 1");
        expect(listUrgent()).toBe("Urgent: 1");

        // Second Add
        await click(addItemButton());
        expect(listLength()).toBe(2);
        expect(listItemText(1)).toBe("Item #2");
        expect(listItem(1).dataset.id).toBe("React/%FC:Test:ListItem:2");
        expect(listTotal()).toBe("Total: 2");
        expect(listUrgent()).toBe("Urgent: 1");

        // Third Add
        await click(addItemButton());
        expect(listLength()).toBe(3);
        expect(listItem(2).dataset.id).toBe("React/%FC:Test:ListItem:3");
        expect(listItemText(2)).toBe("Item #3");
        expect(listTotal()).toBe("Total: 3");
        expect(listUrgent()).toBe("Urgent: 1");

        // Fourth Add
        await click(addItemButton());
        expect(listLength()).toBe(4);
        expect(listItem(3).dataset.id).toBe("React/%FC:Test:ListItem:4");
        expect(listItemText(3)).toBe("Item #4  (urgent)");
        expect(listTotal()).toBe("Total: 4");
        expect(listUrgent()).toBe("Urgent: 2");

        // clear All
        await click(clearListButton());
        expect(listLength()).toBe(0);
        expect(listTotal()).toBe("Total: 0");
        expect(listUrgent()).toBe("Urgent: 0");
    });

    it('should support removing items', async () => {
        expect(listLength()).toBe(0);

        // Add 2 items
        await click(addItemButton());
        await click(addItemButton());
        expect(listItem(0).dataset.id).toBe("React/%FC:Test:ListItem:1"); // 1 because resetSuffixes() was called
        expect(listLength()).toBe(2);
        expect(listTotal()).toBe("Total: 2");
        expect(listUrgent()).toBe("Urgent: 1");

        // Delete first item (urgent)
        await click(listItemDelButton(0));
        expect(listLength()).toBe(1);
        expect(listTotal()).toBe("Total: 1");
        expect(listUrgent()).toBe("Urgent: 0");

        // Delete second item (now first)
        await click(listItemDelButton(0));
        expect(listLength()).toBe(0);
        expect(listTotal()).toBe("Total: 0");
        expect(listUrgent()).toBe("Urgent: 0");
    });
});
