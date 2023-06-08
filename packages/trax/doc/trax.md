
# trax

[Under construction]

<!-- Table of content -->
* [Stores](#stores)
    + [**createStore**(...)](#create-store)
    + [**getStore**<T>(id: string): Store<T> | void](#get-store)
* [Processors](#processors)
    + [**getProcessor**(id: string): TraxProcessor | void](#get-proc)
    + [**getActiveProcessor**(): TraxProcessor | void](#get-active-proc)
* [Update life-cycle](#update)
    + [**reconciliation**(): Promise<void>](#reconciliation)
    + [readonly **pendingChanges**: boolean](#pending-changes)
    + [**processChanges**(): void](#process-changes)
* [General utilities](#general)
    + [**isTraxObject**(obj: any): boolean](#isTraxObject)
    + [**getTraxId**(obj: any): string](#getTraxId)
    + [**getTraxObjectType**(obj: any): TraxObjectType](#getTraxObjectType)
    + [**getData**<T>(id: string): T | void](#getData)
    + [**log**: EventStream](#log)
* [Array utilities](#array)
    + [**updateArray**(array: any[], newContent: any[]): void](#updateArray)
* [Dictionary utilities](#dict)
    + [**updateDictionary**<T>(dict: { [k: string]: T }, newContent: { [k: string]: T }): void](#updateDictionary)
    + [**getObjectKeys**(o: TraxObject): string[]](#getObjectKeys)

## Stores

### <a id="create-store"></a>```createStore(...)```

createStore<T extends Object, R>(
        id: TraxIdDef,
        initFunction: (store: Store<T>) => R
    ): R extends void ? Store<T> : R & StoreWrapper;

createStore<T extends Object>(id: TraxIdDef, root: T): Store<T>;

### <a id="get-store"></a>```getStore<T>(id: string): Store<T> | void```

## Processors

### <a id="get-proc"></a>```getProcessor(id: string): TraxProcessor | void```
### <a id="get-active-proc"></a>```getActiveProcessor(): TraxProcessor | void```

## <a id="update"></a>Update life cycle

### <a id="reconciliation"></a>```reconciliation(): Promise<void>```
### <a id="pending-changes"></a>```readonly pendingChanges: boolean```
### <a id="process-changes"></a>```processChanges(): void```

## <a id="general"></a>General utilities

### <a id="isTraxObject"></a>```isTraxObject(obj: any): boolean```
### <a id="getTraxId"></a>```getTraxId(obj: any): string```
### <a id="getTraxObjectType"></a>```getTraxObjectType(obj: any): TraxObjectType```
### <a id="getData"></a>```getData<T>(id: string): T | void```
### <a id="log"></a>```log: EventStream```


## <a id="array"></a>Arrays Utilities
### <a id="updateArray"></a>```updateArray(array: any[], newContent: any[]): void```

## <a id="dict"></a>Dictionary Utilities
### <a id="updateDictionary"></a>```updateDictionary<T>(dict: { [k: string]: T }, newContent: { [k: string]: T }): void```
### <a id=""></a>```getObjectKeys(o: TraxObject): string[]```
