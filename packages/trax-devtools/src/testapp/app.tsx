import { render } from 'preact';
import { MessageBoard } from './messageboard/messageboard';
import { DevToolsFrame } from '../devtools/devtoolsframe/devtoolsframe';
import './app.css';

async function main() {
    render(<div className='root-layout'>
        <div className='root-content'>
            <MessageBoard />
        </div>
        <div className='root-devtools'>
            <DevToolsFrame panelSrc='/src/panel/panel.html' theme='dark'/>
        </div>
    </div>, document.getElementById('main')!);
}

main();
