import { createTraxEnv } from '@traxjs/trax/lib/core';
import { StreamEvent, Trax, traxEvents } from '@traxjs/trax/lib/types';
import { DtClientAPI, DtEventGroup } from '../types';


export function createClientEnv() {
    const trx = createTraxEnv();
    const log = trx.log;
    let active = false;
    let bufferCycle = -1;
    let buffer: StreamEvent[] = [];
    let bufferListener: (events: DtEventGroup) => void;

    const logSubscription = log.subscribe("*", (e) => {
        if (active) {
            const m = e.id.match(/^(\d+)\:/);
            if (!m) {
                console.error("Invalid id: " + e.id);
            } else {
                const cycleId = parseInt(m[1], 10);
                if (bufferCycle < 0) {
                    bufferCycle = cycleId;
                }
                if (e.type === traxEvents.CycleComplete || cycleId !== bufferCycle) {
                    if (e.type === traxEvents.CycleComplete) {
                        buffer.push(e);
                    } else {
                        // we shouldn't get here
                        console.error(`Invalid Cycle Ids: expected ${bufferCycle} / received ${cycleId}`);
                    }
                    // push last events
                    if (buffer.length) {
                        bufferListener && bufferListener({ cycleId: bufferCycle, events: buffer });
                        buffer = [];
                    }
                    // reset 
                    bufferCycle = -1;
                } else {
                    buffer.push(e);
                }
            }
        }
    });

    const clientAPI: DtClientAPI = {
        activateLogs() {
            active = true;
        },
        deactivateLogs() {
            active = false;
        },
        onChange(listener: (events: DtEventGroup) => void) {
            bufferListener = listener;
        }
    }

    return {
        get active() {
            return active;
        },
        init<T>(clientStoreFactory: (trx: Trax) => T): T {
            return clientStoreFactory(trx);
        },
        clientAPI,
        trx,
        log(msg: string) {
            log.info(msg);
        }
    }
}