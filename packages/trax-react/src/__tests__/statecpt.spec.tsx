// @vitest-environment jsdom
import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { act, Simulate } from 'react-dom/test-utils';
import { resetReactEnv } from '..';
import { StateCpt } from './statecpt';

// workaround to remove react-dom/test-utils warnings
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('StateCpt', () => {
    let host: HTMLDivElement;

    async function init() {
        resetReactEnv();
        host = document.createElement('div');
        await act(async () => {
            const root = ReactDOM.createRoot(host);
            root.render(<StateCpt />);
        });
    }

    async function click(e: Element) {
        await act(async () => {
            Simulate.click(e);
        });
    }

    function valueSpans(idx: number) {
        return host.querySelectorAll("div.statecpt .value")![idx];
    }

    function content() {
        return `${valueSpans(0)!.innerHTML.trim()}/${valueSpans(1)!.innerHTML.trim()}/${valueSpans(2)!.innerHTML.trim()}`;
    }

    it('should support multiple state objects', async () => {
        await init();
        expect(valueSpans(3)!.innerHTML.trim()).toBe("State[StateCpt:1]/root");
        expect(valueSpans(4)!.innerHTML.trim()).toBe("State[StateCpt:1]1/root");
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

