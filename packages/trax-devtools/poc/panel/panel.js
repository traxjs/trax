"use strict";

/**
 * Panel script running in the Dev Tools Panel
 */

(() => {
    const TRACE_ON = true;
    const PANEL_SCRIPT_NAME = "TraxPanelScript";
    const PAGE_SCRIPT_NAME = "TraxPageScript";
    const SCRIPT_NAME = PANEL_SCRIPT_NAME;
    const EVT_TYPES = { ACTION: "TRXA", CALL: "TRXC", LOGS: "TRXL" };
    let tabId = chrome.devtools.inspectedWindow.tabId;
    let mainDiv = null;

    function trace(...args) {
        if (TRACE_ON) {
            // TODO: TabId?
            console.log("[" + SCRIPT_NAME + "]", ...args);

            mainDiv && mainDiv.append(document.createTextNode(`${args} / `))
        }
    }
    function warn(...args) {
        console.warn("[" + SCRIPT_NAME + "]", ...args);
    }


    trace("init");

    /**
     * Connect to the Background Script
     */
    const bkgConnection = chrome.runtime.connect({
        name: SCRIPT_NAME
    });
    bkgConnection.onDisconnect.addListener(() => {
        trace("TODO: TELL CS to stop sending Events")
    });
    bkgConnection.onMessage.addListener((msg) => {
        if (msg.tabId && msg.tabId === tabId) {
            tabId = msg.tabId;

            trace(`Message Received`);
        } else {
            warn(`Message Dropped (invalid tabId)`, msg);
        }
    });

    // TODO listen to page navigation
    // chrome.devtools.network.onNavigated.addListener

    let count = 0;
    mainDiv = document.querySelector("#main");
    if (mainDiv) {
        mainDiv.innerHTML = "";

        const btn = document.createElement("button");
        btn.append(document.createTextNode("Send Message"));
        btn.addEventListener("click", () => {
            count++;
            bkgConnection.postMessage({
                type: EVT_TYPES.ACTION,
                tabId,
                from: PANEL_SCRIPT_NAME,
                to: PAGE_SCRIPT_NAME,
                data: { value: "Some data " + count }
            });
        })
        mainDiv.append(btn)
    }
})();
