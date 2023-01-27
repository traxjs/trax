import { render } from 'preact';
import { Counter } from './counter/counter';

async function main() {
    render(<div>
        <Counter />
    </div>, document.getElementById('main')!);
}

main();