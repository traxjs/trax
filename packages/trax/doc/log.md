
# trax log stream

[Under construction]

<!-- Table of content -->
* [Properties](#properties)
    + [**size**: number](#size)
    + [**maxSize**: number](#maxSize)
    + [**consoleOutput**: "None" | "All" | "AllButGet"](#consoleOutput)
* [Logging events](#log-events)
    + [**info**(...data: LogData[]): void](#info)
    + [**warn**(...data: LogData[]): void](#warn)
    + [**error**(...data: LogData[]): void](#error)
    + [**event**(type: string, data?: LogData, src?: any): void](#event)
    + [**startProcessingContext**(data: ProcessingContextData, src?: any): ProcessingContext](#startProcessingContext)
* [Reading events](#read-events)
    + [**scan**(eventProcessor: (itm: StreamEvent) => void | boolean): void](#scan)
    + [**lastEvent**(): StreamEvent | undefined](#lastEvent)
* [Getting notified](#notification)
    + [**awaitEvent**(eventType: string | "*", targetData?: string | number | boolean | Record<string, string | number | boolean | RegExp>): Promise<StreamEvent>](#awaitEvent)
    + [**subscribe**(eventType: string | "*", callback: (e: StreamEvent) => void): SubscriptionId](#subscribe)
    + [**unsubscribe**(subscriptionId: SubscriptionId): boolean](#unsubscribe)

## <a id="properties"></a> Properties
### <a id="size"></a>```size: number```
### <a id="maxSize"></a>```maxSize: number```
### <a id="consoleOutput"></a>```consoleOutput: "None" | "All" | "AllButGet"```

## <a id="log-events"></a> Logging events
### <a id="info"></a>```info(...data: LogData[]): void```
### <a id="warn"></a>```warn(...data: LogData[]): void```
### <a id="error"></a>```error(...data: LogData[]): void```
### <a id="event"></a>```event(type: string, data?: LogData, src?: any): void```
### <a id="startProcessingContext"></a>```startProcessingContext(data: ProcessingContextData, src?: any): ProcessingContext```

## <a id="read-events"></a> Reading events
### <a id="scan"></a>```scan(eventProcessor: (itm: StreamEvent) => void | boolean): void```
### <a id="lastEvent"></a>```lastEvent(): StreamEvent | undefined```

## <a id="notification"></a> Getting notified
### <a id="awaitEvent"></a>```awaitEvent(eventType: string | "*", targetData?: string | number | boolean | Record<string, string | number | boolean | RegExp>): Promise<StreamEvent>```
### <a id="subscribe"></a>```subscribe(eventType: string | "*", callback: (e: StreamEvent) => void): SubscriptionId```
### <a id="unsubscribe"></a>```unsubscribe(subscriptionId: SubscriptionId): boolean```

