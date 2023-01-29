
# Trax React Bindings

This package contains trax bindings for [react] and [preact].

They allow to wrap components into trax processors and have them automatically re-rendered when one of their dependencies change (no need to re-render the react tree from the root);

This library main exports 3 functions
- ```component(...)```: to wrap a react/preact function component into a trax processor
- ```useStore(...)```: to instantiate a store and associate it to a component
- ```componentId()```: to retrieve the processor id associated to a given component (this function must be called in the component render function)

[react]: https://reactjs.org/
[preact]: https://preactjs.com/

## component()
```typescript
function component<T>(name: string, reactFunctionCpt: (props: T) => JSX.Element): (props: T) => JSX.Element {...}
```
Wrap a react function component into a trax processor. Note: the function component will be then considered as a pure component (Memo) and will only be re-rendered if
- one of its trax dependencies changed (these dependencies can be passed by any means, 
e.g. props, contexts or even global variables)
- a property reference changes (i.e. new reference for objects) - like for any react component

Parameters:
- ```name``` the compontent name - usually the same as the component function
- ```reactFunctionCpt``` the functional component

Example:
```typescript
export const TodoList = component("TodoList", () => {
    const tds = useStore(createTodoStore);

    return <div data-id={componentId()} className='todoList'>
        ...
    </div>
});
```

### useStore()
```typescript
function useStore<T = any>(factory: () => T): T {...}
```
Helper function to create or retrieve a store instance attached to the caller component

- ```factory``` a factory function to create the store instance
- ```returns``` the store object

Example:
```jsx
<div className="my-component" data-id={componentId()}> ... </div>
```

## componentId()

```typescript
function componentId(): string {...}
```
Return the id of the trax processor associated to a react component when called in in the component render function. Useful to insert the component id in the component HTML (e.g. through the data-id attribute) to ease troubleshooting

Example:
```jsx
<div className="my-component" data-id={componentId()}> ... </div>
```



## resetReactEnv()
```typescript
function resetReactEnv() {...}
```
Reset the internal React data store to restart from a blank state (Test environment only)

