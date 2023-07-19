import { beforeEach, describe, expect, it, test } from 'vitest';
import { createTraxEnv } from '../core';
import { Store, Trax, TraxObjectType, TraxProcessor } from '../index';

describe('Doc examples', () => {
    let trax: Trax;

    beforeEach(() => {
        trax = createTraxEnv();
    });

    it('simple createStore', async () => {
        // Simple data store
        // trax.log.consoleOutput = "All";
        const greetingStore = trax.createStore("Greeting", { message: "Hellow World" });

        expect(greetingStore.data.message).toBe("Hellow World");
        expect(greetingStore.id).toBe("Greeting");

        const gs = trax.getStore("Greeting");
        expect(gs).toBe(greetingStore);

        const subGreetingStore = greetingStore.createStore("Misc", { miscInfo: "Blah blah" });
        expect(subGreetingStore.id).toBe("Greeting>Misc");


        expect(greetingStore.disposed).toBe(false);
        greetingStore.dispose();
        expect(greetingStore.disposed).toBe(true);
        // trax.log.consoleOutput = "None";
        expect(trax.log.maxSize).toBe(1000); // default value
        trax.log.maxSize = 5000; // increase log buffer size
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

    it('should support createStore for a simple todo list (lazy processors)', async () => {
        interface TodoData {
            todos: TodoItem[],
            completedCount: number;
            itemsLeft: number;
        }

        interface TodoItem {
            description: string;
            completed: boolean;
        }

        const todoStore = trax.createStore("TodoStore", (store: Store<TodoData>) => {
            const data = store.init({
                // initial root data
                todos: [],
                completedCount: 0,
                itemsLeft: 0
            }, {
                count: (data) => {
                    // lazy processor to compute the 2 counters
                    const completedCount = data.todos.filter((todo) => todo.completed).length;
                    data.completedCount = completedCount;
                    data.itemsLeft = data.todos.length - completedCount;
                }
            })
        });

        const data = todoStore.data;
        data.todos.push({
            description: "Do something",
            completed: false
        });
        expect(data.itemsLeft).toBe(0); // changes not propagated
        await trax.reconciliation();
        expect(data.itemsLeft).toBe(1);

        expect(trax.isTraxObject(data.todos[0])).toBe(true);

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

        expect(processorId1).toBe("PersonStore%data[adult]");
        expect(active1).toBe("PersonStore%data[adult]");
        expect(processor2.id).toBe("PersonStore%prettyName");
        expect(trax.getProcessor("PersonStore%prettyName")).toBe(processor2);
        expect(trax.getProcessor(processorId1)!.id).toBe(processorId1);
        expect(active2).toBe("PersonStore%prettyName");
        expect(active3).toBe("");


        const data = personStore.data;
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
        expect(trax.isTraxObject(testStore.data)).toBe(true);
    });

    it('should support get TraxId', async () => {
        expect(trax.getTraxId({})).toBe("");
        const testStore = trax.createStore("TestStore", { foo: { bar: "baz" } });
        expect(trax.getTraxId(testStore)).toBe("TestStore");
        expect(trax.getTraxId(testStore.data)).toBe("TestStore/data");
        expect(trax.getTraxId(testStore.data.foo)).toBe("TestStore/data*foo");
        expect(trax.getTraxId(testStore.data.foo.bar)).toBe(""); // bar is not an object
    });

    it('should support trax object type', async () => {
        expect(trax.getTraxObjectType({})).toBe(""); // TraxObjectType.NotATraxObject
        const testStore = trax.createStore("TestStore", { foo: { bar: [1, 2, 3], baz: "abc" } });
        expect(trax.getTraxObjectType(testStore)).toBe("S"); // TraxObjectType.Store
        expect(trax.getTraxObjectType(testStore.data.foo)).toBe("O"); // TraxObjectType.Object
        expect(trax.getTraxObjectType(testStore.data.foo.bar)).toBe("A"); // TraxObjectType.Array
    });

    it('should support getData', async () => {
        const testStore = trax.createStore("TestStore", { foo: { bar: [1, 2, 3], baz: "abc" } });
        expect(trax.getData("TestStore/data")).toBe(testStore.data);
        expect(trax.getData("TestStore/data*foo*bar")).toBe(undefined); // because testStore.root.foo.bar has never been accessed
        const v = testStore.data.foo.bar
        expect(trax.getData("TestStore/data*foo*bar")).toBe(testStore.data.foo.bar);
        expect(trax.getData("XYZ")).toBe(undefined);
    });

    it('should support store.add', async () => {
        interface MessageData {
            messages: {
                id: string;
                text: string;
                read?: boolean; // true if the message has been read
            }[];
            unread: number; // number of unread messages
        }

        const msgStore = trax.createStore("MessageStore", (store: Store<MessageData>) => {
            const data = store.init({
                messages: [],
                unread: 0
            }, {
                unread: (data) => {
                    const msgs = data.messages;
                    const readCount = msgs.filter((m) => !!m.read).length;
                    data.unread = msgs.length - readCount;
                }
            });

            return {
                data,
                addMsg(id: string, text: string, read = false) {
                    const m = store.add(["Message", id], { id, text, read });
                    data.messages.push(m);
                }
            }
        });

        msgStore.addMsg("M0", "Message 0");
        msgStore.addMsg("M1", "Message 1");
        msgStore.addMsg("M2", "Message 2", true);
        await trax.reconciliation();
        expect(msgStore.data.unread).toBe(2);
        const m0 = msgStore.data.messages[0];
        expect(trax.getTraxId(m0)).toBe("MessageStore/Message:M0");  // id defined by the application
        expect(trax.getData("MessageStore/Message:M0")).toBe(m0);

        const ms = trax.getStore<MessageData>("MessageStore")!;
        // add message outside the addMsg method
        ms.data.messages.push({ id: "M3", text: "Message 3" });
        const m3 = msgStore.data.messages[3];
        expect(trax.getTraxId(m3)).toBe("MessageStore/data*messages*3"); // generated id
        await trax.reconciliation();

        expect(ms.get("Message:M0")).toBe(m0);
        expect(ms.get(["Message", "M0"])).toBe(m0);

        expect(ms.data.unread).toBe(3)
        ms.data.messages.shift(); // remove first array element
        const ok = ms.remove(m0);
        expect(ok).toBe(true);
        await trax.reconciliation();
        expect(ms.data.unread).toBe(2);
    });

    it('should support store.compute', async () => {

        const store = trax.createStore("UserStore", {
            id: "X1",
            firstName: "Bart",
            lastName: "Simpson"
        });

        let output = "";
        const r = store.compute("Output", () => {
            // Note: we could update the DOM instead of processin a string
            const usr = store.data;
            output = `User: ${usr.firstName} ${usr.lastName}`;
        });

        expect(output).toBe("User: Bart Simpson");

        store.data.firstName = "Homer";
        await trax.reconciliation();
        expect(output).toBe("User: Homer Simpson");

        expect(store.getProcessor("Output")).toBe(r);
    });

    it('should support sub-stores', async () => {

        const store = trax.createStore("Foo", { value: "ABC" });
        const subStore = store.createStore("Bar", { anotherValue: "DEF" });

        expect(subStore.id).toBe("Foo>Bar");
        expect(trax.getTraxId(subStore.data)).toBe("Foo>Bar/data");

        expect(store.getStore("Bar")).toBe(subStore);
    });

    it('should support store.async', async () => {
        interface Person {
            firstName: string;
            lastName: string;
            prettyName?: string;
        }

        const store = trax.createStore("PStore", (store: Store<Person>) => {
            const data = store.init({ firstName: "Homer", lastName: "Simpson" }, {
                prettyName: (data) => {
                    data.prettyName = data.firstName + " " + data.lastName;
                }
            });

            return {
                person: data,
                updateName: store.async(function* (firstNameSuffix: string, lastNameSuffix: string) {
                    data.firstName += firstNameSuffix;
                    yield pause(1); // simulate an external async call
                    const r = data.lastName + lastNameSuffix;
                    data.lastName = r;
                    return r;
                })
            }
        });

        async function pause(timeMs = 10) {
            return new Promise((resolve) => {
                setTimeout(resolve, timeMs);
            });
        }

        const data = store.person;
        expect(store.person.prettyName).toBe("Homer Simpson");

        // updateName has an async signature
        const r = await store.updateName("(FirstName)", "(LastName)");
        expect(r).toBe("Simpson(LastName)");
        expect(store.person.prettyName).toBe("Homer(FirstName) Simpson(LastName)");
    });

    it('should support sync and async processors', async () => {

        async function pause(timeMs = 1) {
            return new Promise((resolve) => {
                setTimeout(resolve, timeMs);
            });
        }

        async function getAvatar(userId: string) {
            // simulate an async fetch
            await pause();
            return "AVATAR[" + userId + "]";
        }
        interface Person {
            id: string;
            firstName: string;
            lastName: string;
            prettyName?: string;
            avatar?: string;
        }

        const store1 = trax.createStore("PersonStore", (store: Store<Person>) => {
            const data = store.init({ id: "U1", firstName: "Homer", lastName: "Simpson" }, {
                prettyName: (data) => {
                    // lazy + synchronous processor
                    data.prettyName = data.firstName + " " + data.lastName;
                },
                avatar: function* (data) {
                    // lazy + asynchronous processor
                    data.avatar = yield getAvatar(data.id);
                }
            });
        });

        const person1 = store1.data;

        expect(person1.prettyName).toBe("Homer Simpson"); // processed because we accessed person
        expect(person1.avatar).toBe(undefined); // being retrieved
        await pause(10);
        expect(person1.avatar).toBe("AVATAR[U1]"); // retrieved


        const store2 = trax.createStore("PersonStore2", (store: Store<Person>) => {
            const data = store.init({ id: "U1", firstName: "Homer", lastName: "Simpson" });

            store.compute("PrettyName", () => {
                // eager + synchronous processor
                data.prettyName = data.firstName + " " + data.lastName;
            });

            store.compute("Avatar", function* () {
                // eager + asynchronous processor
                data.avatar = yield getAvatar(data.id);
            });
        });

        const person2 = store2.data;

        expect(person2.prettyName).toBe("Homer Simpson");
        expect(person2.avatar).toBe(undefined); // being retrieved
        await pause(10);
        expect(person2.avatar).toBe("AVATAR[U1]"); // retrieved
    });

    it('should demo all processor properties and methods', async () => {
        async function pause(timeMs = 1) {
            return new Promise((resolve) => {
                setTimeout(resolve, timeMs);
            });
        }

        async function getAvatar(userId: string) {
            // simulate an async fetch
            await pause();
            return "AVATAR[" + userId + "]";
        }
        interface Person {
            id: string;
            firstName: string;
            lastName: string;
            prettyName?: string;
            avatar?: string;
        }


        let p2: TraxProcessor;

        const store = trax.createStore("PersonStore", (store: Store<Person>) => {
            const data = store.init({ id: "U1", firstName: "Homer", lastName: "Simpson" }, {
                prettyName: (data) => {
                    // lazy + synchronous processor
                    data.prettyName = data.firstName + " " + data.lastName;
                }
            });

            p2 = store.compute("Avatar", function* () {
                // eager + asynchronous processor
                data.avatar = yield getAvatar(data.id);
            });
        });

        const p1 = store.getProcessor("data[prettyName]")!;

        expect(p1.id).toBe("PersonStore%data[prettyName]");
        expect(p2!.id).toBe("PersonStore%Avatar");

        const person = store.data;
        expect(p1.dirty).toBe(false);
        expect(person.prettyName).toBe("Homer Simpson");
        person.firstName = "Marge";
        expect(p1.dirty).toBe(true);
        expect(person.prettyName).toBe("Homer Simpson"); // change not propagated
        await trax.reconciliation();
        expect(p1.dirty).toBe(false);
        expect(person.prettyName).toBe("Marge Simpson");

        expect(p1.dependencies).toMatchObject([
            "PersonStore/data.firstName",
            "PersonStore/data.lastName",
        ]);

        // autocompute
        let output = "";
        const outputProcessor = store.compute("Output", () => {
            output = `Person[${person.id}] ${person.prettyName}`;
        }, true, true);

        expect(output).toBe("Person[U1] Marge Simpson");
        expect(outputProcessor.isRenderer).toBe(true);
        expect(outputProcessor.computeCount).toBe(1);
        person.firstName = "BART";
        person.lastName = "SIMPSON";
        expect(outputProcessor.computeCount).toBe(1); // changes not propagated
        await trax.reconciliation();
        expect(outputProcessor.computeCount).toBe(2);
        expect(output).toBe("Person[U1] BART SIMPSON");

        expect(outputProcessor.disposed).toBe(false);
        expect(outputProcessor.computeCount).toBe(2);
        outputProcessor.dispose();
        expect(outputProcessor.disposed).toBe(true);

        // new changes will have no impacts
        person.firstName = "MAGGIE";
        await trax.reconciliation();
        expect(outputProcessor.computeCount).toBe(2); // processor didn't run

        // render
        let renderResult = "";
        const renderProcessor = store.compute("Render", () => {
            renderResult = `RENDER: ${person.prettyName}`;
        }, false); // false -> no auto-compute
        let dirtyCount = 0;
        renderProcessor.onDirty = () => {
            dirtyCount++;
        }

        expect(renderResult).toBe(""); // not rendered
        expect(dirtyCount).toBe(0); // onDirty is not called at init
        expect(renderProcessor.dirty).toBe(true);
        renderProcessor.compute();
        expect(renderResult).toBe("RENDER: MAGGIE SIMPSON"); // rendered
        expect(dirtyCount).toBe(0);

        person.firstName = 'LISA';
        expect(dirtyCount).toBe(0); // onDirty hasn't been called yet
        await trax.reconciliation();
        expect(dirtyCount).toBe(1); // onDirty was called
        expect(renderResult).toBe("RENDER: MAGGIE SIMPSON"); // not re-rendered
        expect(renderProcessor.dirty).toBe(true);
        renderProcessor.compute();
        expect(renderResult).toBe("RENDER: LISA SIMPSON");
        expect(renderProcessor.computeCount).toBe(2);
        expect(renderProcessor.dirty).toBe(false);
        renderProcessor.compute();                    // will be ignored as renderProcessor is not dirty
        expect(renderProcessor.computeCount).toBe(2); // still 2
        renderProcessor.compute(true);                // forced re-render
        expect(renderProcessor.computeCount).toBe(3); // 2 -> 3

    });

});
