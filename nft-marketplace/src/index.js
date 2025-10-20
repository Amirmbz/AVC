import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App, { Web3Provider } from "./components/WalletConnection";
import reportWebVitals from "./reportWebVitals";
import MintInfo from "./pages/mintInfo/MintInfo";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
  },
  {
    path: "/mint-info",
    element: <MintInfo />,
  },
]);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <Web3Provider>
      <RouterProvider router={router} />,
    </Web3Provider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
