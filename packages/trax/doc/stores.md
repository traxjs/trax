
# Trax Stores

<!-- Table of content -->
* [Store properties](#store-properties)
    + [readonly **id**: string](#readonly-id-string)
    + [readonly **data**: T](#readonly-data-t)
    + [readonly **disposed**: boolean](#disposed)
* [Store Life Cycle](#store-life-cycle)
    + [**init**(data: T, lazyProcessors?: TraxLazyComputeDescriptor<T>): T](#initroot-t-lazyprocessors-traxlazycomputedescriptort-t)
    + [**dispose**(): boolean](#dispose-boolean)
* [Store data](#store-data)
    + [**add**<T extends Object | Object[]>(id: TraxIdDef, initValue: T, lazyProcessors?: TraxLazyComputeDescriptor<T>): T](#addt-extends-object--objectid-traxiddef-initvalue-t-lazyprocessors-traxlazycomputedescriptort-t)
    + [**get**<T extends Object>(id: TraxIdDef): T | void](#gett-extends-objectid-traxiddef-t--void)
    + [**remove**<T extends Object>(dataObject: T): boolean](#removet-extends-objectdataobject-t-boolean)
* [Store processors](#store-processors))
    + [**compute**(id: TraxIdDef, compute: TraxComputeFn, autoCompute?: boolean, isRenderer?: boolean): TraxProcessor](#computeid-traxiddef-compute-traxcomputefn-autocompute-boolean-isrenderer-boolean-traxprocessor)
    + [**getProcessor**(id: TraxIdDef): TraxProcessor | void](#getprocessorid-traxiddef-traxprocessor--void)
* [Sub stores](#sub-stores)
    + [**createStore**(...)](#createStore)
    + [**getStore**<T>(id: TraxIdDef): Store<T> | void](#getstoretid-traxiddef-storet--void)
* [Utilities](#utilities)
    + [**async**(...)](#async)

Trax Stores are mini trax contexts that gather domain-related entities (i.e. data, processors and sub-stores). Stores fullfil two purposes:
- gather and expose domain-related data objects (trax data objects are JSON structures that can be *observed* by processors and that can trigger update reactions)
- expose functional APIs associated to these data objects

Stores also hold compute processors that will automatically create/update/or delete data objects in the Store data graph.

Stores are created through [trax.createStore()][tcs] or [store.createStore()][scs] - to create root or sub-stores.

[tcs]: ./trax.md#createstore
[scs]: #sub-stores

## Store properties

### ```readonly id: string```

The store id - cf. [trax ids](./trax.md#trax-ids) for fmore details on trax id structures.

```typescript
// Simple data store
const greetingStore = trax.createStore("Greeting", { message: "Hellow World" });
expect(greetingStore.id).toBe("Greeting");
// Simple sub-store
const subGreetingStore = greetingStore.createStore("Misc", { miscInfo: "Blah blah"});
expect(subGreetingStore.id).toBe("Greeting>Misc");
```
### ```readonly data: T```

Store root data object. **All objects, arrays and dictionaries that are not reachable** through this object will be **automatically garbage-collected**.

```typescript
const greetingStore = trax.createStore("Greeting", { message: "Hellow World" });
expect(greetingStore.data.message).toBe("Hellow World");
```

### ```disposed```

Tell if the store is disposed and should be ignored.

```typescript
expect(greetingStore.disposed).toBe(false);
greetingStore.dispose();
expect(greetingStore.disposed).toBe(true);
```

## Store Life Cycle

Store must be created with an initial data graph that must either be passed as [trax.createStore()][tcs] argument or that must be defined through the init() method:

### ```init(data: T, lazyProcessors?: TraxLazyComputeDescriptor<T>): T```

Initialize the root data object - must be only called in the store init function. Accepts 2 parameters:
- **data**: the initial data graph value (JSON object)
- **lazyProcessors**: optional compute functions associated to the root data object. The processor associated to these functions will follow the object life cycle and will be automatically disposed when the store is disposed

Note: ```store.init(x)``` is equivalent to ```store.add("data", x)``` (but init cannot be done with *add()* as *data* is a reserved id).

```typescript
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
expect(data.itemsLeft).toBe(1); // changes duly propagated
```

### ```dispose(): boolean```

Dispose the current store and all its sub-stores and processor so that they can be garbage collected

```typescript
const greetingStore = trax.createStore("Greeting", { message: "Hellow World" });
expect(greetingStore.disposed).toBe(false);
greetingStore.dispose();
expect(greetingStore.disposed).toBe(true);
```

## Store data

Add / retrieve / remove data objects from a store:

### ```add<T extends Object | Object[]>(id: TraxIdDef, initValue: T, lazyProcessors?: TraxLazyComputeDescriptor<T>): T```

**Get or create** a data object associated to the given id (i.e. if the id is already used, this method will **return the existing object**). This method allows to choose a specific id for new objects, whereas adding objects directly in the data graph generates ids from the first access path.

This method accepts the following parameters:
- **id**: the object id within the store scope - must be unique with the store scope
- **initValue**: the object init value that will be used if the object is not found and needs to be created (empty object if nothing is provided)
- **lazyProcessors**: optional compute functions associated to this object. The processor associated to these functions will follow the object life cycle.

Note: ***add()* must be used when processors create data objects**: the first time the processor is run *add()* will create the object, and the second time it will retrieve the previous objects.


```typescript
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
ms.data.messages.push({ id: "M3", text: "Message 3" }); // message added without store.add()
const m3 = msgStore.data.messages[3];
expect(trax.getTraxId(m3)).toBe("MessageStore/data*messages*3"); // generated id -> message cannot be easily retrieved by id as its id cannot be easily guessed
```


### ```get<T extends Object>(id: TraxIdDef): T | void```

Retrieve a data object/array/dictionary that has been previously created (Doesn't work for processors or stores)
Note: if this object is not part of the data graph (i.e. if it cannot be accessed from the root data object), **it may habe been garbage collected**

```typescript
// following previous MessageStore example
const ms = trax.getStore<MessageData>("MessageStore")!;
expect(ms.get("Message:M0")).toBe(m0);
expect(ms.get(["Message", "M0"])).toBe(m0);
```

### ```remove<T extends Object>(dataObject: T): boolean```

Delete a data object from the store (so that its id can be reused for another object). Returns true if an object was successfully deleted.

Note: objects that are disconnected from the root data graph will automatically get garbaged collected.

```typescript
// following previous MessageStore example
const ms = trax.getStore<MessageData>("MessageStore")!;
expect(ms.data.unread).toBe(3); // M0, M1, M3
ms.data.messages.shift(); // remove first array element
const ok = ms.remove(m0);
expect(ok).toBe(true);
await trax.reconciliation();
expect(ms.data.unread).toBe(2); // M1, M3
```

## Store processors

### ```compute(id: TraxIdDef, compute: TraxComputeFn, autoCompute?: boolean, isRenderer?: boolean): TraxProcessor```

Create or retrieve an **eager** compute processor (eager processors are always called even if the data they compute are not read). These processors may be **synchronous** or **asynchronous** (cf. $TraxComputeFn)
If a processor with the same id is found, it will be returned instead of creating a new one
but its compute function will be updated in order to benefit from new closure values that may not exist
in the previous function. *Compute* accepts the following parameters:
- **id** the processor id - must be unique with the store scope
- **compute** the compute function
- **autoCompute** (optional) if true (default) the processor compute will be automatically called after getting dirty (i.e. at the end of a cycle when trax.processChanges() is called). If false, the process **onDirty** callback will be called - and it will be up to the appliction to explicitely call the compute function (useful for **React renderers** that are asynchronous - this is what the *@traxjs/trax-react* library uses).
- **isRenderer** (optional) flag the processor as a renderer (e.g. React or Preact component - default: false) - used to separate renderers in the logs.

Note: non-autoCompute processors are still considered eager as their *onDirty* callback will be called when they get dirty, even the data generated by the processor are not read.

```typescript
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
```

### ```getProcessor(id: TraxIdDef): TraxProcessor | void```

Retrieve a processor created on this store
```typescript
// following previous example
expect(store.getProcessor("Output")).toBe(r);
```

## Sub-stores
### ```createStore(...)```

Create a sub-store. Similar to [trax.createStore](./trax.md#createstore).

```typescript
const store = trax.createStore("Foo", { value: "ABC" });
const subStore = store.createStore("Bar", { anotherValue: "DEF" })
expect(subStore.id).toBe("Foo>Bar");
expect(trax.getTraxId(subStore.data)).toBe("Foo>Bar/data");
```

### ```getStore<T>(id: TraxIdDef): Store<T> | void```

Retrieve a sub-store

```typescript
// Following previous example
expect(store.getStore("Bar")).toBe(subStore);
```

##  Utilities
### ```async(...)```

Create an async function from a generator function in order to have its logs properly tracked in the trax logger This is meant to be used in store wrapper objects to expose action functions. This can also be used to define an async block that will be called asychronously (e.g. store async initialization).

Note: The reason for **using generator functions** instead of simple **async functions** is because trax can determine when JS runs in the generator callstack or not. This cannot be done with async functions. This is why any async function that we want to track in the trax dev tools must be implemented as a generator function.

```typescript
async<F extends (...args: any[]) => Generator<Promise<any>, any, any>>(fn: F): (...args: Parameters<F>) => Promise<any>;
async<F extends (...args: any[]) => Generator<Promise<any>, any, any>>(name: string, fn: F): (...args: Parameters<F>) => Promise<any>;
```
Example:
```typescript
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
```
