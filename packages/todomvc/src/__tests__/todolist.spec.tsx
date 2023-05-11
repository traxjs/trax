import { beforeEach, describe, expect, it } from 'vitest';
import { resetReactEnv } from "@traxjs/trax-react";
import { render, fireEvent, RenderResult } from '@testing-library/preact';
import userEvent from '@testing-library/user-event'
import { TodoList } from '../todolist';
import { trax, traxEvents } from '@traxjs/trax';
import React from 'react';

describe('TodoList', () => {
    let container: RenderResult;

    beforeEach(() => {
        resetReactEnv();
        container = render(<div>
            <TodoList />
        </div>);
    });

    async function renderComplete() {
        return trax.log.awaitEvent(traxEvents.ProcessingEnd, { isRenderer: true });
    }

    function todoList() {
        return container.container.querySelector("div.todoList")! as HTMLDivElement;
    }

    function mainInput() {
        return todoList()?.querySelector("input.new-todo")! as HTMLInputElement;
    }

    function todoItems() {
        return todoList()?.querySelector("ul.todo-list")! as HTMLUListElement;
    }

    function todoItem(idx: number) {
        return (todoItems()?.querySelectorAll("li")[idx]) as HTMLLIElement;
    }

    function deleteItem(idx: number) {
        const e = todoItem(idx)?.querySelector(".destroy");
        e && fireEvent.click(e);
    }

    function toggleItem(idx: number) {
        const e = todoItem(idx)?.querySelector(".toggle");
        e && fireEvent.click(e);
    }

    function todoItemsLength() {
        const ul = todoItems();
        return ul ? ul.childNodes.length : 0;
    }

    function toggleAllInput() {
        return todoList().querySelector("input.toggle-all");
    }

    function toggleAll() {
        const e = toggleAllInput();
        e && fireEvent.click(e);
    }

    function clearCompletedBtn() {
        return todoList().querySelector("button.clear-completed");
    }

    function clearCompleted() {
        const e = clearCompletedBtn();
        e && fireEvent.click(e);
    }

    function typeEnterInMainInput() {
        fireEvent.keyUp(mainInput(), { key: "Enter" });
    }

    function filterBtn(idx: number) {
        return todoList().querySelectorAll("ul.filters li")[idx] as HTMLLIElement;
    }

    function clickFilter(type: "ALL" | "ACTIVE" | "COMPLETED") {
        const idx = ["ALL", "ACTIVE", "COMPLETED"].indexOf(type);
        const e = filterBtn(idx)?.querySelector("a");
        e && fireEvent.click(e);
    }

    async function editTodo(idx: number) {
        const lbl = todoItem(idx).querySelector("label")!;
        lbl && fireEvent.dblClick(lbl);
        await renderComplete();
    }

    function inputEdit(idx: number) {
        return todoItem(idx).querySelector("input.edit")! as HTMLInputElement;
    }

    async function typeEditValue(idx: number, text: string, reset = false) {
        const input = inputEdit(idx);
        if (reset) {
            input.value = "";
        }
        await userEvent.type(input, text);
    }

    function printTodos() {
        // extract data from the DOM and print them as text
        const res: string[] = [];
        let input = mainInput();
        input && res.push(`Main Input: '${input.value}'`);
        let ul = todoItems();
        if (ul) {
            ul.childNodes.forEach((e) => {
                const li: HTMLLIElement = e as any;
                const text = li.querySelector("label")?.innerHTML.trim();
                const checked = (li.querySelector(".toggle") as any)?.checked;

                let editData = "";
                const editInput = li.querySelector("input.edit")! as HTMLInputElement;
                if (editInput) {
                    editData = ` [EDIT:${editInput.value}]`;
                }
                res.push(`- ${text}${checked ? " ✅" : ""}${editData}`);
            })
        } else {
            res.push(`[Empty List]`);
        }
        const count = todoList().querySelector("span.todo-count") as HTMLSpanElement;
        count && res.push(`Count: ${count.innerHTML.replace(/\<\/?strong\>/g, "").trim()}`);
        const ccb = clearCompletedBtn();
        ccb && res.push(`Clear Completed: visible`);
        const tai = toggleAllInput();
        tai && res.push(`Toggle All: visible`);

        // Filters
        todoList().querySelectorAll("ul.filters a.selected").forEach(e => {
            res.push(`Filter: ${e.innerHTML.trim()}`);
        });
        return res;
    }

    async function initItems(insertCompleted = true) {
        await userEvent.type(mainInput(), "AAA");
        typeEnterInMainInput();
        await renderComplete();
        await userEvent.type(mainInput(), "BBB");
        typeEnterInMainInput();
        await renderComplete();
        await userEvent.type(mainInput(), "CCC");
        typeEnterInMainInput();
        await renderComplete();
        if (insertCompleted) {
            toggleItem(1);
            await renderComplete();
        }
    }

    it('should load properly', async () => {
        expect(todoList().dataset.id).toBe("Preact%TodoList:1");
        expect(mainInput().value).toBe("");
        expect(todoItemsLength()).toBe(0);
    });

    it('should create and delete todos', async () => {
        await userEvent.type(mainInput(), "First");
        expect(printTodos()).toMatchObject([
            "Main Input: 'First'",
            "[Empty List]",
        ]);

        typeEnterInMainInput();
        await renderComplete();
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- First",
            "Count: 1  item left",
            "Toggle All: visible",
            "Filter: All",
        ]);

        await userEvent.type(mainInput(), "Second");
        typeEnterInMainInput();
        await renderComplete();

        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- First",
            "- Second",
            "Count: 2  items left",
            "Toggle All: visible",
            "Filter: All",
        ]);

        deleteItem(0);
        await renderComplete();

        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- Second",
            "Count: 1  item left",
            "Toggle All: visible",
            "Filter: All",
        ]);

        await userEvent.type(mainInput(), "Third");
        typeEnterInMainInput();
        await renderComplete();

        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- Second",
            "- Third",
            "Count: 2  items left",
            "Toggle All: visible",
            "Filter: All",
        ]);

        deleteItem(1);
        await renderComplete();

        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- Second",
            "Count: 1  item left",
            "Toggle All: visible",
            "Filter: All",
        ]);

        deleteItem(0);
        await renderComplete();

        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "[Empty List]",
        ]);
    });

    it('should mark items checked', async () => {
        await initItems(false);
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- AAA",
            "- BBB",
            "- CCC",
            "Count: 3  items left",
            "Toggle All: visible",
            "Filter: All",
        ]);

        toggleItem(1);
        await renderComplete();
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- AAA",
            "- BBB ✅",
            "- CCC",
            "Count: 2  items left",
            "Clear Completed: visible",
            "Toggle All: visible",
            "Filter: All",
        ]);

        toggleItem(2);
        await renderComplete();
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- AAA",
            "- BBB ✅",
            "- CCC ✅",
            "Count: 1  item left",
            "Clear Completed: visible",
            "Toggle All: visible",
            "Filter: All",
        ]);

        toggleItem(0);
        await renderComplete();
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- AAA ✅",
            "- BBB ✅",
            "- CCC ✅",
            "Count: 0  items left",
            "Clear Completed: visible",
            "Toggle All: visible",
            "Filter: All",
        ]);

        toggleItem(1);
        await renderComplete();
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- AAA ✅",
            "- BBB",
            "- CCC ✅",
            "Count: 1  item left",
            "Clear Completed: visible",
            "Toggle All: visible",
            "Filter: All",
        ]);
    });

    it('should support clear completed', async () => {
        await initItems();
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- AAA",
            "- BBB ✅",
            "- CCC",
            "Count: 2  items left",
            "Clear Completed: visible",
            "Toggle All: visible",
            "Filter: All",
        ]);

        clearCompleted();
        await renderComplete();
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- AAA",
            "- CCC",
            "Count: 2  items left",
            "Toggle All: visible",
            "Filter: All",
        ]);
    });

    it('should support toggle all', async () => {
        await initItems();
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- AAA",
            "- BBB ✅",
            "- CCC",
            "Count: 2  items left",
            "Clear Completed: visible",
            "Toggle All: visible",
            "Filter: All",
        ]);

        toggleAll();;
        await renderComplete();
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- AAA",
            "- BBB",
            "- CCC",
            "Count: 3  items left",
            "Toggle All: visible",
            "Filter: All",
        ]);

        toggleAll();;
        await renderComplete();
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- AAA ✅",
            "- BBB ✅",
            "- CCC ✅",
            "Count: 0  items left",
            "Clear Completed: visible",
            "Toggle All: visible",
            "Filter: All",
        ]);

        toggleAll();;
        await renderComplete();
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- AAA",
            "- BBB",
            "- CCC",
            "Count: 3  items left",
            "Toggle All: visible",
            "Filter: All",
        ]);
    });

    it('should support filter change', async () => {
        await initItems();
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- AAA",
            "- BBB ✅",
            "- CCC",
            "Count: 2  items left",
            "Clear Completed: visible",
            "Toggle All: visible",
            "Filter: All",
        ]);

        clickFilter("ACTIVE");
        await renderComplete();
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- AAA",
            "- CCC",
            "Count: 2  items left",
            "Clear Completed: visible",
            "Toggle All: visible",
            "Filter: Active",
        ]);

        clickFilter("COMPLETED");
        await renderComplete();
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- BBB ✅",
            "Count: 2  items left",
            "Clear Completed: visible",
            "Toggle All: visible",
            "Filter: Completed",
        ]);

        clickFilter("ALL");
        await renderComplete();
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- AAA",
            "- BBB ✅",
            "- CCC",
            "Count: 2  items left",
            "Clear Completed: visible",
            "Toggle All: visible",
            "Filter: All",
        ]);
    });

    it('should support todo edit', async () => {
        await initItems();

        await editTodo(1);

        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- AAA",
            "- BBB ✅ [EDIT:BBB]",
            "- CCC",
            "Count: 2  items left",
            "Clear Completed: visible",
            "Toggle All: visible",
            "Filter: All",
        ]);

        await typeEditValue(1, "DDD");
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- AAA",
            "- BBB ✅ [EDIT:BBBDDD]",
            "- CCC",
            "Count: 2  items left",
            "Clear Completed: visible",
            "Toggle All: visible",
            "Filter: All",
        ]);

        fireEvent.keyUp(inputEdit(1), { key: "Enter" });
        await renderComplete();
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- AAA",
            "- BBBDDD ✅",
            "- CCC",
            "Count: 2  items left",
            "Clear Completed: visible",
            "Toggle All: visible",
            "Filter: All",
        ]);

        // Same with Escape
        await editTodo(0);
        await typeEditValue(0, "XXX");
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- AAA [EDIT:AAAXXX]",
            "- BBBDDD ✅",
            "- CCC",
            "Count: 2  items left",
            "Clear Completed: visible",
            "Toggle All: visible",
            "Filter: All",
        ]);
        fireEvent.keyUp(inputEdit(0), { key: "Escape" });
        await renderComplete();
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- AAA", // No changes
            "- BBBDDD ✅",
            "- CCC",
            "Count: 2  items left",
            "Clear Completed: visible",
            "Toggle All: visible",
            "Filter: All",
        ]);

        // Same with Tab
        await editTodo(0);
        await typeEditValue(0, "XXX");
        userEvent.tab();
        await renderComplete();
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- AAAXXX", // updated
            "- BBBDDD ✅",
            "- CCC",
            "Count: 2  items left",
            "Clear Completed: visible",
            "Toggle All: visible",
            "Filter: All",
        ]);

        // Same with Blank value -> delete
        await editTodo(0);
        await typeEditValue(0, "  ", true);
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- AAAXXX [EDIT:  ]",
            "- BBBDDD ✅",
            "- CCC",
            "Count: 2  items left",
            "Clear Completed: visible",
            "Toggle All: visible",
            "Filter: All",
        ]);
        fireEvent.keyUp(inputEdit(0), { key: "Enter" });
        await renderComplete();
        expect(printTodos()).toMatchObject([
            "Main Input: ''",
            "- BBBDDD ✅",
            "- CCC",
            "Count: 1  item left",
            "Clear Completed: visible",
            "Toggle All: visible",
            "Filter: All",
        ]);
    });
});
