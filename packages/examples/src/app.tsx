import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Counter } from "./counter/counter";
import { RcPlayground } from "./radarchart/playground";
import { MessageBoard } from "./messageboard/messageboard";
import "./app.css";

const root = createRoot(document.getElementById("main")!);
root.render(
  <StrictMode>
    <div>
      {/* <Counter /> */}
      <hr />
      <RcPlayground />
      <hr />
      <MessageBoard />
    </div>
  </StrictMode>
);
