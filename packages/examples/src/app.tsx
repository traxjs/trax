import { render } from 'preact';
import { Counter } from './counter/counter';
import { RcPlayground } from './radarchart/playground';
import { MessageBoard } from './messageboard/messageboard';
import './app.css';

async function main() {
    render(<div>
        <Counter />
        <hr/>
        <RcPlayground />
        <hr/>
        <MessageBoard/>
    </div>, document.getElementById('main')!);
}

main();