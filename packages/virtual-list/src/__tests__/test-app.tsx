import React from 'react';
import { render } from 'preact';
import { VirtualList } from '../virtual-list';
import './test-app.css';

async function main() {
    render(<div>
        <VirtualList />
    </div>, document.getElementById('main')!);
}

main();
