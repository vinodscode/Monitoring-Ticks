// Market timings based on Zerodha documentation
export interface MarketSession {
  name: string
  start: string // HH:MM format
  end: string // HH:MM format
}

export interface MarketTimings {
  preMarket?: MarketSession
  normal: MarketSession
  postMarket?: MarketSession
}

export const MARKET_TIMINGS = {
  // Equity (Cash & F&O)
  equity: {
    preMarket: { name: "Pre-market", start: "09:00", end: "09:15" },
    normal: { name: "Normal", start: "09:15", end: "15:30" },
    postMarket: { name: "Post-market", start: "15:30", end: "16:00" },
  },
  // Currency Derivatives
  currency: {
    normal: { name: "Normal", start: "09:00", end: "17:00" },
  },
  // Commodity Derivatives
  commodity: {
    normal: { name: "Normal", start: "09:00", end: "23:30" },
  },
  // Government Securities (G-Sec)
  gsec: {
    normal: { name: "Normal", start: "09:00", end: "17:00" },
  },
  // Corporate Bonds
  bonds: {
    normal: { name: "Normal", start: "09:00", end: "17:00" },
  },
} as const

export type MarketType = keyof typeof MARKET_TIMINGS

// Market holidays (you can extend this list)
const MARKET_HOLIDAYS_2024 = [
  "2024-01-26", // Republic Day
  "2024-03-08", // Holi
  "2024-03-29", // Good Friday
  "2024-04-11", // Eid ul Fitr
  "2024-04-17", // Ram Navami
  "2024-05-01", // Maharashtra Day
  "2024-06-17", // Eid ul Adha
  "2024-08-15", // Independence Day
  "2024-08-26", // Janmashtami
  "2024-10-02", // Gandhi Jayanti
  "2024-10-31", // Diwali Laxmi Pujan
  "2024-11-01", // Diwali Balipratipada
  "2024-11-15", // Guru Nanak Jayanti
  // Add more holidays as needed
]

export function getCurrentMarketStatus(marketType: MarketType = "equity") {
  const now = new Date()

  // Convert to IST
  const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
  const currentTime = istTime.toTimeString().slice(0, 5) // HH:MM format
  const currentDate = istTime.toISOString().split("T")[0] // YYYY-MM-DD format
  const dayOfWeek = istTime.getDay() // 0 = Sunday, 6 = Saturday

  // Check if it's a weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      isOpen: false,
      session: "Closed",
      reason: "Weekend",
      nextOpenTime: getNextOpenTime(marketType),
    }
  }

  // Check if it's a market holiday
  if (MARKET_HOLIDAYS_2024.includes(currentDate)) {
    return {
      isOpen: false,
      session: "Closed",
      reason: "Market Holiday",
      nextOpenTime: getNextOpenTime(marketType),
    }
  }

  const timings = MARKET_TIMINGS[marketType]

  // For equity market, check all sessions (pre-market, normal, post-market)
  if (marketType === "equity") {
    if (timings.preMarket && isTimeInRange(currentTime, timings.preMarket.start, timings.preMarket.end)) {
      return {
        isOpen: true,
        session: "Pre-market",
        reason: "Pre-market session",
        sessionEnd: timings.preMarket.end,
      }
    }
    if (isTimeInRange(currentTime, timings.normal.start, timings.normal.end)) {
      return {
        isOpen: true,
        session: "Open",
        reason: "Normal trading session",
        sessionEnd: timings.normal.end,
      }
    }
    if (timings.postMarket && isTimeInRange(currentTime, timings.postMarket.start, timings.postMarket.end)) {
      return {
        isOpen: true,
        session: "Post-market",
        reason: "Post-market session",
        sessionEnd: timings.postMarket.end,
      }
    }

    // Determine when market will open next
    const nextSession = getNextEquitySession(currentTime)
    return {
      isOpen: false,
      session: "Closed",
      reason: "Outside trading hours",
      nextOpenTime: nextSession,
    }
  }

  // For other markets, check normal session only
  if (isTimeInRange(currentTime, timings.normal.start, timings.normal.end)) {
    return {
      isOpen: true,
      session: "Open",
      reason: "Normal trading session",
      sessionEnd: timings.normal.end,
    }
  }

  return {
    isOpen: false,
    session: "Closed",
    reason: "Outside trading hours",
    nextOpenTime: getNextOpenTime(marketType),
  }
}

