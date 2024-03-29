
# Trax Processors

<!-- Table of content -->
* [**Principle**](#principle)
* [**Lazy** and **eager** processors](#lazy-and-eager-processors)
* [Processor properties](#processor-properties)
    + [readonly **id**: TraxProcessorId](#readonly-id-traxprocessorid)
    + [readonly **dirty**: boolean](#readonly-dirty-boolean)
    + [readonly **dependencies**: string[]](#readonly-dependencies-string)
    + [readonly **autoCompute**: boolean](#readonly-autocompute-boolean)
    + [**onDirty**: (() => void) | null](#ondirty---void--null)
    + [readonly **priority**: number](#readonly-priority-number)
    + [readonly **computeCount**: number](#readonly-computecount-number)
    + [readonly **isLazy**: boolean](#readonly-islazy-boolean)
    + [readonly **isRenderer**: boolean](#readonly-isrenderer-boolean)
    + [readonly **disposed**: boolean](#readonly-disposed-boolean)
* [Processor methods](#processor-methods)
    + [**compute**(forceExecution?: boolean): void](#computeforceexecution-boolean-void)
    + [**dispose**(): boolean](#dispose-boolean)


## Principle

Trax processors are the trax core entities associated to compute functions that produce new values (e.g. strings/objects/collections) from other trax objects. The principle used by trax processors is very simple:
- when running a processor compute function, trax identifies all its dependencies (i.e. all the **(object,property) pairs** that have been read) and start **tracking** them
- when a processor dependency changes, trax sets the processor **dirty**
- dirty processors are then **automatically re-rerun** (this depends on the processor's nature - cf. *eager* vs. *lazy*). The change propagation process (aka. **reconciliation**) is asynchronous and runs in batches (aka. **trax cycle**).

## Lazy and eager processors

Trax supports both **synchronous** and **asynchronous** compute functions that can can either run **eagerly** or **lazyly**.
- **eager** processors are systematically re-rerun when they get dirty, even if the data they produce are not read. By default processors as set as *auto-compute* to have their compute function run automatically. When eager processors are set as *non-autocompute* their **onDirty** callback will be called instead of running the compute function (in a certain way non-autocompute processors sit between eager and lazy processors). Eager non-autocompute processors are typically used for renderer (e.g. React or Preact components - cf. [@traxjs/trax-react][trax-react] or [@traxjs/trax-preact][trax-preact]) that peform rendering asynchronously. Eager processors can be created through the **[store.compute][scompute]**, the **[store.init][sinit]** or **[store.add][sadd]** functions.
- **lazy** processors are not automatically re-rerun when they get dirty if the data they are associated to **is not read by another processor**. On the contrary to eager processors, lazy processors must be associated to a data object (e.g. the store root data object) that should be a **gate** to access the values produced by the processor (i.e. **lazy processors must only produce data accessed through their gate object**). If the gate is not accessed **by another processor** (such as a renderer), then the lazy processors don't need to run and are kept dirty. Lazy processors are created through the **[store.init][sinit]** or **[store.add][sadd]** functions and **their name must start with a ~ prefix**.

[trax-react]: https://github.com/traxjs/trax/tree/main/packages/trax-react
[trax-preact]: https://github.com/traxjs/trax/tree/main/packages/trax-preact
[scompute]: ./stores.md/#computeid-traxiddef-compute-traxcomputefn-autocompute-boolean-isrenderer-boolean-traxprocessor
[sinit]: ./stores.md#initroot-t-lazyprocessors-traxlazycomputedescriptort-t
[sadd]: ./stores.md#addt-extends-object--objectid-traxiddef-initvalue-t-lazyprocessors-traxlazycomputedescriptort-t


Lazy processor example:
```typescript
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
    store.init({ id: "U1", firstName: "Homer", lastName: "Simpson" }, {
        "~prettyName": (data) => {
            // lazy synchronous processor
            data.prettyName = data.firstName + " " + data.lastName;
        },
        "~avatar": function* (data) {
            // lazy asynchronous processor
            data.avatar = yield getAvatar(data.id);
        }
    });
});
const p1 = store1.data;

expect(p1.prettyName).toBe(undefined); // unprocessed
expect(p1.avatar).toBe(undefined); // unprocessed
await pause(10);
expect(p1.avatar).toBe(undefined); // still unprocessed

let output1 = "";
store1.compute("Output1", () => {
    output1 = `${p1.id} / ${p1.prettyName} / ${p1.avatar}`;
});

expect(output1).toBe('U1 / Homer Simpson / undefined'); // avatar not retrieved yet
await pause(10);
expect(output1).toBe('U1 / Homer Simpson / AVATAR[U1]'); // avatar retrieved
```

Eager processor example:
```typescript
// following previous example:
const store2 = trax.createStore("PersonStore2", (store: Store<Person>) => {
    store.init({ id: "U1", firstName: "Homer", lastName: "Simpson" }, {
        "prettyName": (d) => {
            // eager processor (no ~ prefix)
            d.prettyName = d.firstName + " " + d.lastName;
        },
        "avatar": function* (d) {
            // eager + asynchronous processor
            d.avatar = yield getAvatar(d.id);
        }
    });
});

const p2 = store2.data;
expect(p2.prettyName).toBe("Homer Simpson");
expect(p2.avatar).toBe(undefined); // being retrieved
await pause(10);
expect(p2.avatar).toBe("AVATAR[U1]"); // retrieved
```

Eager processor with compute() definition:
```typescript
// following previous example:
const store3 = trax.createStore("PersonStore3", (store: Store<Person>) => {
    const d = store.init({ id: "U1", firstName: "Homer", lastName: "Simpson" });

    store.compute("prettyName", () => {
        // eager + synchronous processor
        d.prettyName = d.firstName + " " + d.lastName;
    });

    store.compute("avatar", function* () {
        // eager + asynchronous processor
        d.avatar = yield getAvatar(d.id);
    });
});

const p3 = store3.data;
expect(p3.prettyName).toBe("Homer Simpson");
expect(p3.avatar).toBe(undefined); // being retrieved
await pause(10);
expect(p3.avatar).toBe("AVATAR[U1]"); // retrieved
```

## Processor properties
### ```readonly id: TraxProcessorId```

The absolute processor id. Note: eager and lazy processors use different id formats (cf. [trax ids][ids]).

[ids]: ./trax.md#trax-ids

```typescript
// cf. Person and getAvatar definitions in previous example
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

const p1 = store.getProcessor("data[prettyName]");

expect(p1!.id).toBe("PersonStore#data[prettyName]");
expect(p2!.id).toBe("PersonStore#Avatar");
```

### ```readonly dirty: boolean```
Tell if the processor is dirty (following a dependency update) and must be reprocessed.

```typescript
// following previous example
const person = store.data;
expect(p1.dirty).toBe(false);
expect(person.prettyName).toBe("Homer Simpson");
person.firstName = "Marge";
expect(p1.dirty).toBe(true);
expect(person.prettyName).toBe("Homer Simpson"); // change not propagated
await trax.reconciliation();
expect(p1.dirty).toBe(false);
expect(person.prettyName).toBe("Marge Simpson");
```
### ```readonly dependencies: string[]```
Get the ids of the processor's current dependencies identified during the last *compute()* call (cf. [trax ids][ids]).

```typescript
// following previous example
expect(p1.dependencies).toMatchObject([
    "PersonStore/data.firstName",
    "PersonStore/data.lastName",
]);
```

### ```readonly autoCompute: boolean```
Tell if the processor should automatically re-run the compute function when it gets dirty or not (in which case the processor creator should use the onDirty callback and eventually call compute() explicitely). Note **default=true.**

```typescript
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
expect(renderProcessor.dirty).toBe(false);
expect(renderResult).toBe("RENDER: LISA SIMPSON");

expect(renderProcessor.computeCount).toBe(2); // ran twice
expect(renderProcessor.dirty).toBe(false);
renderProcessor.compute();                    // will be ignored as renderProcessor is not dirty
expect(renderProcessor.computeCount).toBe(2); // still 2
renderProcessor.compute(true);                // forced re-render
expect(renderProcessor.computeCount).toBe(3); // 2 -> 3
```

### ```onDirty: (() => void) | null```
Callback to call when the processor value gets dirty. This callback is called synchronously, right after the processor gets dirty. Only one callback can be defined

Example: cf. [autoCompute](#readonly-autocompute-boolean)
### ```readonly priority: number```
Processor priority - tell how/when this processor should be called compared to other processors (in practice priority = creation order).

### ```readonly computeCount: number```
Tell how many times the processor compute function was called.

```typescript
// following previous example
// following previous example
let output = "";
const outputProcessor = store.compute("Output", () => {
    output = `Person[${person.id}] ${person.prettyName}`;
}, true, true); // last arg = isRenderer

expect(output).toBe("Person[U1] Marge Simpson");
expect(outputProcessor.isRenderer).toBe(true);
expect(outputProcessor.computeCount).toBe(1); // ran once
person.firstName = "BART";
person.lastName = "SIMPSON";
expect(outputProcessor.computeCount).toBe(1); // changes not propagated
await trax.reconciliation();
expect(outputProcessor.computeCount).toBe(2); // ran twice
expect(output).toBe("Person[U1] BART SIMPSON");
```

### ```readonly isLazy: boolean```
Tell if the processor is a lazy processor (Lazy processor names start with the ~ prefix).

### ```readonly isRenderer: boolean```
Tell if the processor was labeled as a renderer (debug info)

```typescript
// following previous example
expect(outputProcessor.isRenderer).toBe(true);
```
### ```readonly disposed: boolean```
Tell if the processor is disposed and is ready for garbage collection (when all external references are removed).

```typescript
// following previous example
expect(outputProcessor.disposed).toBe(false);
expect(outputProcessor.computeCount).toBe(2);
outputProcessor.dispose();
expect(outputProcessor.disposed).toBe(true);

// new changes will have no impacts
person.firstName = "MAGGIE";
await trax.reconciliation();
expect(outputProcessor.computeCount).toBe(2); // processor didn't run
```
## Processor methods
### ```compute(forceExecution?: boolean): void```
Execute the processor compute function if the processor is dirty. Parameters:
- **forceExecution** if true compute will be exececuted event if the processor is not dirty

Example: cf. [autoCompute example](#readonly-autocompute-boolean)
### ```dispose(): boolean```
Dispose the current processor to stop further compute and have it garbage collected

Example: cf. [disposed example](#readonly-disposed-boolean)

