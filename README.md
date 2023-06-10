
# Trax

Trax is a **reactive state management** library that simplifies and optimizes the update flow of [React] or [Preact] applications. Its purpose is similar to solutions like [redux], [mobx] or [preact signals].

--> Live demos: 🚀 [Todo MVC], [Google Search Results]

[Todo MVC]: https://traxjs.github.io/todomvc
[Google Search Results]: https://asimojs.github.io/dpademo/homer_simpson.html

Key features:
- **unique ids**: trax API design ensures that every trax object gets a unique id in order to support the best
troubleshooting experience through the trax dev tools (under construction)
- **asynchronous by design**: trax transformations (aka. compute processors) can run synchronous or asynchronous operations. Data updates are also propagated asynchronously in order to mutualize compute operations in case of consecutive changes.
- **event stream**: all trax operations are systematically logged in an event stream in oder to ease troubleshooting and simplify test synchronization (stream events can be awaited in test scripts).
- **collections**: support of complex reactive chains that involve computed collections (cf. examples)

[React]: https://react.dev/
[Preact]: https://preactjs.com/
[redux]: https://redux.js.org/
[mobx]: https://mobx.js.org/
[preact signals]: https://preactjs.com/guide/v10/signals/



## API documentation

- [Global trax object](./packages/trax/doc/trax.md)
- [Trax stores](./packages/trax/doc/stores.md)
- [Trax processors](./packages/trax/doc/processors.md)
- [Trax logs](./packages/trax/doc/log.md)


[Documentation under construction - please check trax [todomvc] implementation or other [examples]]


[todomvc]: https://github.com/traxjs/trax/tree/main/packages/todomvc
[examples]: https://github.com/traxjs/trax/tree/main/packages/examples



