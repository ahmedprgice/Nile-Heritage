"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import api from "@/lib/http";
import { API_BASE_URL } from "@/lib/apiBaseUrl";

export function useChatSocket({
  enabled = true,
  onMessageNew,
  onTypingUpdate,
  onReadUpdated,
  onPresenceUpdate,
  onReconnect,
}) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const callbacksRef = useRef({
    onMessageNew,
    onTypingUpdate,
    onReadUpdated,
    onPresenceUpdate,
    onReconnect,
  });
  const disconnectTimerRef = useRef(null);

  useEffect(() => {
    callbacksRef.current = {
      onMessageNew,
      onTypingUpdate,
      onReadUpdated,
      onPresenceUpdate,
      onReconnect,
    };
  }, [onMessageNew, onTypingUpdate, onReadUpdated, onPresenceUpdate, onReconnect]);

  const baseUrl = useMemo(() => API_BASE_URL || api?.defaults?.baseURL || "", []);
  const socketPolicy = useMemo(() => {
    const isVercelFrontend =
      typeof window !== "undefined" && window.location.hostname.endsWith("vercel.app");
    const forceSocketOnVercel = process.env.NEXT_PUBLIC_CHAT_SOCKET_ENABLED === "true";
    const disableSocket =
      process.env.NEXT_PUBLIC_DISABLE_CHAT_SOCKET === "true" ||
      (isVercelFrontend && !forceSocketOnVercel);
    const pollingOnly =
      process.env.NEXT_PUBLIC_CHAT_POLLING_ONLY === "true" || isVercelFrontend;

    return {
      available: !disableSocket,
      pollingOnly,
    };
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token || !baseUrl) return undefined;
    if (!socketPolicy.available) {
      socketRef.current = null;
      return undefined;
    }

    const socket = io(baseUrl, {
      auth: { token },
      transports: socketPolicy.pollingOnly ? ["polling"] : ["websocket", "polling"],
      upgrade: !socketPolicy.pollingOnly,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      withCredentials: true,
    });

    socketRef.current = socket;

    const handleConnect = () => {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      setConnected(true);
    };
    const handleDisconnect = () => {
      if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = setTimeout(() => {
        setConnected(false);
      }, 1200);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.io.on("reconnect", () => {
      setConnected(true);
      callbacksRef.current.onReconnect?.();
    });

    socket.on("message:new", (payload) => callbacksRef.current.onMessageNew?.(payload));
    socket.on("typing:update", (payload) => callbacksRef.current.onTypingUpdate?.(payload));
    socket.on("read:updated", (payload) => callbacksRef.current.onReadUpdated?.(payload));
    socket.on("presence:update", (payload) => callbacksRef.current.onPresenceUpdate?.(payload));

    return () => {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, baseUrl, socketPolicy]);

  const emit = (event, payload, ack) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      if (typeof ack === "function") ack({ ok: false, error: "Socket not connected" });
      return;
    }
    if (typeof ack === "function") {
      const ackTimeoutMs = socketPolicy.pollingOnly ? 1500 : 6000;
      socket.timeout(ackTimeoutMs).emit(event, payload, (error, response) => {
        if (error) {
          ack({ ok: false, error: "Socket request timeout" });
          return;
        }
        ack(response);
      });
      return;
    }
    socket.emit(event, payload);
  };

  return {
    available: socketPolicy.available,
    connected: socketPolicy.available ? connected : false,
    emitSendMessage: (payload, ack) => emit("message:send", payload, ack),
    emitTypingStart: (payload) => emit("typing:start", payload),
    emitTypingStop: (payload) => emit("typing:stop", payload),
    emitReadUpdate: (payload) => emit("read:update", payload),
    emitJoinConversation: (payload) => emit("conversation:join", payload),
    emitLeaveConversation: (payload) => emit("conversation:leave", payload),
  };
}
