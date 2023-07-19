// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetPreactEnv } from '..';
import { BasicList, ConditionalList, CptWithUseStoreArgs } from './basiclist';
import { render, fireEvent } from '@testing-library/preact';
import { trax, traxEvents } from '@traxjs/trax';

// workaround to remove react-dom/test-utils warnings
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Simple List', () => {
    let host: HTMLDivElement;

    function listHost(listIdx: number) {
        return host.querySelectorAll("div.basiclist")[listIdx] as HTMLDivElement;
    }

    function listItemLength(listIdx: number) {
        return listHost(listIdx).querySelectorAll("li")?.length;
    }

    function listItemText(listIdx: number, itemIdx: number) {
        return listHost(listIdx).querySelectorAll("li")[itemIdx].innerHTML.trim();
    }

    function listTotalText(listIdx: number) {
        return listHost(listIdx).querySelector(".total")?.innerHTML.trim();
    }

    function addItemButton(listIdx: number) {
        return listHost(listIdx).querySelector("button.addItem")!;
    }

    function clearListButton(listIdx: number) {
        return listHost(listIdx).querySelector("button.clearList")!;
    }

    async function renderComplete() {
        return trax.log.awaitEvent(traxEvents.ProcessingEnd, { isRenderer: true });
    }

    async function click(e: Element) {
        e && fireEvent.click(e);
        await renderComplete();
    }

    describe('Single Instance', () => {
        beforeEach(() => {
            resetPreactEnv();
            const container = render(<div>
                <BasicList />
            </div>);
            host = container.container as HTMLDivElement;
        });

        it('should load the list and add / clear items', async () => {
            expect(listHost(0).dataset.id).toBe("Preact%Test:BasicList:1");
            expect(listItemLength(0)).toBe(0);
            expect(listTotalText(0)).toBe("Total: 0");

            // add first item
            await click(addItemButton(0));
            expect(listItemLength(0)).toBe(1);
            expect(listTotalText(0)).toBe("Total: 1");
            expect(listItemText(0, 0)).toBe("Item #1");

            // add second item
            await click(addItemButton(0));
            expect(listItemLength(0)).toBe(2);
            expect(listTotalText(0)).toBe("Total: 2");
            expect(listItemText(0, 0)).toBe("Item #1");
            expect(listItemText(0, 1)).toBe("Item #2");

            // clear
            await click(clearListButton(0));
            expect(listItemLength(0)).toBe(0);
            expect(listTotalText(0)).toBe("Total: 0");

            // add again
            await click(addItemButton(0));
            expect(listItemLength(0)).toBe(1);
            expect(listTotalText(0)).toBe("Total: 1");
            expect(listItemText(0, 0)).toBe("Item #3");
        });
    });

    describe('Multi Instances', () => {
        beforeEach(() => {
            resetPreactEnv();
            host = document.createElement('div');
            const container = render(<div>
                <BasicList />
                <BasicList />
            </div>);
            host = container.container as HTMLDivElement;
        });

        it('should work independently', async () => {
            expect(listHost(0).dataset.id).toBe("Preact%Test:BasicList:1");
            expect(listItemLength(0)).toBe(0);
            expect(listTotalText(0)).toBe("Total: 0");
            expect(listHost(1).dataset.id).toBe("Preact%Test:BasicList:2");
            expect(listItemLength(1)).toBe(0);
            expect(listTotalText(1)).toBe("Total: 0");

            // add item in first list
            await click(addItemButton(0));
            expect(listItemLength(0)).toBe(1);
            expect(listTotalText(0)).toBe("Total: 1");
            expect(listItemText(0, 0)).toBe("Item #1");
            expect(listItemLength(1)).toBe(0);
            expect(listTotalText(1)).toBe("Total: 0");

            // add item in second list
            await click(addItemButton(1));
            expect(listItemLength(0)).toBe(1);
            expect(listTotalText(0)).toBe("Total: 1");
            expect(listItemText(0, 0)).toBe("Item #1");
            expect(listTotalText(1)).toBe("Total: 1");
            expect(listItemText(1, 0)).toBe("Item #1");
            expect(listTotalText(1)).toBe("Total: 1");

            // add second item in second list
            await click(addItemButton(1));
            expect(listItemLength(0)).toBe(1);
            expect(listTotalText(0)).toBe("Total: 1");
            expect(listItemText(0, 0)).toBe("Item #1");
            expect(listTotalText(1)).toBe("Total: 2");
            expect(listItemText(1, 0)).toBe("Item #1");
            expect(listItemText(1, 1)).toBe("Item #2");
            expect(listTotalText(1)).toBe("Total: 2");

            // clear items in 2nd list
            await click(clearListButton(1));
            expect(listItemLength(0)).toBe(1);
            expect(listTotalText(0)).toBe("Total: 1");
            expect(listItemText(0, 0)).toBe("Item #1");
            expect(listItemLength(1)).toBe(0);
            expect(listTotalText(1)).toBe("Total: 0");
        });
    });

    describe('UseStore', () => {
        it('should support multiple arguments', async () => {
            resetPreactEnv();
            const container = render(<div>
                <CptWithUseStoreArgs text="Hello World" />
            </div>);
            host = container.container as HTMLDivElement;

            const div = host.querySelector("div.cpt-with-useStore-args")! as HTMLDivElement;
            expect(div.innerHTML.trim()).toBe("Hello World/42");
        });
    });

    describe('Dispose', () => {
        it('should be called when the component is removed from the DOM', async () => {
            resetPreactEnv();
            const ctxtStore = trax.createStore("TestContext", {
                showList: true
            });
            const context = ctxtStore.data;

            const container = render(<div>
                <ConditionalList context={context} />
            </div>);
            host = container.container as HTMLDivElement;

            // Conditional List
            expect(listHost(0).dataset.id).toBe("Preact%Test:BasicList:1");
            expect(listItemLength(0)).toBe(0);
            expect(listTotalText(0)).toBe("Total: 0");
            const cptProcessor = trax.getProcessor("Preact%Test:BasicList:1")!;
            expect(cptProcessor.disposed).toBe(false);
            expect(cptProcessor.computeCount).toBe(1);

            // Add item
            await click(addItemButton(0));
            expect(listItemLength(0)).toBe(1);
            expect(listTotalText(0)).toBe("Total: 1");
            expect(listItemText(0, 0)).toBe("Item #1");
            expect(cptProcessor.disposed).toBe(false);
            expect(cptProcessor.computeCount).toBe(2);

            // Remove the list
            context.showList = false;
            await renderComplete();

            expect(listHost(0)).toBe(undefined);
            expect(cptProcessor.disposed).toBe(true);

            // Show again
            context.showList = true;
            await renderComplete();

            expect(listHost(0).dataset.id).toBe("Preact%Test:BasicList:2"); // new id as previous instance was disposed
            expect(listItemLength(0)).toBe(0);
            expect(listTotalText(0)).toBe("Total: 0");
            const cptProcessor2 = trax.getProcessor("Preact%Test:BasicList:2")!;
            expect(cptProcessor2.disposed).toBe(false);
            expect(cptProcessor2.computeCount).toBe(1);
            expect(cptProcessor).not.toBe(cptProcessor2);

            // Add item
            await click(addItemButton(0));
            expect(listItemLength(0)).toBe(1);
            expect(listTotalText(0)).toBe("Total: 1");
            expect(listItemText(0, 0)).toBe("Item #1");
            expect(cptProcessor2.disposed).toBe(false);
            expect(cptProcessor2.computeCount).toBe(2);
            expect(cptProcessor.disposed).toBe(true);
        });
    });
});

