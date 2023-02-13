import { traxEvents } from "@traxjs/trax";
import { component } from "@traxjs/trax-react";
import { DevToolsStore } from "../devtoolsstore";
import './filters.css';


const logTypes = [
    [
        { label: "SET", type: traxEvents.Set, desc: "Include Property Set Logs", filterProp: "includePropertySet" },
        { label: "DRT", type: traxEvents.ProcessorDirty, desc: "Include Logs triggered when Processors get Dirty", filterProp: "includeProcessorDirty" },
        { label: "EVT", type: "EVT", desc: "Include Application events", filterProp: "includeAppEvents" },
    ], [
        { label: "LOG", type: traxEvents.Info, desc: "Include Info Messages", filterProp: "includeInfoMessages" },
        { label: "WRN", type: traxEvents.Warning, desc: "Include Warning Messages", filterProp: "includeWarningMessages" },
        { label: "ERR", type: traxEvents.Error, desc: "Include Error Messages", filterProp: "includeErrorMessages" },
    ], [
        { label: "GET", type: traxEvents.Get, desc: "Include Property Get Logs", filterProp: "includePropertyGet" },
        { label: "NEW", type: traxEvents.New, desc: "Include Object Creation Logs", filterProp: "includeNew" },
        { label: "DEL", type: traxEvents.Dispose, desc: "Include Object Disposal Logs", filterProp: "includeDispose" },
    ]
]

export const Filters = component("Filters", (props: { store: DevToolsStore }) => {
    const { store } = props;
    const filters = store.data.logFilters;

    return <div className="filters">
        <h1> Log Filters </h1>
        <div className="fiters-log-types">
            {logTypes.map((line) => <div className="filters-line">
                {line.map((tp) => <button className={"fiters-log-type-btn" + ((filters as any)[tp.filterProp] ? " selected" : "")}
                    title={tp.desc} onClick={() => toggle(tp.filterProp)}> {tp.label} </button>)}
            </div>)}
        </div>

    </div>

    function toggle(filterProp: string) {
        (filters as any)[filterProp] = !(filters as any)[filterProp];
    }
});
