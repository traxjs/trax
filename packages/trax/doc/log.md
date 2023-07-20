
# trax log stream

<!-- Table of content -->
* [Properties](#properties)
    + [**size**: number](#size-number)
    + [**maxSize**: number](#maxsize-number)
    + [**consoleOutput**: ConsoleOutput](#consoleoutput-consoleoutput)
* [Logging events](#logging-events)
    + [**info**(...data: LogData[]): void](#infodata-logdata-void)
    + [**warn**(...data: LogData[]): void](#warndata-logdata-void)
    + [**error**(...data: LogData[]): void](#errordata-logdata-void)
    + [**event**(type: string, data?: LogData, src?: any): void](#eventtype-string-data-logdata-src-any-void)
    + [**startProcessingContext**(data: ProcessingContextData, src?: any): ProcessingContext](#startprocessingcontextdata-processingcontextdata-src-any-processingcontext)
* [Reading events](#reading-events)
    + [**scan**(eventProcessor: (itm: StreamEvent) => void | boolean): void](#scaneventprocessor-itm-streamevent--void--boolean-void)
    + [**lastEvent**(): StreamEvent | undefined](#lastevent-streamevent--undefined)
* [Getting notified](#getting-notified)
    + [**awaitEvent**(eventType: string | "*", targetData?: string | number | boolean | Record<string, string | number | boolean | RegExp>): Promise<StreamEvent>](#awaiteventeventtype-string---targetdata-string--number--boolean--recordstring-string--number--boolean--regexp-promisestreamevent)
    + [**subscribe**(eventType: string | "*", callback: (e: StreamEvent) => void): SubscriptionId](#subscribeeventtype-string---callback-e-streamevent--void-subscriptionid)
    + [**unsubscribe**(subscriptionId: SubscriptionId): boolean](#unsubscribesubscriptionid-subscriptionid-boolean)
* [**Trax events**](#trax-events)

Trax systematically logs its events in an event stream that can be used to extract debug information.
By default trax only keeps the most recent logs to avoid any noticeable memory fooprint (cf. [maxSize] property).


[maxSize]: #maxsize-number
## Properties
### ```size: number```
Number of items in the stream. When the number of items reaches **maxSize**, the oldest stream items are removed to let the new items in.
### ```maxSize: number```
Stream max size. Use -1 to specify no limits - otherwise minimum size will be 2.
Default: 1000.

```typescript
// start console log
expect(trax.log.maxSize).toBe(1000);  // default value
trax.log.maxSize = 5000;              // increase log buffer size
```
### ```consoleOutput: ConsoleOutput```
Tell if logs should be logged on the console. Useful in jest/vitest environments where dev tools are not available
Possible values:
- **""**: no output
- **"Main"**: most significant logs (writes + explicit logs + dirty changes + re-processing + non trax events)
- **"AllButGet"**: log all events except Cycle Start/End and Property Getters
- **"All"**: log all events except Cycle Start/End

```typescript
type ConsoleOutput = "" | "Main" | "AllButGet" | "All";

// start console log
trax.log.consoleOutput = "All";

// all trax operations occuring between these 2 calls will be logged in the console

// stop console log
trax.log.consoleOutput = "";
```

## Logging events
### ```info(...data: LogData[]): void```
Log info data in the trax logs (data arguments will be converted to strings with JSON.stringify).
```typescript
trax.log.info("Simple log message with numbers:", 123);
```

### ```warn(...data: LogData[]): void```
Log warning data in the trax logs (data arguments will be converted to strings with JSON.stringify).
```typescript
trax.log.warn("Sample Warning Message");
```
### ```error(...data: LogData[]): void```
Log error data in the trax logs (data arguments will be converted to strings with JSON.stringify).
```typescript
trax.log.error("Sample Error Message");
```
### ```event(type: string, data?: LogData, src?: any): void```
Log a custom event that can be awaited thanks to [awaitEvent()]. Parameters:
- **type** unique event type - e.g. "namespace.name", cannot start with "!" (reserved for trax events)
- **data** event data - must support JSON.stringify
- **src** optional event source - used for internal trax events only

[awaitEvent()]: #awaiteventeventtype-string---targetdata-string--number--boolean--recordstring-string--number--boolean--regexp-promisestreamevent

```typescript
// sample store API method
async function updateName(value1: string, value2: string) {
    data.firstName += value1;
    await pause(1);
    // custom event used to synchronize tests (cf. awaitEvent)
    trax.log.event("@traxjs/trax/test/updateNameAsyncDone");
    data.lastName += value2;
}
```
### ```startProcessingContext(data: ProcessingContextData, src?: any): ProcessingContext```
Create a processing context and raise a start event in the event stream.
**Processing contexts** are used to virtually **regroup events** that occur in a given context (e.g. an async function call) and that can span over several cycles when they involve asynchronous operations. Processing contexts can be stacked. This function requires the following parameter:
- **data** data associated with the processing context. Must contain a name (e.g. process name)
and may contain an id (useful for awaitEvent())
```typescript
type ProcessingContextData = { name: string, id?: string } & { [key: string]: JSONValue };

interface ProcessingContext {
    id: string;
    /** Raise a pause event in the event stream */
    pause(): void;
    /** Raise a resume event in the event stream */
    resume(): void;
    /** Raise an end event in the event stream */
    end(): void;
}
```
Example:
```typescript
log.info("A");
// start a new processing context
const c = log.startProcessingContext({ name: 'MyAsyncAction' });
log.info("B");
log.info("C");
c.pause();
log.info("D");

await log.awaitEvent(traxEvents.CycleComplete);
c.resume();
log.info("E");
c.pause();

await log.awaitEvent(traxEvents.CycleComplete);
c.resume();
log.info("F");
c.end();
log.info("G");

// logs that will appear in the console if trax.log.consoleOutput = "All";
expect(printLogs()).toMatchObject([
    '0:1 !LOG - A',
    '0:2 !PCS - MyAsyncAction',   // PCS = Processing Context Start (in cycle 0, context id=0:2)
    '0:3 !LOG - B',
    '0:4 !LOG - C',
    '0:5 !PCP - 0:2',             // PCP = Processing Context Pause
    '0:6 !LOG - D',
    '1:1 !PCR - 0:2',
    '1:2 !LOG - E',
    '1:3 !PCP - 0:2',
    '2:1 !PCR - 0:2',             // PCR = Processing Context Resume
    '2:2 !LOG - F',
    '2:3 !PCE - 0:2',             // PCE = Processing Context End (in cycle 2, context id=0:2)
    '2:4 !LOG - G',
]);
```

## Reading events
### ```scan(eventProcessor: (itm: StreamEvent) => void | boolean): void```
Scan all current entries in the log stream (oldest to newest). Parameter:
- **eventProcessor** the function called for each event - can return false to stop the scan
```typescript
interface StreamEvent {
    /**
     * Unique id composed of 2 numbers: cycle id and event count
     * e.g. 42:12 where 42 is the cycle index and 12 the event count within cycle #42
     */
    id: string;
    /** Event type - allows to determine how to interprete data */
    type: string;
    /** Event data - JSON stringified */
    data?: string;
    /** Id of another event that the current event relates to */
    parentId?: string;
}
```

Example:
```typescript
// Retrieve all events and store them in an array
const arr: StreamEvent[] = [];
trax.log.scan((itm: StreamEvent) => {
    arr.push(itm);
});
```

### ```lastEvent(): StreamEvent | undefined```
Return the last event added to the stream.
```typescript
log.info("A");
expect(log.lastEvent()!.type).toBe(traxEvents.Info);
```
## Getting notified
### ```awaitEvent(eventType: string | "*", targetData?: string | number | boolean | Record<string, string | number | boolean | RegExp>): Promise<StreamEvent>```
Await a certain event. Parameters:
- **eventType** the event type (trax or custom event).
- **targetData** [optional] value or fields that should be matched against the event data (depends on the event type)

```typescript
// await a trax event (here the end of the current cycle)
await trax.log.await(traxEvents.CycleComplete);
expect(trax.log.lastEvent()!.type).toBe(traxEvents.CycleComplete);

// await a custom event (cf. previous example with trax.log.event(...))
await trax.log.awaitEvent("@traxjs/trax/test/updateNameAsyncDone");
```
### ```subscribe(eventType: string | "*", callback: (e: StreamEvent) => void): SubscriptionId```
Register an event consumer that will be synchronously called when a given event occurs.
- **eventType** an event type or "*" to listen to all events
- **callback** function called when the event is logged

Returns a subscribtion id that will be used to unsubscribe.
```typescript
let traces = "";
function cb(e: StreamEvent) {
    traces += e.id + "/" + e.type + ";"

const s1 = log.subscribe("*", cb);
log.info("A");
expect(traces).toBe("0:0/!CS;0:1/!LOG;"); // CS = Cycle Start, LOG=log.info
```
### ```unsubscribe(subscriptionId: SubscriptionId): boolean```
Unregister an event consumer. Returns true if the consumer was found and succesfully unregistered.
```typescript
// following previous example
const r1 = log.unsubscribe(s1);
expect(r1).toBe(true);
```

## Trax events

Here is the complete lists of the events that can be raised by trax:

```typescript
/**
 * Trax event types
 * Internal code start with "!" to avoid collisions with external events
 * (not an enum to avoid potential minifier issues)
 */
export const traxEvents = Object.freeze({
    /** When info data are logged */
    "Info": "!LOG",
    /** When a warning is logged */
    "Warning": "!WRN",
    /** When an error is logged */
    "Error": "!ERR",
    /** When a cycle is created */
    "CycleStart": "!CS",
    /** When a cycle ends */
    "CycleComplete": "!CC",

    /** When a trax entity is created (e.g. object / processor / store)  */
    "New": "!NEW",
    /** When a trax entity is disposed (e.g. object / processor / store)  */
    "Dispose": "!DEL",
    /** When an object property is set (changed) */
    "Set": "!SET",
    /** When an object property is read */
    "Get": "!GET",
    /** When a processor is set dirty */
    "ProcessorDirty": "!DRT",
    /** When a lazy processor is skipped */
    "ProcessorSkipped": "!SKP",

    /** When a processing context starts */
    "ProcessingStart": "!PCS",
    /** When an async  processing context pauses */
    "ProcessingPause": "!PCP",
    /** When an async  processing context resumes */
    "ProcessingResume": "!PCR",
    /** When a processing context ends */
    "ProcessingEnd": "!PCE"
});
```

Note: all trax event data structures are fully typed (cf. [TraxLogEvent definition]).

[TraxLogEvent definition]: https://github.com/traxjs/trax/blob/main/packages/trax/src/types.ts
