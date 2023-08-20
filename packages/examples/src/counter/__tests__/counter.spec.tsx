import React from "react";
import { trax, traxEvents } from "@traxjs/trax";
import { beforeEach, describe, expect, it } from "vitest";
import { createCounterStore, Counter, Timer } from "../counter";
import { resetReactEnv } from "@traxjs/trax-react";
import { render, fireEvent, RenderResult } from "@testing-library/preact";

describe("Counter", () => {
    const intervalId = {};
    let lastIntervalMs: number, setIntervalCount: number, setIntervalCb: () => void;
    let clearIntervalCount: number, lastClearIntervalId: any;
    let timer: Timer;

    beforeEach(() => {
        // mock setInterval
        lastIntervalMs = -1;
        setIntervalCount = 0;
        clearIntervalCount = 0;
        lastClearIntervalId = null;

        setIntervalCb = () => {};
        timer = {
            setInterval(cb: () => void, ms?: number) {
                lastIntervalMs = ms || 0;
                setIntervalCount++;
                setIntervalCb = cb;
                return intervalId;
            },
            clearInterval(id: any) {
                clearIntervalCount++;
                lastClearIntervalId = id;
            },
        };
    });

    describe("Store", () => {
        it("should support init / reset / dipose", async function () {
            const cs = createCounterStore(timer);
            expect(setIntervalCount).toBe(1);
            expect(cs.data.count).toBe(0);
            expect(lastIntervalMs).toBe(1001);

            setIntervalCb();
            await trax.reconciliation(); // not really needed here as ther is no processor
            expect(cs.data.count).toBe(1);

            setIntervalCb();
            await trax.reconciliation();
            expect(cs.data.count).toBe(2);

            setIntervalCb();
            await trax.reconciliation();
            expect(cs.data.count).toBe(3);

            // reset
            cs.reset();
            await trax.reconciliation();
            expect(cs.data.count).toBe(0);

            setIntervalCb();
            await trax.reconciliation();
            expect(cs.data.count).toBe(1);

            // dispose
            expect(clearIntervalCount).toBe(0);
            cs.dispose();
            await trax.reconciliation();
            expect(clearIntervalCount).toBe(1);
            expect(lastClearIntervalId).toBe(intervalId);

            expect(setIntervalCount).toBe(1);
        });
    });

    describe("Component", () => {
        let container: RenderResult;

        beforeEach(() => {
            resetReactEnv();
            container = render(
                <div>
                    <Counter timer={timer} />
                </div>
            );
        });

        async function renderComplete() {
            return trax.log.awaitEvent(traxEvents.ProcessingEnd, { isRenderer: true });
        }

        function counterDiv() {
            return container.container.querySelector("div.counter")! as HTMLDivElement;
        }

        function counterValue() {
            return counterDiv().querySelector(".counter-value")!.innerHTML.trim();
        }

        it("should render and reset counter", async () => {
            expect(counterDiv().dataset.id).toBe("React#Counter:1");
            expect(counterValue()).toBe("0");
            setIntervalCb();
            await renderComplete();
            expect(counterValue()).toBe("1");
            setIntervalCb();
            await renderComplete();
            expect(counterValue()).toBe("2");

            // reset
            fireEvent.click(counterDiv());
            await renderComplete();
            expect(counterValue()).toBe("0");
            setIntervalCb();
            await renderComplete();
            expect(counterValue()).toBe("1");
        });
    });
});
