import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { BasicList } from './basiclist';
import { createListStore } from './liststore';
import { SimpleList } from './simplelist';

async function main() {
    const root = ReactDOM.createRoot(document.getElementById('main')!);

    const ls = createListStore();
    root.render(<>
        <BasicList />
        <hr />
        <SimpleList list={ls} />
    </>);
}

main();
