import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()

  const customReadable = new ReadableStream({
    start(controller) {
      // Create EventSource connection to the external endpoint
      const eventSource = new EventSource("https://ticks.rvinod.com/ticks")

      eventSource.onopen = () => {
        console.log("✅ Connected to external tick stream")
      }

      eventSource.addEventListener("tick", (event) => {
        try {
          // Forward the tick data to the client
          const data = `event: tick\ndata: ${event.data}\n\n`
          controller.enqueue(encoder.encode(data))
        } catch (error) {
          console.error("❌ Error processing tick:", error)
        }
      })

      eventSource.onerror = (error) => {
        console.error("❌ EventSource error:", error)
        controller.error(error)
      }

      // Clean up on close
      request.signal.addEventListener("abort", () => {
        console.log("🔌 Client disconnected, closing EventSource")
        eventSource.close()
        controller.close()
      })
    },
  })

  return new Response(customReadable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "Cache-Control",
    },
  })
}
