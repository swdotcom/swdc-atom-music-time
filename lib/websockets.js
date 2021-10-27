'use babel';

import { websockets_url } from "./Constants";
import { handleAuthenticatedPluginUser } from "./message_handlers/authenticated_plugin_user";
import { handleIntegrationConnectionSocketEvent } from "./message_handlers/integration_connection";

const utilMgr = require('./managers/UtilManager');
const fileUtil = require("./utils/FileUtil");

const WebSocket = require("ws");

let retryTimeout = undefined;

const INITIAL_RECONNECT_DELAY = 12000;
const MAX_RECONNECT_DELAY = 25000;
// websocket reconnect delay
let currentReconnectDelay = INITIAL_RECONNECT_DELAY;

let ws = undefined;

export function initializeWebsockets() {
  console.debug("[MusicTime] initializing websocket connection");
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
  };

  ws = new WebSocket(websockets_url, options);

  ws.on("open", function open() {
    console.debug("[MusicTime] websocket connection open");
  });

  ws.on("message", function incoming(data) {
    handleIncomingMessage(data);
  });

  ws.on("close", function close(code, reason) {
    if (code !== 1000) {
      retryConnection();
    }
  });

  ws.on("unexpected-response", function unexpectedResponse(request, response) {
    console.debug("[MusicTime] unexpected websocket response:", response.statusCode);

    if (response.statusCode === 426) {
      console.error("[MusicTime] websocket request had invalid headers. Are you behind a proxy?");
    } else {
      retryConnection();
    }
  });

  ws.on("error", function error(e) {
    console.error("[MusicTime] error connecting to websockets", e);
  });
}

function retryConnection() {
  if (!retryTimeout) {
    const delay = getDelay();

    if (currentReconnectDelay < MAX_RECONNECT_DELAY) {
      // multiply until we've reached the max reconnect
      currentReconnectDelay *= 2;
    } else {
      currentReconnectDelay = Math.min(currentReconnectDelay, MAX_RECONNECT_DELAY);
    }

    console.log(`[MusicTime] retrying websocket connection in ${delay / 1000} second(s)`);

    retryTimeout = setTimeout(() => {
      initializeWebsockets();
    }, delay);
  }
}

function getDelay() {
  let rand = getRandomNumberWithinRange(-5, 5);
  if (currentReconnectDelay < MAX_RECONNECT_DELAY) {
    // if less than the max reconnect delay then increment the delay
    rand = Math.random();
  }
  return currentReconnectDelay + Math.floor(rand * 1000);
}

function getRandomNumberWithinRange(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

export function clearWebsocketConnectionRetryTimeout() {
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = undefined;
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
