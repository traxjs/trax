import { component, componentId, useStore } from "@traxjs/trax-react";
import { RadarChart } from "./radarchart";
import { createRadarStore } from "./radarstore";
import './playground.css';

// example adapted from https://vuejs.org/examples/#svg

function initRadarStore() {
    // create a RadarStore with some sample data
    const values = [80, 90, 75, 5, 70, 100, 90];
    return createRadarStore(values.map((v, i) => { return { label: "V" + (i + 1), value: v } }));
}

export const RcPlayground = component("RcPlayground", () => {
    // creat or retrieve a RadarStore instance
    const rs = useStore(initRadarStore);
    const data = rs.data;
    const values = data.values;

    return <div data-id={componentId()} className='radar-chart-playground'>
        <h1> Radar Chart </h1>
        <RadarChart store={rs} />
        <div>
            <div>
                <label>Min Value:</label><span className="minValue">{data.min}</span>
                &nbsp;
                <label>Max Value:</label><span className="maxValue">{data.max}</span>
            </div>
            <div className="control-panel">
                {values.map((v) => {
                    return <div className="value-panel">
                        <label>{v.label}</label>
                        <input type="range" min="0" max="100" value={v.value}
                            onInput={e => v.value = parseInt(e.currentTarget.value, 10)} />
                        <span className="value">{v.value}</span>
                        <span className="delete" title="Delete entry" onClick={() => rs.deleteEntry(v)}>✕</span>
                    </div>
                })}
            </div>
            <a className="add-value" href="#" onClick={addValue}>Add New Value</a>
        </div>
    </div>

    function addValue() {
        const len = values.length;
        let idx = 0;
        if (len) {
            const m = values[len - 1].label.match(/\d+/);
            if (m) {
                idx = parseInt(m[0], 10) + 1;
            }
        }
        rs.addEntry("N" + idx, 50);
    }
});

