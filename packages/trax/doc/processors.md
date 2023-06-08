
# Trax Processors

[Under construction]

<!-- Table of content -->
* [Processor properties](#properties)
    + [readonly **id**: TraxProcessorId](#id)
    + [readonly **dirty**: boolean](#dirty)
    + [readonly **dependencies**: string[]](#dependencies)
    + [readonly **autoCompute**: boolean](#autoCompute)
    + [**onDirty**: (() => void) | null](#onDirty)
    + [readonly **priority**: number](#priority)
    + [readonly **computeCount**: number](#computeCount)
    + [readonly **isRenderer**: boolean](#isRenderer)
    + [readonly **disposed**: boolean](#disposed)
* [Processor methods](#methods)
    + [**compute**(forceExecution?: boolean): void](#compute)
    + [**dispose**(): boolean](#dispose)


## <a id="properties"></a>Processor properties
### <a id="id"></a>```readonly id: TraxProcessorId```
### <a id="dirty"></a>```readonly dirty: boolean```
### <a id="dependencies"></a>```readonly dependencies: string[]```
### <a id="autoCompute"></a>```readonly autoCompute: boolean```
### <a id="onDirty"></a>```onDirty: (() => void) | null```
### <a id="priority"></a>```readonly priority: number```
### <a id="computeCount"></a>```readonly computeCount: number```
### <a id="isRenderer"></a>```readonly isRenderer: boolean```
### <a id="disposed"></a>```readonly disposed: boolean```

## <a id="methods"></a>Processor methods
### <a id="compute"></a>```compute(forceExecution?: boolean): void```
### <a id="dispose"></a>```dispose(): boolean```

