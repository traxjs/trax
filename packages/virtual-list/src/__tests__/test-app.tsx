import React from 'react';
import { render } from 'preact';
import { Store, trax } from '@traxjs/trax';
import { VirtualList } from '../virtual-list';
import './test-app.css';

async function main() {
    const testStore = createTestStore();
    const data = testStore.data;

    render(<div>
        <VirtualList className="vls1" items={data.messages} />
    </div>, document.getElementById('main')!);
}

main();

interface TestData {
    messages: {
        expanded: boolean;
        title: string;
        text: string;
    }[]
}

function createTestStore() {
    return trax.createStore("TestStore", (store: Store<TestData>) => {
        const msgs: TestData["messages"] = [];
        // initial values
        for (let i = 0; 100 > i; i++) {
            msgs.push({
                expanded: false,
                title: `Message #${i}`,
                text: `[text for message #${i}]`
            });
        }

        const data = store.init({
            messages: msgs
        })

        return {
            data
        }
    });
}