
# trax

The global trax object gather several utility functions associated to trax objects. It also exposes the main ```createStore``` entry point.

<!-- Table of content -->
* [Trax objects](#trax-objects)
    + [**ids**](#trax-ids)
    + [**isTraxObject**(obj: any): boolean](#istraxobjectobj-any-boolean)
    + [**getTraxId**(obj: any): string](#gettraxidobj-any-string)
    + [**getTraxObjectType**(obj: any): TraxObjectType](#gettraxobjecttypeobj-any-traxobjecttype)
    + [**getData**<T>(id: string): T | void](#getdatatid-string-t--void)
* [Stores](#stores)
    + [**createStore**(...)](#createstore)
    + [**getStore**<T>(id: string): Store<T> | void](#getstoretid-string-storet--void)
* [Processors](#processors)
    + [**getProcessor**(id: string): TraxProcessor | void](#getprocessorid-string-traxprocessor--void)
    + [**getActiveProcessor**(): TraxProcessor | void](#getactiveprocessor-traxprocessor--void)
* [Update life-cycle](#update-life-cycle)
    + [**reconciliation**(): Promise<void>](#reconciliation-promisevoid)
    + [readonly **pendingChanges**: boolean](#readonly-pendingchanges-boolean)
    + [**processChanges**(): void](#processchanges-void)
* [General utilities](#general-utilities)
    + [**log**: EventStream](#log-eventstream)
    + [**updateArray**(array: any[], newContent: any[]): void](#updatearrayarray-any-newcontent-any-void)
    + [**updateDictionary**<T>(dict: { [k: string]: T }, newContent: { [k: string]: T }): void](#updatedictionarytdict--k-string-t--newcontent--k-string-t--void)
    + [**getObjectKeys**(o: TraxObject): string[]](#getobjectkeyso-traxobject-string)


## Trax objects
### Trax ids

One of trax main differentiator compared to similar solutions is that trax generates unique ids for each
its entities in order to ease troubleshooting. Trax supports 4 types of entities:
- **Stores** that constitute mini trax context that gather trax entities associated to a given functional context (e.g. data, processors and sub-stores). More on stores [here][stores].
- **Objects** that gather functional data into a JSON object. The object properties could be of primitive types (string, number, boolean) or other trax objects or arrays
- **Arrays** that gather functional data into a JSON array.
- **Processors** that wrap compute functions to produce computed values. More on processors [here][processors].

Trax unique ids are designed to be human-readable and are built though concatenation. As such each entity gets its own id format:
- Store ids:
    - root stores: **JS_IDENTIFIER** - e.g. *MyStore* or *TodoStore*
    - sub-stores (i.e. stores created in another store): **JS_IDENTIFIER(>JS_IDENTIFIER)+** - e.g. *MyStore>MySubStore>MySubSubStore*
- Objects and Arrays : **STORE_ID/DATA_PATH** - e.g.
    - store root object: *MyStore/root*
    - sub-objects with automatically generated ids (id is genereated from the path used to access the object for the first time): *MyStore/root\*author\*name*
    - properties: *MyStore/root\*author\*name.firstName* or *MyStore/root\*author.id*
    - data path built from another object - e.g. *SimpleFamilyStore/root:foo* (created through a id array like with ```myStore.add([fst.root, "foo"], { foo: "bar" });```)
    - data path build from several variables: *PersonStore/abc:123:def* (built from ```personStore.add(["abc", 123, "def"], { name: "Maggie" })```)

- Processor ids:
    - eager processors: **STORE_ID%PROCESSOR_NAME** - e.g. *PersonStore%prettyName*
    - lazy processors: **STORE_ID%OBJECT_PATH[PROCESSOR_NAME]** - e.g. *PersonStore%root[adult]*

Where
- JS_IDENTIFIER = valid JS identifier (no "/" or ">" or "%" signs)
- STORE_ID = store or sub-store id (can contain ">" signs)
- PROCESSOR_NAME = valid JS identifier (no "/" or ">" or "%" signs)

[stores]: ./stores.md
[processors]: ./processors.md

### ```isTraxObject(obj: any): boolean```

Tell if an object is a trax object.

```typescript
expect(trax.isTraxObject({})).toBe(false);
expect(trax.isTraxObject(123)).toBe(false);
const testStore = trax.createStore("TestStore", {foo: "bar"});
expect(trax.isTraxObject(testStore)).toBe(true);
expect(trax.isTraxObject(testStore.root)).toBe(true);
```

### ```getTraxId(obj: any): string```

Get the unique id associated to a trax object. Return an empty string if the object is not a trax object.

```typescript
expect(trax.getTraxId({})).toBe("");
const testStore = trax.createStore("TestStore", { foo: { bar: "baz" } });
expect(trax.getTraxId(testStore)).toBe("TestStore");
expect(trax.getTraxId(testStore.root)).toBe("TestStore/root");
expect(trax.getTraxId(testStore.root.foo)).toBe("TestStore/root*foo");
expect(trax.getTraxId(testStore.root.foo.bar)).toBe(""); // bar is not an object
```

### ```getTraxObjectType(obj: any): TraxObjectType```

Get the trax type associated to an object

```typescript
export enum TraxObjectType {
    NotATraxObject = "",
    Object = "O",
    Array = "A",
    Store = "S",
    Processor = "P"
}

// ex
expect(trax.getTraxObjectType({})).toBe(""); // TraxObjectType.NotATraxObject
const testStore = trax.createStore("TestStore", { foo: { bar: [1, 2, 3], baz: "abc" } });
expect(trax.getTraxObjectType(testStore)).toBe("S"); // TraxObjectType.Store
expect(trax.getTraxObjectType(testStore.root.foo)).toBe("O"); // TraxObjectType.Object
expect(trax.getTraxObjectType(testStore.root.foo.bar)).toBe("A"); // TraxObjectType.Array
```

### ```getData<T>(id: string): T | void```

Get a trax data object (object / array or dictionary). Note: only objects that have already been
accessed can be returned (otherwise their id is not yet defined)

```typescript
const testStore = trax.createStore("TestStore", { foo: { bar: [1, 2, 3], baz: "abc" } });
expect(trax.getData("TestStore/root")).toBe(testStore.root);
expect(trax.getData("TestStore/root*foo*bar")).toBe(undefined); // because testStore.root.foo.bar has never been accessed
const v = testStore.root.foo.bar
expect(trax.getData("TestStore/root*foo*bar")).toBe(testStore.root.foo.bar);
expect(trax.getData("XYZ")).toBe(undefined);
```

## Stores

Trax Stores are mini trax contexts that gather domain-related entities (i.e. data, processors and sub-stores). Stores fullfil two purposes:
- gather and expose domain-related data objects through a data graph (trax data objects are JSON structures that can be *observed* by processors and that can trigger update reactions)
- expose functional APIs associated to these data objects

Stores also hold compute processors that will automatically create/update/or delete data objects in the Store data graph.

Trax objects cannot be created outside data stores, this is why the **first operation** to perform to use trax is to **create a datastore**


### ```createStore(...)```

```typescript
createStore<T extends Object>(id: TraxIdDef, root: T): Store<T>;

createStore<T extends Object, R>( id: TraxIdDef, initFunction: (store: Store<T>) => R): R extends void ? Store<T> : R & StoreWrapper;
````

**createStore()** can be used in 2 different ways:
- either by providing a **store id** and the **initial data graph** (can be any JSON object)
- or by providing an **initialization function** that will initialize the data graph and optionally 1/ create compute processors and 2/ define a store API. When a store API object is returned, it will be returned by *createStore* and will hide the internal trax Store object - that will be returned otherwise.

Example #1: *Basic data store*
```typescript
const greetingStore = trax.createStore("Greeting", { message: "Hellow World" });

expect(greetingStore.root.message).toBe("Hellow World");    // root is the root element of the data graph
expect(greetingStore.id).toBe("Greeting");                  // store id is "Greeting"
```

Example #2: *Simple Todo store*
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

const todoStore = trax.createStore("Todos", (store: Store<TodoData>) => {
    const data = store.init({
        // initial root data
        todos: [],
        completedCount: 0,
        itemsLeft: 0
    });

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
```

### ```getStore<T>(id: string): Store<T> | void```

Retrieve a store from its id. Note: this method returns the **internal trax store** object, not the store API that may be returned by createStore
```typescript
// as per previous example
const gs = trax.getStore("Greeting");
expect(gs).toBe(greetingStore);
```

## Processors

### ```getProcessor(id: string): TraxProcessor | void```

Get a processor from its (full) trax id. Note trax processors have the following format
- eager processors: **STORE_ID%PROCESSOR_NAME** - e.g. *PersonStore%prettyName* in the example below
- lazy processors: **STORE_ID%OBJECT_PATH[PROCESSOR_NAME]** - e.g. *PersonStore%root[adult]* in the following example:

Example:
```typescript
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
            active1 = trax.getActiveProcessor()?.id || "";      // active1
        }
    });

    processor2 = store.compute("prettyName", () => {
        data.prettyName = data.firstName + " " + data.lastName
        active2 = trax.getActiveProcessor()?.id || "";          // active2
    });

    active3 = trax.getActiveProcessor()?.id || "";              // active3
});

expect(processorId1).toBe("PersonStore%root[adult]");
expect(processor2.id).toBe("PersonStore%prettyName");
expect(trax.getProcessor("PersonStore%prettyName")).toBe(processor2);
expect(trax.getProcessor(processorId1)!.id).toBe(processorId1);
```

### ```getActiveProcessor(): TraxProcessor | void```

Return the processor that is being computing (if getActiveProcessor() is called in a compute call stack). Return undefined otherwise.

Example:
```typescript
// cf. previous PersonStore store definition
expect(active1).toBe("PersonStore%root[adult]");
expect(active2).toBe("PersonStore%prettyName");
expect(active3).toBe("");
```
<a id="update"></a>

## Update life cycle

### ```reconciliation(): Promise<void>```

Trax update (i.e. change propagation) is performed asynchronously. This method returns a promise that
will be fulfilled when trax reconciliation is complete (i.e. at the end of the current cycle)
If there is no update cycle on-going, the promise will be immediately fulfilled

Example:
```typescript
// cf. previous PersonStore store definition
const data = personStore.root;
expect(data.prettyName).toBe("Homer Simpson");
data.firstName = "Marge";
expect(data.prettyName).toBe("Homer Simpson"); // change not yet propagated
await trax.reconciliation();
expect(data.prettyName).toBe("Marge Simpson"); // change propagated
```

Note: *trax.reconciliation()* returns when all processors have been called - but **it doesn't mean that the DOM
is fully updated** as DOM processors don't run in *autoCompute* mode (i.e. they don't run immediately) - so DOM changes must be observed through other means.

Note2: **lazy processors** are only run if an **eager processor** accesses the object on which they are anchored.

### ```readonly pendingChanges: boolean```

Tell if some changes are pending (i.e. dirty processors) Return false if there are no dirty processors - which means that all computed values can be safely read with no risks of invalid value

Example:
```typescript
// following previous example
expect(data.prettyName).toBe("Marge Simpson");
expect(trax.pendingChanges).toBe(false);
data.firstName = "Bart";
expect(trax.pendingChanges).toBe(true);
data.lastName = "SIMPSON";
expect(trax.pendingChanges).toBe(true);
await trax.reconciliation();
expect(data.prettyName).toBe("Bart SIMPSON");
expect(trax.pendingChanges).toBe(false);
```

### ```processChanges(): void```

Process the pending changes synchronoysly - i.e. run the dirty processors dependency chain.
This function will be automatically asynchronously called at the end of each trax cycle but it can be also explictly called if a synchronous behaviour is required

Example:
```typescript
// following previous example
expect(data.prettyName).toBe("Bart SIMPSON");
data.lastName = "Simpson";
data.firstName = "Lisa";
expect(data.prettyName).toBe("Bart SIMPSON"); // change not yet propagated
trax.processChanges();
expect(data.prettyName).toBe("Lisa Simpson"); // change propagated
```

## General utilities

### ```log: EventStream```

Get acess to the trax event logs. Main use cases for application developers:
- add application logs in the trax even streams.
- activate log in the console (can be quite verbose) - cf. ```trax.log.consoleOutput = "All"```

More info on the log event stream [here][events].

Example:
```typescript
trax.log.info("Sample Info Message", { foo: "Sample object"});
trax.log.warn("Sample Warning Message");
trax.log.error("Sample Error Message");

// Show log in the console
trax.log.consoleOutput = "All";
trax.log.consoleOutput = "AllButGet"; // All logs except property get
// Stop logging in the console
trax.log.consoleOutput = "None";
```

Another use

[events]: ./log.md

### ```updateArray(array: any[], newContent: any[]): void```

Helper function to **update the content of an array through mutations**, without changing its reference.
Must be used in processors generating computed array collections.
Note: this method will also flag the array as computed and will ensure errors are raised
if changes are made outside this processor

Example:
```typescript
familyStore.compute("Infos", () => {
    const content: any[] = [];
    if (members.length) {
        content.push({ desc: "D: " + members[0]?.firstName });
    }
    trax.updateArray(familyStore.infos, content);
});
```

### ```updateDictionary<T>(dict: { [k: string]: T }, newContent: { [k: string]: T }): void```

Helper function to **update the content of a dictionary object through mutations**, without changing its reference.
Must be used in processors generating computed dictionary collections.
Note: this method will also flag the dictionary as computed and will ensure errors are raised
if changes are made outside this processor.
Similar to ```updateArray``` but for dictionaries (i.e. *Object maps*).

```typescript
store.compute("Infos", () => {
    let infos = family.infos;
    if (!infos) {
        // create the dictionary
        infos = family.infos = {};
    }
    const members = family.members;
    const content: DictFamilyStore["infos"] = {};

    for (let k of trax.getObjectKeys(members)) {     // Use trax.getObjectKeys to trax property add/remove
        const m = members[k];
        const info = store.add(["Info", m], { desc: "" });
        info.desc = m.firstName + " " + m.lastName;
        content[k] = info;
    }
    trax.updateDictionary(infos, content);
});
```

### ```getObjectKeys(o: TraxObject): string[]```

Wrapper around Object.keys() that should be used in processors that read objects as dictionaries. This will allow processors to get dirty when properties are added or removed.

Example:
```typescript
// cf. previous example (updateDictionary)
for (let k of trax.getObjectKeys(members)) {     // Use trax.getObjectKeys to trax property add/remove
    const m = members[k];
    const info = store.add(["Info", m], { desc: "" });
    info.desc = m.firstName + " " + m.lastName;
    content[k] = info;
}
```
