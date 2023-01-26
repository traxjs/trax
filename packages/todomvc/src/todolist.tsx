import { trax } from "@traxjs/trax";
import { component, componentId, useStore } from "@traxjs/trax-react";
import { useRef } from "preact/hooks";
import { createTodoStore, Todo, TodoFilter, TodoStore } from "./todostore";
import './css/base.css';
import './css/app.css';

/** Main Todo Lis component */
export const TodoList = component("TodoList", () => {
    // get or create a TodoStore instance
    const tds = useStore(createTodoStore);
    const data = tds.data;

    return <div data-id={componentId()} className='todoList'>
        <section className="todoapp">
            <header className="header">
                <h1> todos </h1>
                <input type="text" className="new-todo" placeholder="What needs to be done?"
                    autoFocus={true}
                    autoComplete="off"
                    value={data.newEntry}
                    onChange={e => data.newEntry = e.target.value}
                    onKeyUp={e => e.key === "Enter" && tds.addTodo()}
                />
            </header>
            {(data.todos.length === 0) ? "" : <TodoItems tds={tds} />}
        </section>
        <footer className="info">
            <p>Double-click to edit a todo</p>
            <p>Adapted by <a href="http://github.com/b-laporte/">b-laporte</a></p>
            <p>Part of <a href="http://todomvc.com">TodoMVC</a></p>
        </footer>
    </div>
});

const TodoItems = component("TodoItems", (props: { tds: TodoStore }) => {
    const { tds } = props;
    const data = tds.data;
    // Create a unique id from the trax id
    const toggleAllId = "toggle-all-" + trax.getTraxId(data);

    return <>
        <section className="main" data-id={componentId()}>
            <input id={toggleAllId} className="toggle-all" type="checkbox" checked={data.itemsLeft === 0}
                onChange={() => tds.toggleAllCompleted()} />
            <label htmlFor={toggleAllId} > Mark all as complete </label>
            <ul className="todo-list">
                {data.filteredTodos.map((todo) => {
                    return <TodoItem key={trax.getTraxId(todo)} todo={todo} tds={tds} />
                })}
            </ul>
        </section >
        <TodoFooter tds={tds} />
    </>
});

const TodoItem = component("TodoItem", (props: { tds: TodoStore, todo: Todo }) => {
    const { tds, todo } = props;
    const inputRef = useRef(null);
    const cssClassName = "todo " + (todo.editing ? 'editing ' : '') + (todo.completed ? 'completed' : '');

    return <li className={cssClassName} data-id={componentId()}>
        <div className="view">
            <input className="toggle" type="checkbox" checked={todo.completed} onChange={() => tds.toggleCompletion(todo)} />
            <label onDoubleClick={startEditing} > {todo.description} </label>
            <button className="destroy" onClick={() => tds.deleteTodo(todo)}></button>
        </div>
        {!todo.editing ? "" :
            <input ref={inputRef} type="text" className="edit"
                autoFocus={true}
                value={todo.editDescription}
                onChange={(e) => { tds.updateEditDescription(todo, e.target.value) }}
                onKeyUp={e => handleExitKeys(e.key)}
                onBlur={() => tds.stopEditing(todo)}
            />
        }
    </li>

    async function startEditing() {
        tds.startEditing(todo);
        await trax.reconciliation();
        // focus the input element
        const nd = inputRef.current;
        if (nd) {
            (nd as HTMLInputElement).focus();
        }
    }

    function handleExitKeys(key: string) {
        if (key === "Enter") {
            tds.stopEditing(todo);
        } else if (key === "Escape") {
            tds.stopEditing(todo, false);
        }
    }
});

const TodoFooter = component("TodoFooter", (props: { tds: TodoStore }) => {
    const { tds } = props;
    const data = tds.data;

    return <footer className="footer" data-id={componentId()}>
        <span className="todo-count">
            {/* Note: Bad localization practice */}
            <strong> {data.itemsLeft} </strong> item{data.itemsLeft !== 1 ? 's' : ''} left
        </span>
        <ul className="filters">
            <li>
                <a className={data.filter === TodoFilter.ALL ? 'selected' : ''} href={"#/all"}
                    onClick={() => tds.setFilter(TodoFilter.ALL)}> All </a>
            </li>
            <li>
                <a className={data.filter === TodoFilter.ACTIVE ? 'selected' : ''} href={"#/active"}
                    onClick={() => tds.setFilter(TodoFilter.ACTIVE)}> Active </a>
            </li>
            <li>
                <a className={data.filter === TodoFilter.COMPLETED ? 'selected' : ''} href={"#/completed"}
                    onClick={() => tds.setFilter(TodoFilter.COMPLETED)}> Completed </a>
            </li>
        </ul >

        {(data.nbrOfCompletedTodos > 0) ?
            <button className="clear-completed" onClick={() => tds.clearCompleted()}> Clear completed </button >
            : ""
        }
    </footer >
});