export function createChatWebSocket(
  conversationId: string,
  token: string,
  onMessage: (content: string) => void,
  onStatusChange: (connected: boolean) => void
): WebSocket {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  const ws = new WebSocket(
    `${protocol}//${host}/api/chat/ws/${conversationId}?token=${token}`
  );

  ws.onopen = () => onStatusChange(true);
  ws.onclose = () => onStatusChange(false);
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "message") {
      onMessage(data.content);
    }
  };

  return ws;
}
