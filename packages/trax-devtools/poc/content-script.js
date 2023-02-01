"use strict";

/**
 * This script is injected in each application
 * Its purpose is to bridge the local trax library (if used in the application) to the Background worker script
 */

(() => {
    const TRACE_ON = true;
    const CONTENT_SCRIPT_NAME = "TraxContentScript";
    const PAGE_SCRIPT_NAME = "TraxPageScript";
    const CONNECTED = "Connected";
    const DISCONNECTED = "Disconnected";
    const EVT_TYPES = { ACTION: "TRXA", CALL: "TRXC", LOGS: "TRXL" };
    const SCRIPT_NAME = CONTENT_SCRIPT_NAME
    let tabId = "";

    function trace(...args) {
        if (TRACE_ON) {
            let nm = SCRIPT_NAME;
            if (tabId) {
                nm += "/" + tabId
            }
            console.log("[" + nm + "]", ...args);
        }
    }

    trace("init");


    let bkgConnection = null;
    let bkgConnectionStatus = DISCONNECTED;

    function connectToBkgScript() {
        if (bkgConnectionStatus === DISCONNECTED) {
            // connect to the background script
            trace("Connecting...");
            bkgConnection = chrome.runtime.connect({
                name: CONTENT_SCRIPT_NAME
            });
            bkgConnection.onMessage.addListener(handleBkgMessage);
            bkgConnection.onDisconnect.addListener(handleBkgDisconnect);
            bkgConnectionStatus = CONNECTED;
        }
    }

    /** 
     * Forward PageScript messages to the Background Script via the Content Script
     */
    window.addEventListener("message", (e) => {
        const data = e.data;
        if (e.source === window && data && data.from === PAGE_SCRIPT_NAME) {
            trace(`Receive`, data);
            connectToBkgScript();
            try {
                
                if (bkgConnectionStatus === CONNECTED) {
                    trace(`Send Message to Bkg`)
                    // Forward to Bkg script
                    bkgConnection.postMessage({
                        ...data,
                        tabId,
                        via: SCRIPT_NAME
                    });
                }
            } catch (ex) {
                trace(`Connection Exception: ${ex}`);
            }
        }
    });

    function handleBkgMessage(msg) {
        if (msg.tabId) {
            tabId = msg.tabId;
        }
        trace(`Bkg Message Received`, msg);
        bkgConnectionStatus = CONNECTED;
        // Fwd to Page Script
        window.postMessage({ ...msg, via: SCRIPT_NAME }, "*");
    }

    function handleBkgDisconnect() {
        bkgConnection = null;
        bkgConnectionStatus = DISCONNECTED;
    }

    connectToBkgScript();
})();
