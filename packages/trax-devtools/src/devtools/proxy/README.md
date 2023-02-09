
# Cross application communication

The developer tools and the trax application that it is monitoring usually don't live in the same context, so the dev tools have to use a cross-context communication protocol.

In practice we have to support 3 different configurations:
- the dev tools deployed as a browser extension, where the devtools resides in an extension context and the application in a browser tab/window
- the iframe environment used in the test application. In this case the devtools are loaded in an child iframe loaded in the application window
- the unit test environment where both application and devtools run in the same context (i.e. node/jsdom) - in this case we create 2 separate trax contexts as the devtools cannot use the same trax instance as the application

In all cases the communication protocol involves the ClientProxy/ClientAPI pair, where
- the ClientProxy resides in the application context. 
- the Client API resides in the devtools context

The ClientProxy purpose is to connect to trax, forward logs to the devtools and execute actions submitted by the devtools. 
On the opposite side, the ClientAPI purpose is to expose a subset of the trax APIs to the devtools. Behind the scenes the ClientAPI communicates with the Client Proxy to execute actions, send async results and push logs.

```
# Communication summary
Application -> Trax <-> Client Proxy <---> Client API <- DevTools
```

When the devtools are deployed as a browser extension, the communication has to go through different scripts (aka. background and content script):

```
# Devtools in a browser extension environment
Client Proxy (injected by the background Script) <---> Content Script <---> Background Script (Worker)  <---> DevTools page (Hidden) <---> Client API (in DevTools panel.html)
```

In the iframe environment, the communication channel is more simple:
```
# Devtools in an iframe
Client Proxy (embedded in the application page) <---> Client API (in DevTools panel.html)
```
