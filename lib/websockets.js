'use babel';

import { websockets_url } from "./Constants";
import { handleAuthenticatedPluginUser } from "./message_handlers/authenticated_plugin_user";
import { handleIntegrationConnectionSocketEvent } from "./message_handlers/integration_connection";

const utilMgr = require('./managers/UtilManager');
const fileUtil = require("./utils/FileUtil");

const WebSocket = require("ws");

let intervalId = undefined;

const ONE_MIN_MILLIS = 1000 * 60;
const LONG_RECONNECT_DELAY = ONE_MIN_MILLIS * 5;

let ws = undefined;

export function initializeWebsockets() {
  console.log("[MusicTime] initializing websocket connection");
  clearWebsocketConnectionRetryTimeout();
  if (ws) {
    // 1000 indicates a normal closure, meaning that the purpose for
    // which the connection was established has been fulfilled
    ws.close(1000, 're-initializing websocket');
  }
  const options = {
    headers: {
      Authorization: fileUtil.getItem("jwt"),
      "X-SWDC-Plugin-Id": utilMgr.getPluginId(),
      "X-SWDC-Plugin-Name": utilMgr.getPluginName(),
      "X-SWDC-Plugin-Version": utilMgr.getVersion(),
      "X-SWDC-Plugin-OS": utilMgr.getOs(),
      "X-SWDC-Plugin-TZ": Intl.DateTimeFormat().resolvedOptions().timeZone,
      "X-SWDC-Plugin-Offset": utilMgr.getOffsetSeconds() / 60,
      "X-SWDC-Plugin-UUID": fileUtil.getPluginUuid(),
    },
    perMessageDeflate: false
  };

  ws = new WebSocket(websockets_url, options);

  ws.on("open", function open() {
    console.log("[MusicTime] websocket connection open");
    clearWebsocketConnectionRetryTimeout();
  });

  ws.on("message", function incoming(data) {
    handleIncomingMessage(data);
  });

  ws.on("close", function close(code, reason) {
    if (code !== 1000) {
      // clear this client side timeout
      console.debug("[MusicTime] websockets connection closed - will retry in 15 seconds");
      if (!intervalId) {
        intervalId = setInterval(() => {
          initializeWebsockets();
        }, ONE_MIN_MILLIS);
      }
    }
  });

  ws.on("unexpected-response", function unexpectedResponse(request, response) {
    console.debug("[MusicTime] unexpected websocket response:", response.statusCode);

    if (response.statusCode === 426) {
      console.error("[MusicTime] websocket request had invalid headers. Are you behind a proxy?");
    } else if (response.statusCode >= 500) {
      if (!intervalId) {
        // longer timeout
        intervalId = setInterval(() => {
          initializeWebsockets();
        }, LONG_RECONNECT_DELAY);
      }
    }
  });

  ws.on("error", function error(e) {
    console.error("[MusicTime] error connecting to websockets", e);
  });
}

export function clearWebsocketConnectionRetryTimeout() {
  if (intervalId) {
    clearTimeout(intervalId);
    intervalId = undefined;
  }
}

const handleIncomingMessage = (data) => {
  try {
    const message = JSON.parse(data);

    switch (message.type) {
      case "authenticated_plugin_user":
        handleAuthenticatedPluginUser(message.body);
        break;
      case "user_integration_connection":
        handleIntegrationConnectionSocketEvent(message.body);
        break;
    }
  } catch (e) {
    if (data) {
      let dataStr = '';
      try {
        dataStr = JSON.stringify(data);
      } catch (e) {
        dataStr = data.toString();
      }
      console.log(`Unable to handle incoming message: ${dataStr}`);
    }
  }
};
