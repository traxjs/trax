import { Store, trax } from "@traxjs/trax";

export interface TodoData {
    /** new todo entry being edited in the main field */
    newEntry: string;
    /** list of all todos */
    todos: Todo[];
    /** todo list filtered according to the filter property (computed) */
    filteredTodos: Todo[];
    /** possible filter values */
    filter: TodoFilter;
    /** number of todos that have benn completed (computed) */
    nbrOfCompletedTodos: number;
    /** number of todos that remain to be completed (computed) */
    itemsLeft: number;
}

export interface Todo {
    /** todo description */
    description: string;
    /** description in edit mode (prior to validation) */
    editDescription: string;
    /** tell if the todo item is completed */
    completed: boolean;
    /** tell if the todo item is being edited */
    editing: boolean;
}

/** Possible filter values */
export enum TodoFilter {
    ALL = 1,
    ACTIVE,
    COMPLETED
}

export type TodoStore = ReturnType<typeof createTodoStore>;

/**
 * Create a trax store to hold the data associated to a <TodoList/>
 * @returns a store wrapper on Store<TodoData>
 */
export function createTodoStore() {
    return trax.createStore("TodoStore", (store: Store<TodoData>) => {
        const data = store.init({
            newEntry: "",
            todos: [],
            filteredTodos: [],
            filter: TodoFilter.ALL,
            nbrOfCompletedTodos: 0,
            itemsLeft: 0
        });
        const todos = data.todos;
        let idCount = 0; // counter used to generate unique todo ids

        store.compute("FilteredTodos", () => {
            let newContent = [];
            if (data.filter === TodoFilter.ALL) {
                newContent = todos;
            } else {
                const isComplete = (data.filter === TodoFilter.COMPLETED);
                newContent = todos.filter(item => item.completed === isComplete);
            }
            trax.updateArray(data.filteredTodos, newContent)
        });

        store.compute("Counters", () => {
            const count = todos.filter((todo) => todo.completed).length;
            data.nbrOfCompletedTodos = count;
            data.itemsLeft = todos.length - count;
        });

        return {
            /** Todo store data */
            data,
            /** Create a new Todo item based on the newEntry value */
            addTodo() {
                let todoDesc = data.newEntry = data.newEntry.trim();
                if (todoDesc.length) {
                    const todo = store.add<Todo>(["Todo", ++idCount], {
                        description: todoDesc,
                        editDescription: "",
                        completed: false,
                        editing: false
                    });
                    todo.description = todoDesc;
                    todos.push(todo);
                }
                data.newEntry = "";
            },
            /** Toggle Todo item completed status */
            toggleCompletion(todo: Todo) {
                if (todo) {
                    todo.completed = !todo.completed;
                }
            },
            /** Delete a Todo item */
            deleteTodo(todo: Todo) {
                const idx = todos.indexOf(todo);
                idx > -1 && todos.splice(idx, 1);
            },
            /** Remove all completed todos */
            clearCompleted() {
                // mutate todos instead of replacing it (this will improve observer performance)
                trax.updateArray(todos, todos.filter((todo) => !todo.completed));
            },
            /** Toggle all Todos completed or not completed */
            toggleAllCompleted() {
                const containsCompletedItems = data.nbrOfCompletedTodos > 0;
                todos.forEach((todo) => { todo.completed = !containsCompletedItems });
            },
            /** Update the filtered view */
            setFilter(filter: TodoFilter) {
                data.filter = filter;
            }
        }
    });
};