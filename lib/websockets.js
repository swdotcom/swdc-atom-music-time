'use babel';

import { websockets_url } from "./Constants";
import { handleAuthenticatedPluginUser } from "./message_handlers/authenticated_plugin_user";
import { handleIntegrationConnectionSocketEvent } from "./message_handlers/integration_connection";

const utilMgr = require('./managers/UtilManager');
const fileUtil = require("./utils/FileUtil");

const WebSocket = require("ws");

let retryTimeout = undefined;

export function initializeWebsockets() {
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
  };

  const ws = new WebSocket(websockets_url, options);

  ws.on("open", function open() {
    console.debug("[MusicTime] websockets connection open");
  });

  ws.on("message", function incoming(data) {
    console.debug("[MusicTime] received websocket message: ", data);

    handleIncomingMessage(data);
  });

  ws.on("close", function close(code, reason) {
    console.debug("[MusicTime] websockets connection closed");

    retryConnection();
  });

  ws.on("unexpected-response", function unexpectedResponse(request, response) {
    console.debug("[MusicTime] unexpected websockets response:", response.statusCode);

    if (response.statusCode === 426) {
      console.error("[MusicTime] websockets request had invalid headers. Are you behind a proxy?");
    } else {
      retryConnection();
    }
  });

  ws.on("error", function error(e) {
    console.error("[MusicTime] error connecting to websockets", e);
  });
}

function retryConnection() {
  console.debug("[MusicTime] retrying websockets connecting in 10 seconds");

  retryTimeout = setTimeout(() => {
    console.log("[MusicTime] attempting to reinitialize websockets connection");
    initializeWebsockets();
  }, 10000);
}

export function clearWebsocketConnectionRetryTimeout() {
  clearTimeout(retryTimeout);
}

const handleIncomingMessage = (data) => {
  try {
    const message = JSON.parse(data);

    console.info(`[MusicTime] received '${message.type}' websocket event`);

    switch (message.type) {
      case "info":
        console.info(`[MusicTime] ${message.body}`);
        break;
      case "authenticated_plugin_user":
        handleAuthenticatedPluginUser(message.body);
        break;
      case "user_integration_connection":
        handleIntegrationConnectionSocketEvent(message.body);
        break;
      default:
        console.warn("[MusicTime] received unhandled websocket message type", data);
    }
  } catch (e) {
    console.error("[MusicTime] Unable to handle incoming message", data);
  }
};
