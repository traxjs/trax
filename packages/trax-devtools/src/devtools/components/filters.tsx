import { traxEvents } from "@traxjs/trax";
import { component } from "@traxjs/trax-react";
import { DevToolsStore } from "../devtoolsstore";
import './filters.css';


const logTypes = [
    [
        { label: "SET", desc: "Include Property Set Logs", filterProp: "includePropertySet" },
        { label: "DRT", desc: "Include Logs triggered when Processors get Dirty", filterProp: "includeProcessorDirty" },
        { label: "EVT", desc: "Include Application events", filterProp: "includeAppEvents" },
        { label: "COMPUTE", desc: "Include Compute Calls with no events matching filters", filterProp: "includeCompute", type: "long" },
    ], [
        { label: "LOG", desc: "Include Info Messages", filterProp: "includeInfoMessages" },
        { label: "WRN", desc: "Include Warning Messages", filterProp: "includeWarningMessages" },
        { label: "ERR", desc: "Include Error Messages", filterProp: "includeErrorMessages" },
        { label: "RENDER", desc: "Include Renderer Calls with no events matching filters", filterProp: "includeRender", type: "long" },
    ], [
        { label: "GET", desc: "Include Property Get Logs", filterProp: "includePropertyGet" },
        { label: "NEW", desc: "Include Object Creation Logs", filterProp: "includeNew" },
        { label: "DEL", desc: "Include Object Disposal Logs", filterProp: "includeDispose" },
        { label: "ACTIONS", desc: "Include Action Calls with no events matching filters", filterProp: "includeEmptyProcessingGroups", type: "long" },
    ], [
        { label: "END", desc: "Include Processing End & Pause Logs", filterProp: "includeProcessingEnd" },
        { label: "SKP", desc: "Include Skipped Compute (Lazy Processors)", filterProp: "includeProcessorSkip" },
        { label: "RECONCILE", desc: "Include Reconciliation Calls with no events matching filters", filterProp: "includeReconciliation", type: "reconcile" },
    ]
]

export const Filters = component("Filters", (props: { store: DevToolsStore }) => {
    const { store } = props;
    const filters = store.data.logFilters;

    return <div className="filters">
        <h1> Log Filters </h1>
        <div className="fiters-log-types">
            {logTypes.map((line) => <div className="filters-line">
                {line.map((tp) => <button className={"fiters-log-type-btn" + clsNameSuffix(tp)}
                    title={tp.desc} onClick={() => toggle(tp.filterProp)}> {tp.label} </button>)}
            </div>)}
        </div>
        <div className="filters-actions">
            <a className="filters-action" href="#" onClick={() => store.resetFilters()}>Reset filters</a>&nbsp;-&nbsp;
            <a className="filters-action" href="#" onClick={() => store.updateAllFilters(true)}>View all</a>&nbsp;-&nbsp;
            <a className="filters-action" href="#" onClick={() => store.updateAllFilters(false)}>Hide all</a>
        </div>

    </div>

    function toggle(filterProp: string) {
        (filters as any)[filterProp] = !(filters as any)[filterProp];
    }

    function clsNameSuffix(tp: { filterProp: string, type?: string }) {
        let sf = (filters as any)[tp.filterProp] ? " selected" : "";
        if (tp.type) {
            sf += " " + tp.type;
        }
        return sf;
    }
});
