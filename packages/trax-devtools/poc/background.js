"use strict";

/**
 * This script runs in a worker thread.
 * There is only one instance only for all tabs, so it virtually acts as a server from the content-scripts point of view 
 * (we have at most one trax instance per tab - i.e. when an html page uses trax).
 * Main comm channels (done throughPost Messages PM):
 * Background (one for all) <-PM-> ContentScript (one per tab) <-PM-> Trax library (at most one per tab)
 * The background script also communicates with the different Dev tool pannels (at most one per tab, when DevTools are open for this tab)
 * Background (one for all) <-PM-> Panel (at most one per tab) 
 */

(() => {
    const TRACE_ON = true;
    const BKG_SCRIPT_NAME = "TraxBkgScript";
    const PANEL_SCRIPT_NAME = "TraxPanelScript";
    const SCRIPT_NAME = BKG_SCRIPT_NAME;

    function trace(...args) {
        if (TRACE_ON) {
            console.log("[" + SCRIPT_NAME + "]", ...args);
        }
    }
    function warn(...args) {
        console.warn("[" + SCRIPT_NAME + "]", ...args);
    }

    /** Port name for messages sent between the bkg script and content scripts */
    const CONTENT_SCRIPT_NAME = "TraxContentScript";

    trace("init");

    const contentScriptPorts = new Map(); // Map<tabId,Port>
    const panelScriptPorts = new Map(); // Map<tabId,Port>

    /**
     * Inject the page-script into each page
     * in order to grab trax logs and call trax APIs
     */
    trace("registerContentScripts");
    chrome.scripting.registerContentScripts([
        {
            id: "hook",
            matches: ["<all_urls>"],
            js: ["page-script.js"],
            runAt: "document_start",
            world: chrome.scripting.ExecutionWorld.MAIN,
        },
    ]);

    /**
     * Handle connections initiated by Content Scripts
     */
    chrome.runtime.onConnect.addListener((port) => {
        trace(`onConnect`, port.name)
        if (port.name === CONTENT_SCRIPT_NAME) {
            handleContentScriptConnection(port);
        } else if (port.name === PANEL_SCRIPT_NAME) {
            handlePanelScriptConnection(port);
        }
    });

    function handleContentScriptConnection(port) {
        const tabId = port.sender?.tab?.id;

        if (tabId) {
            contentScriptPorts.set(tabId, port);
            trace(`Register listener ${port.name}/${tabId}`);
            port.onMessage.addListener((msg) => {
                trace(`Message received from ${port.name}/${tabId}`, msg);
                // Forward to panel if present
                const p = panelScriptPorts.get(tabId);
                if (p) {
                    p.postMessage({ ...msg, via: SCRIPT_NAME });
                } else {
                    warn(`Message could not be forwarded to PanelScript:`, msg);
                }
            });

            port.onDisconnect.addListener(() => {
                trace(`ContentScript Disconnected from ${port.name}/${tabId}`);
                contentScriptPorts.delete(tabId);
            });
        } else {
            trace(`TabId Not Provided (port:${port.name})`);
        }
    }

    function handlePanelScriptConnection(port) {
        // tabId not defined on sender in this case: we need to wait for the first message
        // to register the connection (First message will be Action:activate)
        let tabId = ""; // closure variable

        port.onMessage.addListener((msg) => {
            const msgTabId = msg?.tabId;
            if (msgTabId) {
                if (tabId === "") {
                    tabId = msgTabId;
                    panelScriptPorts.set(tabId, port);
                }
                trace(`Message received from ${port.name}/${msgTabId}`, msg);
                // Forward to Content Script
                const p = contentScriptPorts.get(msgTabId);
                if (p) {
                    p.postMessage({ ...msg, via: SCRIPT_NAME });
                } else {
                    warn(`Message could not be forwarded to ContentScript:`, msg);
                }
            } else {
                warn(`Invalid Message Received from Panel Script:`, msg);
            }
        });
        port.onDisconnect.addListener(() => {
            trace(`Panel Disconnected from ${port.name}/${tabId}`);
            if (tabId) {
                panelScriptPorts.delete(tabId);
            }
        });
    }

})();


