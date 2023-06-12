
# Trax Preact Bindings

This package contains trax bindings for [preact] only, with no dependencies to react (this can be useful to load it through an import map)

They allow to wrap components into trax processors and have them automatically re-rendered when one of their dependencies change (no need to re-render the preact tree from the root);

This library mainly exports 4 functions
- ```component(...)```: to wrap a preact function component into a trax processor
- ```useTraxState(...)```: to create a simple reactive state object
- ```useStore(...)```: to instantiate a store and associate it to a component
- ```componentId()```: to retrieve the processor id associated to a given component (this function must be called in the component render function)

[preact]: https://preactjs.com/

## component()
```typescript
function component<T>(name: string, reactFunctionCpt: (props: T) => JSX.Element): (props: T) => JSX.Element {...}
```
Wrap a preact function component into a trax processor. Note: the function component will be then considered as a pure component (Memo) and will only be re-rendered if
- one of its trax dependencies changed (these dependencies can be passed by any means,
e.g. props, contexts or even global variables)
- a property reference changes (i.e. new reference for objects) - like for any preact component

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

### useTraxState()
```typescript
function useTraxState<T extends Object>(state: T): T
```
Create a trax state object to hold state values associated to a component.
Note: this function should only be called once in a given component as multiple state values can be set in a given state object

Behind the scenes, ```useTraxState``` creates a simple store object and calls ```useStore``` - this is why it it is visible in the
Store section in the dev tools.
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
Return the id of the trax processor associated to a preact component when called in in the component render function. Useful to insert the component id in the component HTML (e.g. through the data-id attribute) to ease troubleshooting

Example:
```jsx
<div className="my-component" data-id={componentId()}> ... </div>
```


## resetReactEnv()
```typescript
function resetPreactEnv() {...}
```
Reset the internal "Preact" data store to restart from a blank state (Test environment only)

