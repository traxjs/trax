import { render } from 'preact';
import { DevTools } from '../devtools/devtools';
import { createClientAPI } from '../devtools/proxy/clientApi';
import { createPostMsgStub } from '../devtools/proxy/msgStub';
import { DtMessageStub } from '../devtools/proxy/types';
// import { Counter } from './counter/counter';
import './panel.css';

async function main() {
    const mainDiv = document.getElementById('main')!;
    mainDiv.innerHTML = "";

    let stub: DtMessageStub;
    const m = window.location.href.match(/mode=iframe/);
    if (m) {
        stub = createPostMsgStub(window.parent); // iframe mode
    } else {
        console.error("TODO: support port stub (browser extension env)");
        // cf.
        // const bkgConnection = chrome.runtime.connect({
        //     name: SCRIPT_NAME
        // });
        // bkgConnection.onDisconnect.addListener(() => {
        //     trace("TODO: TELL CS to stop sending Events")
        // });
        // bkgConnection.onMessage.addListener((msg) => {
        //     if (msg.tabId && msg.tabId === tabId) {
        //         tabId = msg.tabId;

        //         trace(`Message Received`);
        //     } else {
        //         warn(`Message Dropped (invalid tabId)`, msg);
        //     }
        // });
    }

    const api = createClientAPI(stub!);

    render(<div>
        <DevTools clientAPI={api}/>
    </div>, document.getElementById('main')!);
}

main();
