import '../libs/page-script'; // Must be first in order to register the hook before trax is loaded
import { render } from 'preact';
import { MessageBoard } from './messageboard/messageboard';
import './app.css';
import { DevToolsFrame } from '../components/devtoolsframe/devtoolsframe';

async function main() {
    render(<div className='root-layout'>
        <div className='root-content'>
            <MessageBoard />
        </div>
        <div className='root-devtools'>
            <DevToolsFrame panelSrc='/src/panel/panel.html?theme=dark' />
        </div>
    </div>, document.getElementById('main')!);
}

main();