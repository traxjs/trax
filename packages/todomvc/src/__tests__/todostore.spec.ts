import { trax } from '@traxjs/trax';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTodoStore, Todo, TodoFilter, TodoStore } from '../todostore';

describe('Todo Store', () => {
    let todoStore: TodoStore, data: TodoStore["data"], todos: Todo[];

    beforeEach(() => {
        todoStore = createTodoStore();
        data = todoStore.data;
        todos = data.todos;
    });

    function printTodos(items = todos) {
        return items.map((todo, index) => {
            if (todo === undefined) return "UNDEFINED";
            let editData = todo.editing ? " [EDITMODE]" : "";
            if (todo.editDescription !== "") {
                editData += ` [EDITVALUE:${todo.editDescription}]`;
            }
            return `${index + 1}. ${todo.description}${todo.completed ? " ✅" : ""}${editData}`;
        });
    }

    function initTodos(addCompletedTodos = true) {
        data.newEntry = "Firth thing";
        todoStore.addTodo();
        data.newEntry = "Second thing";
        todoStore.addTodo();
        data.newEntry = "Third thing";
        todoStore.addTodo();
        data.newEntry = "Last thing";
        todoStore.addTodo();
        if (addCompletedTodos) {
            todoStore.toggleCompletion(todos[1]);
            todoStore.toggleCompletion(todos[2]);
        }
        trax.processChanges();
    }

    it('should be properly inittialized', async () => {
        expect(data.filter).toBe(TodoFilter.ALL);
        expect(data.filteredTodos.length).toBe(0);
        expect(data.todos.length).toBe(0);
        expect(data.itemsLeft).toBe(0);
        expect(data.nbrOfCompletedTodos).toBe(0);
        expect(data.newEntry).toBe("");
    });

    it('should add todos', async () => {
        expect(data.todos.length).toBe(0);
        data.newEntry = "ABC";
        todoStore.addTodo();
        expect(data.todos.length).toBe(1);
        expect(printTodos()).toMatchObject([
            "1. ABC"
        ]);
        expect(data.newEntry).toBe("");
        data.newEntry = "DEF";
        todoStore.addTodo();
        expect(printTodos()).toMatchObject([
            "1. ABC",
            "2. DEF"
        ]);
        await trax.reconciliation();
        expect(data.itemsLeft).toBe(2);
        expect(data.nbrOfCompletedTodos).toBe(0);
    });

    it('should not add todos if new entry is empty', async () => {
        todoStore.addTodo();
        expect(data.todos.length).toBe(0);
        data.newEntry = "  ";
        todoStore.addTodo();
        expect(data.todos.length).toBe(0);
        expect(data.newEntry).toBe("");
    });

    it('should toggle todo completion', async () => {
        initTodos(false);
        expect(data.itemsLeft).toBe(4);
        expect(data.nbrOfCompletedTodos).toBe(0);
        expect(printTodos()).toMatchObject([
            "1. Firth thing",
            "2. Second thing",
            "3. Third thing",
            "4. Last thing",
        ]);

        todoStore.toggleCompletion(todos[1]);
        await trax.reconciliation();
        expect(printTodos()).toMatchObject([
            "1. Firth thing",
            "2. Second thing ✅",
            "3. Third thing",
            "4. Last thing",
        ]);

        todoStore.toggleCompletion(todos[3]);
        await trax.reconciliation();
        expect(printTodos()).toMatchObject([
            "1. Firth thing",
            "2. Second thing ✅",
            "3. Third thing",
            "4. Last thing ✅",
        ]);

        // invalid call
        todoStore.toggleCompletion(todos[5]);
        await trax.reconciliation();
        expect(printTodos()).toMatchObject([
            "1. Firth thing",
            "2. Second thing ✅",
            "3. Third thing",
            "4. Last thing ✅",
        ]);

        // toggle back
        todoStore.toggleCompletion(todos[1]);
        await trax.reconciliation();
        expect(printTodos()).toMatchObject([
            "1. Firth thing",
            "2. Second thing",
            "3. Third thing",
            "4. Last thing ✅",
        ]);
    });

    it('should delete todos', async () => {
        initTodos();
        expect(data.itemsLeft).toBe(2);
        expect(data.nbrOfCompletedTodos).toBe(2);
        expect(printTodos()).toMatchObject([
            "1. Firth thing",
            "2. Second thing ✅",
            "3. Third thing ✅",
            "4. Last thing",
        ]);

        todoStore.deleteTodo(todos[1]);
        await trax.reconciliation();
        expect(data.itemsLeft).toBe(2);
        expect(data.nbrOfCompletedTodos).toBe(1);
        expect(printTodos()).toMatchObject([
            "1. Firth thing",
            "2. Third thing ✅",
            "3. Last thing",
        ]);

        const t0 = todos[0];
        todoStore.deleteTodo(t0);
        await trax.reconciliation();
        expect(data.itemsLeft).toBe(1);
        expect(data.nbrOfCompletedTodos).toBe(1);
        expect(printTodos()).toMatchObject([
            "1. Third thing ✅",
            "2. Last thing",
        ]);

        todoStore.deleteTodo(todos[1]);
        await trax.reconciliation();
        expect(data.itemsLeft).toBe(0);
        expect(data.nbrOfCompletedTodos).toBe(1);
        expect(printTodos()).toMatchObject([
            "1. Third thing ✅",
        ]);

        // invalid call
        todoStore.deleteTodo(todos[2]);
        await trax.reconciliation();
        expect(printTodos()).toMatchObject([
            "1. Third thing ✅",
        ]);

        // another invalid call
        todoStore.deleteTodo(t0); // t0 is not in the list anymore
        await trax.reconciliation();
        expect(printTodos()).toMatchObject([
            "1. Third thing ✅",
        ]);

        expect(data.itemsLeft).toBe(0);
        expect(data.nbrOfCompletedTodos).toBe(1);

        todoStore.deleteTodo(todos[0]);
        await trax.reconciliation();
        expect(data.itemsLeft).toBe(0);
        expect(data.nbrOfCompletedTodos).toBe(0);
        expect(printTodos()).toMatchObject([]);
    });

    it('should clear all completed', async () => {
        initTodos();
        expect(data.itemsLeft).toBe(2);
        expect(data.nbrOfCompletedTodos).toBe(2);
        expect(printTodos()).toMatchObject([
            "1. Firth thing",
            "2. Second thing ✅",
            "3. Third thing ✅",
            "4. Last thing",
        ]);

        todoStore.clearCompleted();
        await trax.reconciliation();
        expect(data.itemsLeft).toBe(2);
        expect(data.nbrOfCompletedTodos).toBe(0);
        expect(printTodos()).toMatchObject([
            "1. Firth thing",
            "2. Last thing",
        ]);
    });

    it('should toggle all completed', async () => {
        initTodos();
        expect(printTodos()).toMatchObject([
            "1. Firth thing",
            "2. Second thing ✅",
            "3. Third thing ✅",
            "4. Last thing",
        ]);

        todoStore.toggleAllCompleted();
        await trax.reconciliation();
        expect(printTodos()).toMatchObject([
            "1. Firth thing",
            "2. Second thing",
            "3. Third thing",
            "4. Last thing",
        ]);
        expect(data.itemsLeft).toBe(4);
        expect(data.nbrOfCompletedTodos).toBe(0);

        todoStore.toggleAllCompleted();
        await trax.reconciliation();
        expect(printTodos()).toMatchObject([
            "1. Firth thing ✅",
            "2. Second thing ✅",
            "3. Third thing ✅",
            "4. Last thing ✅",
        ]);
        expect(data.itemsLeft).toBe(0);
        expect(data.nbrOfCompletedTodos).toBe(4);
    });

    it('should filter todos', async () => {
        initTodos();
        expect(data.filter).toBe(TodoFilter.ALL)
        expect(printTodos(data.filteredTodos)).toMatchObject([
            "1. Firth thing",
            "2. Second thing ✅",
            "3. Third thing ✅",
            "4. Last thing",
        ]);
        expect(data.itemsLeft).toBe(2);

        todoStore.setFilter(TodoFilter.ACTIVE);
        await trax.reconciliation();
        expect(printTodos(data.filteredTodos)).toMatchObject([
            "1. Firth thing",
            "2. Last thing",
        ]);
        expect(data.itemsLeft).toBe(2);

        todoStore.setFilter(TodoFilter.COMPLETED);
        await trax.reconciliation();
        expect(printTodos(data.filteredTodos)).toMatchObject([
            "1. Second thing ✅",
            "2. Third thing ✅",
        ]);
        expect(data.itemsLeft).toBe(2);

        todoStore.setFilter(TodoFilter.ALL);
        await trax.reconciliation();
        expect(printTodos(data.filteredTodos)).toMatchObject([
            "1. Firth thing",
            "2. Second thing ✅",
            "3. Third thing ✅",
            "4. Last thing",
        ]);
        expect(data.itemsLeft).toBe(2);
    });
});