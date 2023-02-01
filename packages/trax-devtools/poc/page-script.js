"use strict";

/**
 * This script is injected in each application by the Background script in each application
 * On the contrary to the content-script, this script can create global JS variables 
 * visible to the trax lib
 */

(() => {
    const TRACE_ON = true;
    const CONTENT_SCRIPT_NAME = "TraxContentScript";
    const PAGE_SCRIPT_NAME = "TraxPageScript";
    const PANEL_SCRIPT_NAME = "TraxPanelScript";
    const SCRIPT_NAME = PAGE_SCRIPT_NAME;
    const EVT_TYPES = { ACTION: "TRXA", CALL: "TRXC", LOGS: "TRXL" };
    let trax = null;

    function trace(...args) {
        if (TRACE_ON) {
            console.log("[" + SCRIPT_NAME + "]", ...args);
        }
    }

    trace("init");

    // Listen to Bkg Script Messages coming from the Content Script
    window.addEventListener("message", (e) => {
        if (e.source === window && e.data && e.data.dest === PAGE_SCRIPT_NAME) {
            const data = e.data;
            trace(`Receive`, data);
        }
    });

    // Simple Test: send click messages to the Background Script
    let count = 0;
    window.addEventListener("click", () => {
        count++;
        trace("Click", count);
        // Send a message to the content script that will forward it to the Background script
        window.postMessage({
            type: EVT_TYPES.ACTION,
            from: SCRIPT_NAME,
            to: PANEL_SCRIPT_NAME,
            data: { msg: "Page Click #" + count }
        }, "*");
    });

    window.__TRAX_DEVTOOLS__ = {
        connectTrax(traxInstance) {
            trax = traxInstance;
            trace("Trax Connected");

            // TODO subscribe, etc.
        }
    };
})();
