import { render } from 'preact';
// import { Counter } from './counter/counter';
import './panel.css';

async function main() {
    const mainDiv = document.getElementById('main')!;
    mainDiv.innerHTML = "";

    setTheme();

    render(<div>
        DevTools Panel... 
    </div>, document.getElementById('main')!);
}

main();

function setTheme() {
    // extract theme from url - e.g. chrome-extension://lmpancgapnccmjmicgmjhjendcaogjii/panel/panel.html?theme=dark
    let theme = "light";
    const m = window.location.href.match(/theme=([a-zA-Z]+)/);
    if (m && m[1] === "dark") {
        theme = "dark";
    }
    const body = document.querySelector("body");
    if (body) {
        body.classList.add(theme);
    }
}
