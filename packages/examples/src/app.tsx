import { render } from 'preact';
import { Counter } from './counter/counter';
import { RcPlayground } from './radarchart/playground';
import './app.css';

async function main() {
    render(<div>
        {/* <Counter /> */}
        <RcPlayground />
    </div>, document.getElementById('main')!);
}

main();