
/**
 * This file has to be injected in the application page. This can be done in 2 ways:
 * - in an iframe envionment: by referencing the lib manually (cf. test app)
 * - in dev tools extention environment, through the background script
 * It exposes a hook to the trax library (__TRAX_DEVTOOLS__ global varialbe) that will allow trax 
 * to register on this script.
 * When trax has registered this script will communicate with the devtools application (panel.html)
 * Again, 2 possible options:
 * - in iframe environment: thanks to postMessage communication with the panel page
 * - in dev tools extention environment thanks to postMessage with the content script (that will forward
 * to the background script, that will forward to the panel page)
 */

import { Trax } from "@traxjs/trax";

let trax: Trax | null = null;

(globalThis as any).__TRAX_DEVTOOLS__ = {
    connectTrax(traxInstance: Trax) {
        trax = traxInstance;
        // TODO: notify 
    }
};
