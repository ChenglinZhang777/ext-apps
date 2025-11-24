import {
  AppBridge,
  PostMessageTransport,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import {
  setupSandboxProxyIframe,
  getToolUiResourceUri,
  readToolUiResourceHtml,
} from "../src/app-host-utils";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { LoggingMessageNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  McpUiOpenLinkRequestSchema,
  McpUiMessageRequestSchema,
  McpUiSizeChangeNotificationSchema,
} from "@modelcontextprotocol/ext-apps";

const SANDBOX_PROXY_URL = URL.parse("/sandbox.html", location.href)!;

window.addEventListener("load", async () => {
  const client = new Client({
    name: "MCP UI Proxy Server",
    version: "1.0.0",
  });
  const mcpServerUrl = new URL("http://localhost:3001/mcp");
  console.log("[Client] Attempting SSE connection to", mcpServerUrl.href);
  try {
    await client.connect(new SSEClientTransport(mcpServerUrl));
    console.log("[Client] SSE connection successful");
  } catch (error) {
    console.warn(
      "[Client] SSE connection failed, falling back to HTTP:",
      error,
    );
    await client.connect(new StreamableHTTPClientTransport(mcpServerUrl));
    console.log("[Client] HTTP connection successful");
  }

  const tools = Object.fromEntries(
    (await client.listTools()).tools.map((t) => [t.name, t]),
  );

  const controlsDiv = document.getElementById("controls") as HTMLDivElement;
  const chatRootDiv = document.getElementById("chat-root") as HTMLDivElement;

  /**
   * Creates a tool UI instance for the given tool name.
   * This demonstrates the new simplified API where the host manages the full proxy lifecycle.
   */
  async function createToolUI(
    toolName: string,
    toolInput: Record<string, unknown>,
  ) {
    try {
      // Step 1: Create iframe and wait for sandbox proxy ready
      const { iframe, onReady } =
        await setupSandboxProxyIframe(SANDBOX_PROXY_URL);

      chatRootDiv.appendChild(iframe);

      // Wait for sandbox proxy to be ready
      await onReady;

      // Step 2: Create proxy server instance
      const serverCapabilities = client.getServerCapabilities();
      const proxy = new AppBridge(
        client,
        {
          name: "Example MCP UI Host",
          version: "1.0.0",
        },
        {
          openLinks: {},
          serverTools: serverCapabilities?.tools,
          serverResources: serverCapabilities?.resources,
        },
      );

      // Step 3: Register handlers BEFORE connecting
      proxy.oninitialized = () => {
        console.log("[Example] Inner iframe MCP client initialized");

        // Send tool input once iframe is ready
        proxy.sendToolInput({ arguments: toolInput });
      };

      proxy.setRequestHandler(McpUiOpenLinkRequestSchema, async (req) => {
        console.log("[Example] Open link requested:", req.params.url);
        window.open(req.params.url, "_blank", "noopener,noreferrer");
        return { isError: false };
      });

      proxy.setRequestHandler(McpUiMessageRequestSchema, async (req) => {
        console.log("[Example] Message requested:", req.params);
        return { isError: false };
      });

      // Handle size changes by resizing the iframe
      proxy.setNotificationHandler(
        McpUiSizeChangeNotificationSchema,
        async (notif: any) => {
          const { width, height } = notif.params;
          if (width !== undefined) {
            iframe.style.width = `${width}px`;
          }
          if (height !== undefined) {
            iframe.style.height = `${height}px`;
          }
        },
      );

      proxy.setNotificationHandler(
        LoggingMessageNotificationSchema,
        async (notif: any) => {
          console.log("[Tool UI Log]", notif.params);
        },
      );

      // Step 4: Connect proxy to iframe (triggers MCP initialization)
      // Pass iframe.contentWindow as both target and source for proper message filtering
      await proxy.connect(
        new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!),
      );

      // Step 5: Fetch and send UI resource
      const resourceInfo = await getToolUiResourceUri(client, toolName);
      if (!resourceInfo) {
        throw new Error(`Tool ${toolName} has no UI resource`);
      }

      const html = await readToolUiResourceHtml(client, {
        uri: resourceInfo.uri,
      });
      await proxy.sendSandboxResourceReady({ html });

      console.log("[Example] Tool UI setup complete for:", toolName);
    } catch (error) {
      console.error("[Example] Error setting up tool UI:", error);
    }
  }

  // Create buttons for available tools
  if ([...Object.keys(tools)].some((n) => n.startsWith("pizza-"))) {
    for (const t of Object.values(tools)) {
      if (t.name.startsWith("pizza-")) {
        controlsDiv.appendChild(
          Object.assign(document.createElement("button"), {
            innerText: t.name,
            onclick: () => createToolUI(t.name, { pizzaTopping: "Mushrooms" }),
          }),
        );
      }
    }
  } else {
    controlsDiv.appendChild(
      Object.assign(document.createElement("button"), {
        innerText: "Add MCP UI View",
        onclick: () =>
          createToolUI("create-example-ui", { message: "Hello from Host!" }),
      }),
    );
  }
});
