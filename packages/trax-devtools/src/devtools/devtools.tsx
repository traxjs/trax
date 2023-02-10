import { component, useStore } from "@traxjs/trax-react";
import { createDevToolsStore } from "./devtoolsstore";
import { DtClientAPI } from "./types";
import { DtLogPane } from "./components/logs";
import './devtools.css';

export const DevTools = component("DtDevTools", (props: { clientAPI: DtClientAPI }) => {
    const store = useStore(() => createDevToolsStore(props.clientAPI));
    const data = store.data;
    const logs = data.logs;

    return <div className="devtools">
        <DtMainTabs />
        <DtLogPane store={store} />
    </div>
});

const DtMainTabs = component("DtMainTabs", () => {
    const tabs = [{ key: "STORES", label: "Stores" }, { key: "LOGS", label: "Logs" }];

    return <div className="main-tabs">
        <div className="tab-group">
            {tabs.map(tab => <label className="tab">
                <input className="tab-input" type="radio" name="dt-main-tabs" value={tab.key} checked={tab.key === "LOGS"} />
                <span className="tab-title">{tab.label}</span>
            </label>)}
        </div>
    </div>
});
