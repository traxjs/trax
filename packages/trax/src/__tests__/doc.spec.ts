import { beforeEach, describe, expect, it, test } from 'vitest';
import { createTraxEnv } from '../core';
import { Store, Trax, TraxObjectType } from '../index';

describe('Doc examples', () => {
    let trax: Trax;

    beforeEach(() => {
        trax = createTraxEnv();
    });

    it('simple createStore', async () => {
        // Simple data store
        const greetingStore = trax.createStore("Greeting", { message: "Hellow World" });

        expect(greetingStore.root.message).toBe("Hellow World");
        expect(greetingStore.id).toBe("Greeting");

        const gs = trax.getStore("Greeting");
        expect(gs).toBe(greetingStore);
    });

    it('should support createStore for a simple todo list', async () => {
        interface TodoData {
            todos: TodoItem[],
            completedCount: number;
            itemsLeft: number;
        }

        interface TodoItem {
            description: string;
            completed: boolean;
        }

        let tdsStore: any;

        const todoStore = trax.createStore("Todos", (store: Store<TodoData>) => {
            const data = store.init({
                // initial root data
                todos: [],
                completedCount: 0,
                itemsLeft: 0
            });
            tdsStore = store;

            // count processor (eager)
            store.compute("count", () => {
                const completedCount = data.todos.filter((todo) => todo.completed).length;
                data.completedCount = completedCount;
                data.itemsLeft = data.todos.length - completedCount;
            });

            // store API
            return {
                data, // expose the root graph as "data"
                addTodo(desc: string, completed = false) {
                    data.todos.push({ description: desc, completed });
                },
                deleteTodo(todo: TodoItem) {
                    const idx = data.todos.indexOf(todo);
                    idx > -1 && data.todos.splice(idx, 1);
                }
            }
        });

        // usage
        const data = todoStore.data;
        expect(data.todos.length).toBe(0);
        todoStore.addTodo("First");
        todoStore.addTodo("Second");
        todoStore.addTodo("Third");
        expect(data.itemsLeft).toBe(0); // still 0 because changes weren't propagated
        await trax.reconciliation();
        expect(data.itemsLeft).toBe(3); // changes have been propagated
        todoStore.deleteTodo(data.todos[0]);
        data.todos[0].completed = true;
        await trax.reconciliation();
        expect(data.itemsLeft).toBe(1);
        expect(data.todos[0].description).toBe("Second");


        const tds = trax.getStore("Todos");
        expect(tds).toBe(tdsStore);
    });

    it('should support getProcessor and getActiveProcessor', async () => {
        interface Person {
            firstName: string;
            lastName: string;
            age: number;
            isAdult?: boolean;
            prettyName: string;
        }

        let processorId1 = "", active1 = "", processor2: any = null, active2 = "", active3 = "";

        const personStore = trax.createStore("PersonStore", (store: Store<Person>) => {
            const data = store.init({
                // initial root data
                firstName: "Homer",
                lastName: "Simpson",
                age: 39,
                prettyName: "" // computed
            }, {
                adult: (data, cc) => {
                    // lazy processor
                    data.isAdult = data.age >= 18;
                    processorId1 = cc.processorId;
                    active1 = trax.getActiveProcessor()?.id || "";
                }
            });

            processor2 = store.compute("prettyName", () => {
                data.prettyName = data.firstName + " " + data.lastName
                active2 = trax.getActiveProcessor()?.id || "";
            });

            active3 = trax.getActiveProcessor()?.id || "";
        });

        expect(processorId1).toBe("PersonStore%root[adult]");
        expect(active1).toBe("PersonStore%root[adult]");
        expect(processor2.id).toBe("PersonStore%prettyName");
        expect(trax.getProcessor("PersonStore%prettyName")).toBe(processor2);
        expect(trax.getProcessor(processorId1)!.id).toBe(processorId1);
        expect(active2).toBe("PersonStore%prettyName");
        expect(active3).toBe("");


        const data = personStore.root;
        expect(data.prettyName).toBe("Homer Simpson");
        data.firstName = "Marge";
        expect(data.prettyName).toBe("Homer Simpson"); // change not yet propagated
        await trax.reconciliation();
        expect(data.prettyName).toBe("Marge Simpson"); // change propagated

        expect(data.prettyName).toBe("Marge Simpson");
        expect(trax.pendingChanges).toBe(false);
        data.firstName = "Bart";
        expect(trax.pendingChanges).toBe(true);
        data.lastName = "SIMPSON";
        expect(trax.pendingChanges).toBe(true);
        await trax.reconciliation();
        expect(data.prettyName).toBe("Bart SIMPSON");
        expect(trax.pendingChanges).toBe(false);

        expect(data.prettyName).toBe("Bart SIMPSON");
        data.lastName = "Simpson";
        data.firstName = "Lisa";
        expect(data.prettyName).toBe("Bart SIMPSON"); // change not yet propagated
        trax.processChanges();
        expect(data.prettyName).toBe("Lisa Simpson"); // change propagated


        let o = personStore.add(["abc", 123, "def"], { name: "Maggie" });
        expect(trax.getTraxId(o)).toBe("PersonStore/abc:123:def");
    });

    it('should support isTraxObject', async () => {
        expect(trax.isTraxObject({})).toBe(false);
        expect(trax.isTraxObject(123)).toBe(false);
        const testStore = trax.createStore("TestStore", { foo: "bar" });
        expect(trax.isTraxObject(testStore)).toBe(true);
        expect(trax.isTraxObject(testStore.root)).toBe(true);
    });

    it('should support get TraxId', async () => {
        expect(trax.getTraxId({})).toBe("");
        const testStore = trax.createStore("TestStore", { foo: { bar: "baz" } });
        expect(trax.getTraxId(testStore)).toBe("TestStore");
        expect(trax.getTraxId(testStore.root)).toBe("TestStore/root");
        expect(trax.getTraxId(testStore.root.foo)).toBe("TestStore/root*foo");
        expect(trax.getTraxId(testStore.root.foo.bar)).toBe(""); // bar is not an object
    });

    it('should support trax object type', async () => {
        expect(trax.getTraxObjectType({})).toBe(""); // TraxObjectType.NotATraxObject
        const testStore = trax.createStore("TestStore", { foo: { bar: [1, 2, 3], baz: "abc" } });
        expect(trax.getTraxObjectType(testStore)).toBe("S"); // TraxObjectType.Store
        expect(trax.getTraxObjectType(testStore.root.foo)).toBe("O"); // TraxObjectType.Object
        expect(trax.getTraxObjectType(testStore.root.foo.bar)).toBe("A"); // TraxObjectType.Array
    });

    it('should support getData', async () => {
        const testStore = trax.createStore("TestStore", { foo: { bar: [1, 2, 3], baz: "abc" } });
        expect(trax.getData("TestStore/root")).toBe(testStore.root);
        expect(trax.getData("TestStore/root*foo*bar")).toBe(undefined); // because testStore.root.foo.bar has never been accessed
        const v = testStore.root.foo.bar
        expect(trax.getData("TestStore/root*foo*bar")).toBe(testStore.root.foo.bar);
        expect(trax.getData("XYZ")).toBe(undefined);
    });

});
