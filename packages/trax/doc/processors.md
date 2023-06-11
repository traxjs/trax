
# Trax Processors

[Under construction]

<!-- Table of content -->
* [Lazy and eager processors](#lazy-and-eager-processors)
* [Processor properties](#processor-properties)
    + [readonly **id**: TraxProcessorId](#id)
    + [readonly **dirty**: boolean](#dirty)
    + [readonly **dependencies**: string[]](#dependencies)
    + [readonly **autoCompute**: boolean](#autoCompute)
    + [**onDirty**: (() => void) | null](#onDirty)
    + [readonly **priority**: number](#priority)
    + [readonly **computeCount**: number](#computeCount)
    + [readonly **isRenderer**: boolean](#isRenderer)
    + [readonly **disposed**: boolean](#disposed)
* [Processor methods](#processor-methods)
    + [**compute**(forceExecution?: boolean): void](#compute)
    + [**dispose**(): boolean](#dispose)


## Lazy and eager processors

TODO
## Processor properties
### <a id="id"></a>```readonly id: TraxProcessorId```
### <a id="dirty"></a>```readonly dirty: boolean```
### <a id="dependencies"></a>```readonly dependencies: string[]```
### <a id="autoCompute"></a>```readonly autoCompute: boolean```
### <a id="onDirty"></a>```onDirty: (() => void) | null```
### <a id="priority"></a>```readonly priority: number```
### <a id="computeCount"></a>```readonly computeCount: number```
### <a id="isRenderer"></a>```readonly isRenderer: boolean```
### <a id="disposed"></a>```readonly disposed: boolean```

## Processor methods
### <a id="compute"></a>```compute(forceExecution?: boolean): void```
### <a id="dispose"></a>```dispose(): boolean```

