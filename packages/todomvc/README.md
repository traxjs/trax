# Trax TodoMVC

This package contains a full implementation of the [TodoMVC] application with trax and [react]

To run this example you must first go to the root trax project and install & build all packages (```yarn install``` / ```yarn build```). Then you can come back to this package and:
```bash
# run the demo on a local webserver - e.g. http://localhost:5173/
yarn dev
# run the tests
yarn test
```

The TodoMVC application showcases several interesting use cases such as
- create, update and delete operations on a list
- list filtering and sorting
- maintaining accurate computed information (cf. number of non-completed items)

The trax implementation is composed of 2 files:

- a reactive store (```todostore```) that contain all the application logic. It maintains a list of Todo objects, define all actions called by the react components and ensure the consistency of computed values (i.e. list filter and number of uncompleted items - cf. ```store.compute```)
- a todolist component that instantiates the todostore and maps all todo data to the DOM. It is interesting to note that with the trax model react components don't really hold state anymore and only consist of mapping logic (which makes them easier to implement and test)


Note: the test suite also demonstrates how trax internal events can be used to synchronize asynchronous tests (cf. ```log.awaitEvent```)

[react]: https://reactjs.org/
[TodoMVC]: https://todomvc.com/