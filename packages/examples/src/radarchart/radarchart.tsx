import { component, componentId } from "@traxjs/trax-react";
import { RadarStore } from "./radarstore";

// example adapted from https://vuejs.org/examples/#svg

export const RadarChart = component("RadarChart", (props: { store: RadarStore }) => {
    const { store } = props;
    const values = store.data.values;

    const total = values.length;
    const points = values.map((v, i) => {
        const { x, y } = valueToPoint(v.value, i, total);
        return `${x},${y}`;
    }).join(' ');

    return <div data-id={componentId()} className='radar-chart'>
        <svg width="200" height="200">
            <g>
                <polygon points={points}></polygon>
                <circle cx="100" cy="100" r="80"></circle>

                {values.map((v, index) => {
                    // axis labels
                    const { x, y } = valueToPoint(v.value + 20, index, total);
                    return <text x={x-5} y={y+5}>{v.label}</text>
                })}
            </g>
        </svg >
    </div >
});

export function valueToPoint(value: number, index: number, total: number) {
    const x = 0;
    const y = -value * 0.8;
    const angle = ((Math.PI * 2) / total) * index;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: x * cos - y * sin + 100,
        y: x * sin + y * cos + 100
    }
}
