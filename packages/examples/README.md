
# Trax Examples

This package contains typical trax examples implemented with [preact]

To run these examples you must first go to the root trax project and install & build all packages (```yarn install``` / ```yarn build```). Then you can come back to this package and:
```bash
# run the demo on a local webserver - e.g. http://localhost:5173/
yarn dev
# run the tests
yarn test
```

[preact]: https://preactjs.com/


## Example #1: Counter

The counter project demonstrate a very simple trax application that displays a self-incrementing counter. 

Despite its simpicity it showcases many trax concepts:
- how to implement a simple trax store (cf. ```createStore```)
- how to update store data (cf. ```data.count++```)
- how to implement store dispose logic (cf. ```dispose()```)
- how to implement and call store actions (cf. ```reset()```)
- how to create a react/preact component (cf. ```component()```)
- how to create a store instance for a given component (cf. ```useStore()```)
- how to call a store action (cf. ```onClick```)
- how to get the trax id associated to a component instance to ease troubleshooting (cf. ```componentId()```) 


## Example #2: Radar Chart

The radar chart example is a more advanced version of the Counter example. Even if it looks more complex, it only showcases two more features:

- how to create and test an independent store (cf. ```radarstore.ts```)
- how to declare and calculate computed values (cf. ```store.compute```)

Note: you can also check the trax [todomvc] implementation that showcases the same level of features with a more extensive set of actions

[todomvc]: https://github.com/traxjs/trax/tree/main/packages/todomvc


## Example #3: Message Board

The Message Board example demonstrates the full power of trax to implement advanced reactive chains involving multiple actors.

The Message Board example can be seen as the simplified version of a chat client that would receive unsolicited events from a server (e.g. through [SSE]). Technically the client would receive two types of data:
- messages (non sorted, eventually consistent) containing a few meta data (creation time, author id...)
- user information (name, avatar, online status)

The goal of the MessageBoard example is to aggregate those data and
- sort messages by timestamp (oldest first)
- group messages by users
- show user information at the beginning of each message group

The purpose of the reactive solution is to minimize the client operations to update the application when update events are received, such as
- new message received (can be older than the last message as the server is eventually consistent)
- message update (e.g. different text)
- message deletion
- user information update (new avatar, new name, online status update)

The example demonstrate
- how to build a multi-store solution (cf. ```messagestore```, ```userstore``` and ```messageboardstore```)
- how to implement computed objects - i.e. store objects that are dynamically created based on other object - cf. ```MessageGroup``` / ```currentMsgGroup```)
- how to support asynchronous transformations (cf. ```store.compute(["AuthorInfo"...```) to retrieve user data associated to a group of messages
- how to update mutable lists (cf. ```trax.updateArray```)

[example still under construction]

[SSE]: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
