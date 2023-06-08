
# Trax Stores

[Under construction]

<!-- Table of content -->
* [Store properties](#properties)
    + [readonly **id**: string](#id)
    + [readonly **root**: T](#root)
    + [readonly **disposed**: boolean](#disposed)
* [Store Life Cycle](#life-cycle)
    + [**init**(root: T, lazyProcessors?: TraxLazyComputeDescriptor<T>): T](#init)
    + [**dispose**(): boolean](#dispose)
* [Store data](#data)
    + [**add**<T extends Object | Object[]>(id: TraxIdDef, initValue: T, lazyProcessors?: TraxLazyComputeDescriptor<T>): T](#add)
    + [**get**<T extends Object>(id: TraxIdDef): T | void](#get)
    + [**remove**<T extends Object>(dataObject: T): boolean](#remove)
* [Store processors](#processors)
    + [**compute**(id: TraxIdDef, compute: TraxComputeFn, autoCompute?: boolean, isRenderer?: boolean): TraxProcessor](#compute)
    + [**getProcessor**(id: TraxIdDef): TraxProcessor | void](#getProcessor)
* [Sub stores](#sub-stores)
    + [**createStore**(...)](#createStore)
    + [**getStore**<T>(id: TraxIdDef): Store<T> | void](#getStore)
* [Utilities](#utilities)
    + [**async**(...)](#async)

## <a id="properties"></a>Store properties
### <a id="id"></a>```readonly id: string```
### <a id="root"></a>```readonly root: T```
### <a id="disposed"></a>```disposed```

## <a id="life-cycle"></a>Store Life Cycle

### <a id="init"></a>```init(root: T, lazyProcessors?: TraxLazyComputeDescriptor<T>): T```
### <a id="dispose"></a>```dispose(): boolean```

## <a id="data"></a>Store data

### <a id="add"></a>```add<T extends Object | Object[]>(id: TraxIdDef, initValue: T, lazyProcessors?: TraxLazyComputeDescriptor<T>): T```
### <a id="get"></a>```get<T extends Object>(id: TraxIdDef): T | void```
### <a id="remove"></a>```remove<T extends Object>(dataObject: T): boolean```

## <a id="processors"></a>Store processors
### <a id="compute"></a>```compute(id: TraxIdDef, compute: TraxComputeFn, autoCompute?: boolean, isRenderer?: boolean): TraxProcessor```
### <a id="getProcessor"></a>```getProcessor(id: TraxIdDef): TraxProcessor | void```


## <a id="sub-stores"></a>Sub-stores
### <a id="createStore"></a>```createStore(...)```
### <a id="getStore"></a>```getStore<T>(id: TraxIdDef): Store<T> | void```


##  <a id="utilities"></a>Utilities
### <a id="async"></a>```async(...)```

