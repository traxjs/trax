import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { createListStore } from './liststore';
import { SimpleList } from './simplelist';

async function main() {
    const root = ReactDOM.createRoot(document.getElementById('main')!);

    const ls = createListStore();
    root.render(<SimpleList list={ls}/>);
}

main();
