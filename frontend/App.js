import React from "react";
import { ExpandableInput, Item } from "./components";
import "webostvjs/webOSTV";

function lunaCall(uri, parameters) {
  return new Promise((resolve, reject) => {
    const s = uri.indexOf("/", 7);
    webOS.service.request(uri.substr(0, s), {
      method: uri.substr(s + 1),
      parameters,
      onSuccess: resolve,
      onFailure: (res) => {
        reject(new Error(JSON.stringify(res)));
      },
    });
  });
}

export function App() {
  const [loading, setLoading] = React.useState(true);
  const [statusText, setStatusText] = React.useState("Starting up...");

  const [password, setPassword] = React.useState("");
  const [framerate, setFramerate] = React.useState("");
  const [width, setWidth] = React.useState("");
  const [height, setHeight] = React.useState("");
  const [autostart, setAutostart] = React.useState(true);

  const [running, setRunning] = React.useState(null);
  const [activeClients, setActiveClients] = React.useState(0);

  function log(s) {
    console.info(s);
    setStatusText(s);
  }

  async function fetchStatus() {
    let status = await lunaCall(
      "luna://org.webosbrew.vncserver.service/status",
      {}
    );
    setRunning(status.running);
    setActiveClients(status.activeClients);
    return status;
  }

  React.useEffect(async () => {
    let status = null;
    try {
      log("Fetching status...");

      try {
        status = await fetchStatus();
      } catch (err) {
        console.warn("Status fetch failed:", status);
      }

      if (!status || !status.returnValue) {
        log("Status check failed, attempting service elevation...");
        await lunaCall("luna://org.webosbrew.hbchannel.service/exec", {
          command:
            "/media/developer/apps/usr/palm/services/org.webosbrew.hbchannel.service/elevate-service org.webosbrew.vncserver.service && (pkill -x -f /media/developer/apps/usr/palm/services/org.webosbrew.vncserver.service/webos-vncserver || true)",
        });
        log("Elevated, fetching status...");
        status = await fetchStatus();
      }

      log(
        `Running: ${status.running}, active clients: ${status.activeClients}`
      );

      setInterval(fetchStatus, 500);

      setPassword(status.settings.password);
      setWidth(status.settings.width);
      setHeight(status.settings.height);
      setAutostart(status.settings.autostart);
      setFramerate(status.settings.framerate);

      setLoading(false);
    } catch (err) {
      log(
        `Something went wrong - initialization failed:\n${err}.\n\nIf this is the first app run - try rebooting your TV and check if your TV is rooted.`
      );
    }
  }, []);

  async function applyConfiguration() {
    try {
      await lunaCall("luna://org.webosbrew.vncserver.service/configure", {
        width,
        height,
        autostart,
        password,
        framerate,
      });
      setStatusText("Configuration changed.");
    } catch (err) {
      setStatusText(`Configuration change failed: ${err}`);
    }
  }

  return (
    <div>
      <div className="half">
        {running === false ? (
          <button
            onClick={async () => {
              await lunaCall(
                "luna://org.webosbrew.vncserver.service/start",
                {}
              );
              await fetchStatus();
            }}
          >
            Start
          </button>
        ) : running === true ? (
          <button
            onClick={async () => {
              await lunaCall("luna://org.webosbrew.vncserver.service/stop", {});
              await fetchStatus();
            }}
          >
            Stop
          </button>
        ) : null}
        <ExpandableInput
          label="Capture width"
          value={width}
          onChange={(evt) => setWidth(parseInt(evt.target.value))}
        />
        <ExpandableInput
          label="Capture height"
          value={height}
          onChange={(evt) => setHeight(parseInt(evt.target.value))}
        />
        <ExpandableInput
          label="Framerate limit"
          value={framerate}
          onChange={(evt) => setFramerate(parseInt(evt.target.value))}
        />
        <ExpandableInput
          label="Password"
          value={password}
          onChange={(evt) => {
            console.info(evt);
            setPassword(evt.target.value);
          }}
        />
        <Item label="Autostart" onClick={() => setAutostart(!autostart)}>
          <div className="inner">{autostart ? "Enabled" : "Disabled"}</div>
        </Item>
        <Item label="Apply" onClick={() => applyConfiguration()} />
      </div>
      <div className="half">
        <div style={{ whiteSpace: "pre-wrap", wordWrap: "break-word" }}>
          {statusText}
        </div>
      </div>
    </div>
  );
}