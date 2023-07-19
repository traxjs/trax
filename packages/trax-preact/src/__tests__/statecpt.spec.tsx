// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { resetPreactEnv } from '..';
import { StateCpt } from './statecpt';
import { render, fireEvent } from '@testing-library/preact';
import { trax, traxEvents } from '@traxjs/trax';

// workaround to remove react-dom/test-utils warnings
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('StateCpt', () => {
    let host: HTMLDivElement;

    async function init() {
        resetPreactEnv();
        const container = render(<div>
            <StateCpt />
        </div>);
        host = container.container as HTMLDivElement;
    }

    async function renderComplete() {
        return trax.log.awaitEvent(traxEvents.ProcessingEnd, { isRenderer: true });
    }

    async function click(e: Element) {
        e && fireEvent.click(e);
        await renderComplete();
    }

    function valueSpans(idx: number) {
        return host.querySelectorAll("div.statecpt .value")![idx];
    }

    function content() {
        return `${valueSpans(0)!.innerHTML.trim()}/${valueSpans(1)!.innerHTML.trim()}/${valueSpans(2)!.innerHTML.trim()}`;
    }

    it('should support multiple state objects', async () => {
        await init();
        expect(valueSpans(3)!.innerHTML.trim()).toBe("State[StateCpt:1]/data");
        expect(valueSpans(4)!.innerHTML.trim()).toBe("State[StateCpt:1]1/data");
    });

    it('should support counters increment on multiple state objects', async () => {
        await init();
        expect(content()).toBe("42/1984/123");

        await click(valueSpans(0));
        expect(content()).toBe("43/1984/123");

        await click(valueSpans(0));
        expect(content()).toBe("44/1984/123");

        await click(valueSpans(1));
        expect(content()).toBe("44/1985/123");

        await click(valueSpans(2));
        expect(content()).toBe("44/1985/124");
    });

});

