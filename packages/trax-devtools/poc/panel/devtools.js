

/**
 * Always create a panel
 * (Keep things simple)
 */

const theme = chrome.devtools.panels.themeName + "";


chrome.devtools.panels.create("Trax",
    "", // no icon
    "/panel/panel.html?theme=" + theme,
    function (panel) {
        // code invoked on panel creation
    }
);