function isTimeInRange(currentTime: string, startTime: string, endTime: string): boolean {
  const current = timeToMinutes(currentTime)
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)

  // Handle overnight sessions (like commodity market that goes till 23:30)
  if (end < start) {
    return current >= start || current <= end
  }

  return current >= start && current <= end
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

function getNextEquitySession(currentTime: string): string {
  const current = timeToMinutes(currentTime)
  const preMarketStart = timeToMinutes("09:00")
  const normalStart = timeToMinutes("09:15")
  const postMarketStart = timeToMinutes("15:30")

  if (current < preMarketStart) {
    return "09:00 (Pre-market)"
  } else if (current < normalStart) {
    return "09:15 (Normal trading)"
  } else if (current < postMarketStart) {
    return "15:30 (Post-market)"
  } else {
    return "Next day 09:00 (Pre-market)"
  }
}

function getNextOpenTime(marketType: MarketType): string {
  const timings = MARKET_TIMINGS[marketType]

  switch (marketType) {
    case "equity":
      return "Next trading day 09:00"
    case "currency":
    case "gsec":
    case "bonds":
      return "Next trading day 09:00"
    case "commodity":
      return "Next trading day 09:00"
    default:
      return "Next trading day 09:00"
  }
}

export function getMarketTypeForInstrument(instrumentName: string): MarketType {
  const name = instrumentName.toUpperCase()

  // Currency instruments
  if (
    name.includes("USD") ||
    name.includes("EUR") ||
    name.includes("GBP") ||
    name.includes("JPY") ||
    name.includes("USDINR") ||
    name.includes("EURINR")
  ) {
    return "currency"
  }

  // Commodity instruments
  if (
    name.includes("CRUDE") ||
    name.includes("GOLD") ||
    name.includes("SILVER") ||
    name.includes("COPPER") ||
    name.includes("ZINC") ||
    name.includes("ALUMINIUM") ||
    name.includes("LEAD") ||
    name.includes("NICKEL") ||
    name.includes("NATURALGAS") ||
    name.includes("MENTHAOIL") ||
    name.includes("CARDAMOM") ||
    name.includes("PEPPER")
  ) {
    return "commodity"
  }

  // Government Securities
  if (name.includes("GSEC") || name.includes("GOVT") || name.includes("BOND")) {
    return "gsec"
  }

  // Corporate Bonds
  if (name.includes("CORP") && name.includes("BOND")) {
    return "bonds"
  }

  // Default to equity (includes stocks, indices, F&O)
  return "equity"
}

// Helper function to check if alerts should be active for a given instrument
export function shouldAlertsBeActive(instrumentName: string): boolean {
  const marketType = getMarketTypeForInstrument(instrumentName)
  const marketStatus = getCurrentMarketStatus(marketType)
  return marketStatus.isOpen
}

// Get detailed market status with timing information
export function getDetailedMarketStatus(instrumentName: string) {
  const marketType = getMarketTypeForInstrument(instrumentName)
  const status = getCurrentMarketStatus(marketType)
  const timings = MARKET_TIMINGS[marketType]

  return {
    ...status,
    marketType,
    timings,
    instrumentName,
  }
}

// Check if current time is within any trading session for the market type
export function isWithinTradingHours(marketType: MarketType): boolean {
  const status = getCurrentMarketStatus(marketType)
  return status.isOpen
}

// Get time remaining until market closes (in minutes)
export function getTimeUntilMarketClose(marketType: MarketType): number | null {
  const status = getCurrentMarketStatus(marketType)
  if (!status.isOpen || !status.sessionEnd) return null

  const now = new Date()
  const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
  const currentMinutes = istTime.getHours() * 60 + istTime.getMinutes()
  const closeMinutes = timeToMinutes(status.sessionEnd)

  return Math.max(0, closeMinutes - currentMinutes)
}
