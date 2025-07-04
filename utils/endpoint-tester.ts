export async function testEndpoint(url: string): Promise<{
  available: boolean
  status?: number
  headers?: Record<string, string>
  error?: string
}> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TickMonitor/1.0)",
        Accept: "text/event-stream",
      },
    })

    return {
      available: response.ok,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
    }
  } catch (error) {
    return {
      available: false,
      error: String(error),
    }
  }
}

export async function findAvailableEndpoints(): Promise<
  Array<{
    url: string
    name: string
    result: Awaited<ReturnType<typeof testEndpoint>>
  }>
> {
  const endpoints = [
    { url: "https://ticks.rvinod.com/ticks", name: "Original Feed" },
    { url: "https://ticks.rvinod.com/upstox", name: "Upstox Feed" },
    { url: "https://ticks.rvinod.com/upstox-feed", name: "Upstox Feed Alt" },
    { url: "https://ticks.rvinod.com/api/upstox", name: "Upstox API" },
    { url: "https://ticks.rvinod.com", name: "Base URL" },
  ]

  const results = await Promise.all(
    endpoints.map(async (endpoint) => ({
      ...endpoint,
      result: await testEndpoint(endpoint.url),
    })),
  )

  return results
}
