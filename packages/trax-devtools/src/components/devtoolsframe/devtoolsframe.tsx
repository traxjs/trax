import './devtoolsframe.css';

export function DevToolsFrame(props: { panelSrc: string }) {
    const { panelSrc } = props;
    return <iframe className="trax-devtools-frame" src={panelSrc} />
}

